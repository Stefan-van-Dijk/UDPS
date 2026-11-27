/* Runtime workbooks and explicit company publications. No storage or UI side effects. */
(() => {
  "use strict";
  const ABSENT = Symbol("absent");
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const clone = value => structuredClone(value);
  const put = (object, key, value) => Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
  const freeze = value => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  function jsonValue(value, seen = new Set()) {
    if (value === null || ["string", "boolean", "undefined"].includes(typeof value)) return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (typeof value !== "object" || !["[object Object]", "[object Array]"].includes(Object.prototype.toString.call(value)) || seen.has(value)) throw new Error("De werkruimte bevat niet-opslagbare gegevens.");
    if (Array.isArray(value) && (value.length !== Object.keys(value).length || value.some(item => item === undefined))) throw new Error("De werkruimte bevat niet-opslagbare gegevens.");
    seen.add(value);
    for (const item of Object.values(value)) jsonValue(item, seen);
    seen.delete(value);
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (record(value)) return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
    return value;
  }
  const equal = (a, b) => a === ABSENT || b === ABSENT ? a === b : JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const valueAt = (object, key) => own(object || {}, key) && object[key] !== undefined ? object[key] : ABSENT;
  function name(value, label = "naam") {
    if (typeof value !== "string" || !value.trim() || value.length > 500 || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new Error(`Vul een geldige ${label} in.`);
    return value.trim();
  }
  function projectCopy(input) {
    if (!record(input) || typeof input.name !== "string" || !record(input.standards) || !Array.isArray(input.rows)) throw new Error("Verwacht een leesbaar UDPS-werkblad.");
    name(input.name, "werkbladnaam");
    jsonValue(input);
    const project = clone(input);
    // File context already has its own baseProject in the workspace entry.
    // Keeping it nested in every snapshot would recursively duplicate history.
    if (record(project.sourceData)) delete project.sourceData.studioContext;
    delete project.studioContext;
    for (const value of Object.values(project.standards)) if (typeof value !== "string") throw new Error("Een centrale Revit-standaard is niet leesbaar.");
    if (project.sourceData !== undefined && !record(project.sourceData)) throw new Error("De broncontext van het werkblad is ongeldig.");
    const rawRows = project.sourceData?.rows;
    if (rawRows !== undefined && (!Array.isArray(rawRows) || rawRows.some(row => !record(row)))) throw new Error("De oorspronkelijke bronregels zijn niet leesbaar.");
    if (project.sourceData?.headers !== undefined && (!Array.isArray(project.sourceData.headers) || project.sourceData.headers.some(header => typeof header !== "string"))) throw new Error("De bronkolommen zijn niet leesbaar.");
    const ids = new Set();
    for (const row of project.rows) {
      if (!record(row) || typeof row.id !== "string" || !row.id || ids.has(row.id) || typeof row.key !== "string" || !row.key ||
          ["entity", "propertySet", "name", "type"].some(field => typeof row[field] !== "string") || typeof row.active !== "boolean" ||
          (row.implicitRevit !== undefined && typeof row.implicitRevit !== "boolean") ||
          (row.override != null && typeof row.override !== "string")) throw new Error("Een toepassing is ongeldig of heeft een dubbele identiteit.");
      ids.add(row.id);
      if (typeof UDPSProjectFiles.parameterOf(project, row) !== "string") throw new Error("De effectieve Revit-parameter is niet leesbaar.");
      if (row.sourceIndex !== undefined && (!Number.isInteger(row.sourceIndex) || row.sourceIndex < 0 || !rawRows || row.sourceIndex >= rawRows.length)) throw new Error("Een toepassing verwijst naar ontbrekende broncontext.");
    }
    if (project.removedSourceIndices !== undefined && (!Array.isArray(project.removedSourceIndices) || project.removedSourceIndices.some(index => !Number.isInteger(index) || index < 0 || !rawRows || index >= rawRows.length))) throw new Error("De verwijderde bronregels zijn niet leesbaar.");
    return project;
  }
  const emptyProject = projectName => ({ name: projectName, standards: {}, rows: [] });
  function filtersCopy(filters = {}) {
    if (filters === null) filters = {};
    if (!record(filters)) throw new Error("De werkbladfilters zijn niet leesbaar.");
    jsonValue(filters);
    return clone(filters);
  }
  function workspaceOf(workspace) {
    if (!record(workspace) || workspace.schema !== 1 || !record(workspace.company) || !Array.isArray(workspace.company.versions) || !Array.isArray(workspace.books)) throw new Error("Deze werkruimteversie is niet leesbaar.");
    return workspace;
  }
  const findBook = (workspace, id) => {
    const matches = workspaceOf(workspace).books.filter(book => book.id === id);
    if (matches.length !== 1) throw new Error("Dit werkblad bestaat niet of heeft geen eenduidige identiteit.");
    return matches[0];
  };
  function currentVersion(workspace) {
    const company = workspaceOf(workspace).company;
    if (company.latest === null) return null;
    const found = company.versions.filter(snapshot => snapshot.version === company.latest);
    if (found.length !== 1) throw new Error("De laatste bedrijfsbasis ontbreekt of is niet eenduidig.");
    return found[0];
  }
  const create = () => ({ schema: 1, company: { name: "Bedrijfsstandaard", versions: [], latest: null, concept: null }, books: [] });
  function validate(input) {
    workspaceOf(input);
    jsonValue(input);
    const workspace = clone(input);
    workspace.company.name = name(workspace.company.name, "bedrijfsnaam");
    const versions = new Set();
    workspace.company.versions = workspace.company.versions.map(snapshot => {
      if (!record(snapshot) || typeof snapshot.publishedAt !== "string" || !snapshot.publishedAt) throw new Error("Een bedrijfspublicatie is niet leesbaar.");
      const version = name(snapshot.version, "versie");
      if (versions.has(version)) throw new Error("Deze bedrijfsversie komt meermaals voor.");
      versions.add(version);
      return freeze({ ...snapshot, version, project: projectCopy(snapshot.project) });
    });
    if (workspace.company.latest !== null && (typeof workspace.company.latest !== "string" || !versions.has(workspace.company.latest))) throw new Error("De laatste bedrijfsbasis ontbreekt.");
    const ids = new Set();
    workspace.books = workspace.books.map(book => {
      if (!record(book)) throw new Error("Een werkblad is niet leesbaar.");
      const id = name(book.id, "werkbladidentiteit");
      if (ids.has(id)) throw new Error("Een werkbladidentiteit komt meermaals voor.");
      ids.add(id);
      const project = projectCopy(book.project);
      if (name(book.name, "werkbladnaam") !== project.name.trim()) throw new Error("De werkbladnaam past niet bij de opgeslagen inhoud.");
      if (book.basisVersion !== null && (typeof book.basisVersion !== "string" || !book.basisVersion.trim())) throw new Error("De vastgelegde basisversie is niet leesbaar.");
      if (book.basisVersion !== null && !book.baseProject) throw new Error("De vastgelegde bedrijfsbasis ontbreekt bij het werkblad.");
      if (typeof book.edited !== "string" || !book.edited) throw new Error("Het bewerkmoment van het werkblad ontbreekt.");
      return { ...book, id, name: project.name, project, baseProject: book.baseProject == null ? null : freeze(projectCopy(book.baseProject)), filters: filtersCopy(book.filters) };
    });
    const concept = workspace.company.concept;
    if (concept !== null) {
      if (!record(concept) || !ids.has(concept.fromBookId) || !Array.isArray(concept.changeIds) || concept.changeIds.some(id => typeof id !== "string" || !id)) throw new Error("Het bedrijfsconcept is niet leesbaar.");
      workspace.company.concept = { ...concept, project: projectCopy(concept.project) };
    }
    return workspace;
  }
  function hydrate(value) {
    let input = value;
    if (typeof value === "string") {
      try { input = JSON.parse(value.replace(/^\uFEFF/, "")); }
      catch { throw new Error("Het werkruimtebestand bevat geen geldige JSON."); }
    }
    return validate(input);
  }
  function addBook(workspace, input, options = {}) {
    workspaceOf(workspace);
    const project = projectCopy(input);
    const id = options.id === undefined ? `book-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${workspace.books.length}`}` : name(options.id, "werkbladidentiteit");
    if (workspace.books.some(book => book.id === id)) throw new Error("Deze werkbladidentiteit bestaat al.");
    const basisVersion = options.basisVersion ?? null;
    if (basisVersion !== null) name(basisVersion, "basisversie");
    let baseProject = options.baseProject;
    if (baseProject === undefined && basisVersion !== null) baseProject = workspace.company.versions.find(snapshot => snapshot.version === basisVersion)?.project;
    if (basisVersion !== null && !baseProject) throw new Error("Deze basisversie heeft geen vastgelegde inhoud.");
    const entry = { id, name: project.name, project, basisVersion, baseProject: baseProject == null ? null : freeze(projectCopy(baseProject)), filters: filtersCopy(options.filters), edited: new Date().toISOString() };
    workspace.books.push(entry);
    return entry;
  }
  function upsertBook(workspace, id, input, filters) {
    const entry = findBook(workspace, id), project = projectCopy(input), nextFilters = filters === undefined ? clone(entry.filters) : filtersCopy(filters);
    entry.project = project;
    entry.name = project.name;
    entry.filters = nextFilters;
    entry.edited = new Date().toISOString();
    return entry;
  }
  function publish(workspace, input, value) {
    workspaceOf(workspace);
    const version = name(value, "versie"), project = projectCopy(input);
    if (workspace.company.versions.some(snapshot => snapshot.version === version)) throw new Error("Deze bedrijfsversie is al gepubliceerd.");
    const snapshot = freeze({ version, project, publishedAt: new Date().toISOString() });
    workspace.company.versions.push(snapshot);
    workspace.company.latest = version;
    workspace.company.concept = null;
    return freeze(clone(snapshot));
  }
  function latest(workspace) {
    const snapshot = currentVersion(workspace);
    return snapshot ? freeze(clone(snapshot)) : null;
  }
  function newFromBase(workspace, value) {
    const projectName = name(value, "werkbladnaam"), snapshot = currentVersion(workspace);
    const project = snapshot ? clone(snapshot.project) : emptyProject(projectName);
    project.name = projectName;
    return addBook(workspace, project, { basisVersion: snapshot?.version ?? null, baseProject: snapshot?.project ?? null });
  }

  // Storage keys, raw-row addresses and fallback filenames are not rule semantics.
  function view(project, row) {
    const result = clone(row);
    for (const key of ["key", "sourceIndex", "override", "source"]) delete result[key];
    result.parameter = UDPSProjectFiles.parameterOf(project, row);
    result.standard = own(project.standards, row.key) ? project.standards[row.key] : "";
    result.inherits = row.override == null;
    result.implicitRevit = Boolean(row.implicitRevit);
    result.label = row.label ?? row.name;
    result.classification = row.classification ?? "";
    return result;
  }
  function delta(before, after) {
    const oldRows = new Map(before.rows.map(row => [row.id, view(before, row)]));
    const newRows = new Map(after.rows.map(row => [row.id, view(after, row)]));
    const result = [];
    for (const id of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const a = oldRows.get(id), b = newRows.get(id);
      const fields = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter(key => key !== "id" && !equal(valueAt(a, key), valueAt(b, key)));
      if (fields.length || !a || !b) result.push({ id, kind: !a ? "added" : !b ? "removed" : "changed", fields, before: a || null, after: b || null });
    }
    return result;
  }
  const changes = entry => delta(entry.baseProject || emptyProject(entry.name), entry.project);
  function conflict(list, meta, base, project, company, resolvable = true) {
    list.push({ ...meta, base: base === ABSENT ? null : clone(base), project: project === ABSENT ? null : clone(project), company: company === ABSENT ? null : clone(company), resolvable });
  }
  function mergeValue(base, project, company, list, meta) {
    if (equal(project, base)) return company;
    if (equal(company, base) || equal(project, company)) return project;
    conflict(list, meta, base, project, company);
    return project;
  }
  const projectedColumns = new Set(["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "Mapping_pending", "Uniform_name", "Uniform_revit", "Uniform_property", "Uniform_propertyset", "Uniform_datatype", "Classification", "Studio_application_ids"]);
  function rawEvidence(row) {
    return Object.fromEntries(Object.entries(row || {}).filter(([key]) => !projectedColumns.has(key) && !(key.startsWith("Ifc") && !key.includes("_"))));
  }
  function sourceEvidence(sourceData) {
    if (sourceData === ABSENT) return ABSENT;
    const result = clone(sourceData);
    delete result.studioContext;
    delete result.source;
    delete result.exportOrder;
    if (result.version === 1) delete result.version;
    if (result.mode === "I/T") delete result.mode;
    if (result.skipEmpty === true) delete result.skipEmpty;
    for (const field of ["idsImports", "libraryImports"]) if (Array.isArray(result[field]) && !result[field].length) delete result[field];
    if (Array.isArray(result.rows)) {
      // Saving splits a raw row when applications receive different parameters or
      // flags. Identical source evidence in those variants is still one source.
      const evidence = new Map(result.rows.map(row => {
        const value = rawEvidence(row);
        if (typeof value.Uniform_id === "string" && value.Uniform_id.startsWith("klikmodel:")) delete value.Uniform_id;
        return [JSON.stringify(canonical(value)), value];
      }));
      result.rows = [...evidence].sort(([a], [b]) => a.localeCompare(b)).map(([_key, value]) => value);
      if (result.rows.every(value => !Object.keys(value).length)) delete result.rows;
    }
    if (Array.isArray(result.headers)) {
      result.headers = result.headers.filter(key => key !== "Uniform_id" && !projectedColumns.has(key) && !(key.startsWith("Ifc") && !key.includes("_"))).sort();
      if (!result.headers.length) delete result.headers;
    }
    return Object.keys(result).length ? result : ABSENT;
  }
  function sourceChoice(base, project, company, conflicts) {
    const b = valueAt(base, "sourceData"), p = valueAt(project, "sourceData"), c = valueAt(company, "sourceData");
    const be = sourceEvidence(b), pe = sourceEvidence(p), ce = sourceEvidence(c);
    if (equal(pe, be) && !equal(ce, be)) return { value: c, preferred: company };
    if (equal(ce, be) || equal(pe, ce)) return { value: p, preferred: project };
    conflict(conflicts, { scope: "project", field: "sourceData" }, b, p, c, false);
    return { value: p, preferred: project };
  }
  function rowViews(project) { return new Map(project.rows.map(row => [row.id, view(project, row)])); }
  function mergeRows(base, project, company, conflicts) {
    const b = rowViews(base), p = rowViews(project), c = rowViews(company), result = [];
    for (const id of new Set([...c.keys(), ...p.keys(), ...b.keys()])) {
      const before = b.get(id) || ABSENT, local = p.get(id) || ABSENT, incoming = c.get(id) || ABSENT;
      if (local === ABSENT || incoming === ABSENT) {
        const selected = mergeValue(before, local, incoming, conflicts, { scope: "row", id, field: "presence" });
        if (selected !== ABSENT) result.push(clone(selected));
        continue;
      }
      const row = { id };
      for (const key of new Set([...Object.keys(before === ABSENT ? {} : before), ...Object.keys(local), ...Object.keys(incoming)])) {
        if (key === "id") continue;
        // A local pin remains a project choice when a company version temporarily
        // has the same value. It must not turn into an inherited follower later.
        const pinned = key === "parameter" && before !== ABSENT && before.inherits && !local.inherits &&
          equal(local.parameter, before.parameter) && !equal(incoming.parameter, before.parameter);
        let value;
        if (pinned) {
          conflict(conflicts, { scope: "row", id, field: key }, before.parameter, local.parameter, incoming.parameter);
          value = local.parameter;
        } else value = mergeValue(before === ABSENT ? ABSENT : valueAt(before, key), valueAt(local, key), valueAt(incoming, key), conflicts, { scope: "row", id, field: key });
        if (value !== ABSENT) put(row, key, clone(value));
      }
      result.push(row);
    }
    return result;
  }
  function storageContext(id, projects, sourceData, preferred) {
    const preferredRow = preferred.rows.find(row => row.id === id);
    const originProject = preferredRow ? preferred : projects.find(project => project.rows.some(row => row.id === id));
    const row = preferredRow || originProject?.rows.find(row => row.id === id);
    if (!row || row.sourceIndex === undefined) return { row, index: undefined };
    if (preferredRow) return { row, index: row.sourceIndex };
    const original = originProject.sourceData?.rows?.[row.sourceIndex];
    const rows = sourceData?.rows || [];
    if (original && rows[row.sourceIndex] && equal(rawEvidence(original), rawEvidence(rows[row.sourceIndex]))) return { row, index: row.sourceIndex };
    const matches = original ? rows.map((value, index) => equal(rawEvidence(value), rawEvidence(original)) ? index : -1).filter(index => index >= 0) : [];
    return { row, index: matches.length === 1 ? matches[0] : undefined, missing: matches.length !== 1 };
  }
  function materialize(base, project, company, views, source, conflicts, partial = false) {
    const next = { name: project.name, standards: {}, rows: [] };
    for (const key of new Set([...Object.keys(base), ...Object.keys(project), ...Object.keys(company)])) {
      if (["name", "standards", "rows", "sourceData", "removedSourceIndices"].includes(key)) continue;
      const value = partial ? valueAt(base, key) : mergeValue(valueAt(base, key), valueAt(project, key), valueAt(company, key), conflicts, { scope: "project", field: key });
      if (value !== ABSENT) put(next, key, clone(value));
    }
    if (source.value !== ABSENT) next.sourceData = clone(source.value);
    const exportOrder = partial ? valueAt(base.sourceData, "exportOrder") : mergeValue(valueAt(base.sourceData, "exportOrder"), valueAt(project.sourceData, "exportOrder"), valueAt(company.sourceData, "exportOrder"), conflicts, { scope: "project", field: "sourceData.exportOrder" });
    if (exportOrder !== ABSENT) { next.sourceData ||= {}; next.sourceData.exportOrder = clone(exportOrder); }
    else if (next.sourceData) delete next.sourceData.exportOrder;
    const projects = [project, company, base], grouped = new Map();
    for (const state of views) {
      const context = storageContext(state.id, projects, next.sourceData, source.preferred);
      if (!context.row || context.missing) {
        conflict(conflicts, { scope: "row", id: state.id, field: "sourceIndex" }, ABSENT, context.row || ABSENT, ABSENT, false);
        continue;
      }
      const key = context.row.key;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ state, context });
    }
    const standards = new Map();
    const storageKeys = new Set(projects.flatMap(value => value.rows.map(row => row.key)));
    for (const key of new Set([...Object.keys(base.standards), ...Object.keys(project.standards), ...Object.keys(company.standards)])) {
      if (grouped.has(key)) continue;
      let value;
      if (partial) value = valueAt(base.standards, key);
      else if (storageKeys.has(key)) value = valueAt(project.standards, key) !== ABSENT ? project.standards[key] : valueAt(company.standards, key) !== ABSENT ? company.standards[key] : base.standards[key];
      else value = mergeValue(valueAt(base.standards, key), valueAt(project.standards, key), valueAt(company.standards, key), conflicts, { scope: "project", field: "standards", key });
      if (value !== ABSENT) standards.set(key, clone(value));
    }
    for (const [key, values] of grouped) {
      const candidates = [...new Set(values.map(value => value.state.standard))];
      let standard = candidates[0] ?? "";
      if (candidates.length > 1) {
        const unchanged = partial && values.find(value => {
          const before = base.rows.find(row => row.id === value.state.id);
          return before && view(base, before).standard === value.state.standard;
        });
        standard = unchanged ? unchanged.state.standard : partial && own(base.standards, key) ? base.standards[key] : project.standards[key] ?? standard;
        if (!partial) conflict(conflicts, { scope: "project", field: "standard-group", key }, base.standards[key] ?? "", project.standards[key] ?? "", candidates);
      }
      standards.set(key, standard);
      for (const { state, context } of values) {
        const row = clone(state);
        for (const field of ["parameter", "standard", "inherits"]) delete row[field];
        row.key = key;
        if (context.index !== undefined) row.sourceIndex = context.index;
        if (context.row.source !== undefined) row.source = clone(context.row.source);
        row.override = state.inherits && state.parameter === standard ? null : state.parameter;
        next.rows.push(row);
      }
    }
    next.standards = Object.fromEntries(standards);
    const rowsById = new Map(next.rows.map(row => [row.id, row]));
    next.rows = views.map(value => rowsById.get(value.id)).filter(Boolean);
    const sourceSlots = new Set();
    for (const row of next.rows) if (row.sourceIndex !== undefined) {
      const slot = JSON.stringify([row.sourceIndex, row.entity]);
      if (sourceSlots.has(slot)) conflict(conflicts, { scope: "row", id: row.id, field: "sourceIndex" }, ABSENT, row.sourceIndex, ABSENT, false);
      sourceSlots.add(slot);
    }
    const live = new Set(next.rows.map(row => row.sourceIndex).filter(index => index !== undefined));
    const removed = new Set(source.preferred.removedSourceIndices || []);
    const liveIds = new Set(next.rows.map(row => row.id));
    for (const row of projects.flatMap(value => value.rows)) if (!liveIds.has(row.id)) {
      const context = storageContext(row.id, projects, next.sourceData, source.preferred);
      if (context.index !== undefined && !context.missing) removed.add(context.index);
    }
    for (const index of live) removed.delete(index);
    if (removed.size || projects.some(value => own(value, "removedSourceIndices"))) next.removedSourceIndices = [...removed].sort((a, b) => a - b);
    return conflicts.some(value => !value.resolvable) ? null : projectCopy(next);
  }
  function threeWay(base, project, company) {
    const conflicts = [];
    const source = sourceChoice(base, project, company, conflicts);
    const views = mergeRows(base, project, company, conflicts);
    const nextProject = materialize(base, project, company, views, source, conflicts);
    return { nextProject, conflicts };
  }
  function previewUpdate(workspace, id) {
    const entry = findBook(workspace, id), snapshot = currentVersion(workspace);
    if (!snapshot) throw new Error("Er is nog geen bedrijfsbasis gepubliceerd.");
    const base = entry.baseProject || emptyProject(entry.name);
    const result = threeWay(base, entry.project, snapshot.project);
    return { fromVersion: entry.basisVersion, toVersion: snapshot.version, ...result,
      changes: delta(result.nextProject ? entry.project : base, result.nextProject || snapshot.project) };
  }
  function applyUpdate(workspace, id, options = {}) {
    const entry = findBook(workspace, id), preview = previewUpdate(workspace, id);
    if (preview.conflicts.some(conflict => !conflict.resolvable)) throw new Error("De broncontext kan niet veilig worden samengevoegd. Stem de bronnen eerst afzonderlijk af.");
    if (preview.conflicts.length && options.keepProject !== true) throw new Error("Bevestig expliciet dat bij deze conflicten de projectkeuzes behouden blijven.");
    const snapshot = currentVersion(workspace);
    entry.project = clone(preview.nextProject);
    entry.name = entry.project.name;
    entry.baseProject = freeze(clone(snapshot.project));
    entry.basisVersion = snapshot.version;
    entry.edited = new Date().toISOString();
    return entry;
  }
  function prepareConcept(workspace, id, selectedIds) {
    const entry = findBook(workspace, id), snapshot = currentVersion(workspace), differences = changes(entry);
    if (!snapshot && selectedIds === undefined) return { project: projectCopy(entry.project), changes: differences, conflicts: [] };
    if (!selectedIds || typeof selectedIds === "string" || typeof selectedIds[Symbol.iterator] !== "function") throw new Error("Kies één of meer projectverschillen voor het bedrijfsconcept.");
    const selected = new Set(selectedIds), known = new Set(differences.map(change => change.id));
    if (!selected.size || [...selected].some(value => !known.has(value))) throw new Error("Kies bestaande projectverschillen voor het bedrijfsconcept.");
    const chosen = differences.filter(change => selected.has(change.id));
    const base = entry.baseProject || emptyProject(entry.name);
    const localViews = rowViews(entry.project), baseViews = rowViews(base), views = [];
    for (const rowId of new Set([...baseViews.keys(), ...localViews.keys()])) {
      const value = selected.has(rowId) ? localViews.get(rowId) : baseViews.get(rowId);
      if (value) views.push(clone(value));
    }
    const conflicts = [];
    const partial = materialize(base, base, entry.project, views, { value: valueAt(entry.project, "sourceData"), preferred: entry.project }, conflicts, true);
    if (!partial) return { project: null, changes: chosen, conflicts };
    const target = snapshot?.project || emptyProject(entry.name);
    const merged = threeWay(base, partial, target);
    if (merged.nextProject && snapshot) merged.nextProject.name = snapshot.project.name;
    return { project: merged.nextProject, changes: chosen, conflicts: [...conflicts, ...merged.conflicts] };
  }

  globalThis.UDPSStudioWorkspace = Object.freeze({ create, validate, hydrate, addBook, upsertBook, changes, publish, latest, newFromBase, previewUpdate, applyUpdate, prepareConcept });
})();
