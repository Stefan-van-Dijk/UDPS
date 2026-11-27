// Studio UI over the production domain modules. Source notices: production/provenance.json and LICENSE.
const UDPSStudioSources = (() => {
  const base = new URL("./production/", document.currentScript?.src || document.baseURI);
  const bytes = value => new TextEncoder().encode(value).length;
  let production;
  async function loadProduction() {
    if (!production) production = (async () => {
      const names = ["bsdd", "products", "property-loader", "mapping", "libraries", "view", "sources", "uniform", "core"];
      const modules = await Promise.all(names.map(name => import(new URL(`${name}.js?v=1.12.1`, base).href)));
      const domain = Object.fromEntries(names.map((name, i) => [name, modules[i]]));
      // Accept the verified Revit spelling alongside the production schema's historical aliases.
      for (const code of ["ElectricCurrent", "ElectricVoltage"]) if (!domain.core.types.includes(code)) domain.core.types.push(code);
      const [catalog, snapshot] = await Promise.all(["catalog.json", "relations.json"].map(async name => {
        const response = await fetch(new URL(name, base));
        if (!response.ok) throw Error(`Meegeleverde brongegevens niet beschikbaar (${response.status}).`);
        return response.json();
      }));
      return { ...domain, catalog: domain.sources.validateCatalog(catalog), snapshot };
    })().catch(error => { production = null; throw error; });
    return production;
  }

  return function UDPSStudioSources({ getProject, showDialog, dialog, escapeHtml: esc, message = () => {}, complete, downloadFile, loadDomain = loadProduction }) {
    let domain, cache, draft, generation = 0;
    const showSourceDialog = markup => showDialog(markup, { replace: true });
    const ready = async () => {
      domain ||= await loadDomain();
      for (const code of ["ElectricCurrent", "ElectricVoltage"]) if (!domain.core.types.includes(code)) domain.core.types.push(code);
      cache ||= structuredClone(domain.snapshot || { registry: [], products: {}, relations: {}, details: {} });
      return domain;
    };
    const cancel = '<button type="button" class="button" data-action="cancel">Annuleren</button>';
    const button = (action, label, value = "", primary = false) => `<button type="button" class="${primary ? "button primary" : "button"}" data-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;
    const errorMarkup = '<p class="form-error" role="alert" hidden></p>';
    const report = (form, error) => { const node = form?.querySelector(".form-error"); if (node) { node.textContent = error.message || String(error); node.hidden = false; } };
    const formOf = id => dialog.querySelector(`#${id}`);
    const current = (ticket, form, origin) => ticket === generation && dialog.open && form?.isConnected && formOf(form.id) === form && getProject() === origin;
    const rawOf = project => project ? JSON.parse(UDPSProjectFiles.save(project)) : {
      version: 1, source: "Nieuw werkblad", headers: ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type"], rows: [], mode: "I/T", skipEmpty: true
    };
    const signature = project => project ? UDPSProjectFiles.save(project) : "";
    const invalidate = () => { generation++; draft = null; };
    dialog.addEventListener("close", invalidate);
    dialog.addEventListener("cancel", invalidate);
    dialog.addEventListener("udps:dialog-back", invalidate);

    async function planImport(entries, revit = "") {
      const origin = getProject(), original = signature(origin);
      const d = await ready();
      if (getProject() !== origin || signature(origin) !== original) throw Error("Het werkblad is gewijzigd. Open de bron opnieuw.");
      if (!Array.isArray(entries) || !entries.length || entries.some(entry => !entry.selection?.entity)) throw Error("Selecteer eigenschappen met een bevestigde IFC-toepassing.");
      if (typeof revit !== "string" || revit.length > 500 || /[\t\r\n]/.test(revit)) throw Error("Gebruik een Revit-naam van maximaal 500 tekens zonder tabs of regeleinden.");
      const raw = rawOf(origin), result = d.mapping.addMappings(raw, d.catalog, entries, revit.trim());
      const reopened = UDPSProjectFiles.open(JSON.stringify(raw), "bSDD-project.json");
      if (bytes(UDPSProjectFiles.save(reopened)) > 32 * 1024 * 1024) throw Error("Deze selectie maakt het werkblad groter dan 32 MiB.");
      return { raw, origin, original, result, entries, revit: revit.trim() };
    }
    async function libraryOf({ name, version, id }) {
      const origin = getProject();
      if (!origin) throw Error("Open eerst een werkblad.");
      const original = signature(origin), raw = rawOf(origin), d = await ready();
      if (getProject() !== origin || signature(origin) !== original) throw Error("Het werkblad is gewijzigd. Open de bibliotheekexport opnieuw.");
      return d.libraries.projectLibrary(raw, name, version, id);
    }

    async function open() {
      const origin = getProject(), ticket = ++generation;
      showSourceDialog(`<form id="studio-bsdd-loading"><h2 id="dialog-title">bSDD-bronnen openen</h2><p class="small muted">Meegeleverde bronlijst laden…</p>${errorMarkup}<div class="dialog-actions">${cancel}${button("bsdd-open", "Opnieuw proberen")}</div></form>`);
      const form = formOf("studio-bsdd-loading");
      try {
        await ready();
        if (!current(ticket, form, origin)) return;
        draft = { origin, route: "product", source: domain.sources.ILS, entity: "IfcDoor", query: "", kind: "all", items: [], entries: [], selected: new Set(), propertyQuery: "", revit: "", notice: "Meegeleverde bronlijst. Gebruik Actualiseren om de bron opnieuw op te halen.", stage: "browser" };
        const known = new Set(domain.mapping.availableEntities(domain.catalog).map(item => item.code));
        draft.entity = origin?.rows.find(row => known.has(row.entity))?.entity || "IfcDoor";
        renderBrowser();
        return loadClasses(false);
      } catch (error) { if (current(ticket, form, origin)) report(form, error); }
    }
    function sourceOptions() {
      const registry = [...(cache.registry || [])];
      for (const source of domain.bsdd.defaults) if (!registry.some(item => item.uri === source.uri)) registry.push(source);
      return domain.view.groupSources(registry).map(group => `<optgroup label="${esc(group.name)}">${group.versions.map(source => `<option value="${esc(source.uri)}"${draft.source === source.uri ? " selected" : ""}>${esc(group.name)} · ${esc(source.version || "zonder versie")}</option>`).join("")}</optgroup>`).join("");
    }
    function renderBrowser() {
      if (!draft) return;
      draft.stage = "browser";
      const product = draft.route === "product";
      showSourceDialog(`<form id="studio-bsdd-browser"><h2 id="dialog-title">Eigenschappen uit bSDD</h2><div class="dialog-fields">
        <label class="field">Bron en versie<select id="studio-bsdd-source" name="source">${sourceOptions()}</select></label>
        <div class="buttons">${button("bsdd-route", "Via bouwproduct", "product", product)}${button("bsdd-route", "Via IFC-entiteit", "ifc", !product)}${button("bsdd-registry", "Bronlijst actualiseren")}</div>
        ${product ? `<div class="form-row"><label class="field">Zoek bouwproduct<input id="studio-bsdd-query" name="query" type="search" value="${esc(draft.query)}"></label><label class="field">Soort<select id="studio-bsdd-kind"><option value="all">Alle soorten</option>${[...new Set(draft.items.map(item => item.classType || "Class"))].map(kind => `<option value="${esc(kind)}"${draft.kind === kind ? " selected" : ""}>${esc(domain.products.classTypeName(kind))}</option>`).join("")}</select></label></div>` : `<label class="field">IFC-entiteit<select id="studio-bsdd-entity">${domain.mapping.availableEntities(domain.catalog).map(item => `<option${draft.entity === item.code ? " selected" : ""}>${esc(item.code)}</option>`).join("")}</select></label>`}
        <p class="small muted" role="status">${esc(draft.notice)}</p>${errorMarkup}<div class="ids-proposals" id="studio-bsdd-results">${classResults()}</div>
      </div><div class="dialog-actions">${cancel}${button("bsdd-load", "Laden")}${button("bsdd-refresh", "Actualiseren")}</div></form>`);
    }
    function classResults() {
      const items = draft.route === "product" ? domain.products.searchProducts(draft.items, draft.query, draft.kind) : draft.items;
      return `${items.length ? `<p class="small muted">${items.length} bronklassen${items.length > 80 ? " · eerste 80 getoond; verfijn je zoekopdracht" : ""}</p>` : '<p class="small muted">Geen bronklassen beschikbaar. Kies Laden of wijzig je zoekopdracht.</p>'}${items.slice(0, 80).map(item => `<div class="ids-proposal"><div><strong>${esc(item.name || item.code)}</strong><small>${esc(item.code)} · ${esc(domain.products.classTypeName(item.classType))}</small></div>${button("bsdd-choose", "Bekijken", item.uri)}</div>`).join("")}`;
    }
    const offline = "Meegeleverde/opgeslagen momentopname; actualiteit niet bevestigd.";
    async function getProducts(source, refresh = false) {
      cache.products ||= {};
      if (!refresh && cache.products[source]?.productsSchema === 2) return { ...cache.products[source], loadWarning: offline };
      try { return cache.products[source] = await domain.bsdd.dictionaryProducts(source); }
      catch (error) { if (!cache.products[source]) throw error; return { ...cache.products[source], loadWarning: `${error.message} ${offline}` }; }
    }
    async function getClasses(source, entity, refresh = false) {
      cache.relations ||= {};
      const key = domain.bsdd.relationshipKey(source, entity);
      if (!refresh && cache.relations[key]?.relationSchema === 2) return { ...cache.relations[key], loadWarning: offline };
      try { return cache.relations[key] = await domain.bsdd.relatedClasses(source, entity); }
      catch (error) { if (!cache.relations[key]) throw error; return { ...cache.relations[key], loadWarning: `${error.message} ${offline}` }; }
    }
    async function getDetails(uri, refresh = false) {
      cache.details ||= {};
      if (!refresh && cache.details[uri]?.propertySchema === 5) return { ...cache.details[uri], loadWarning: offline };
      try { return cache.details[uri] = await domain.bsdd.classDetails(uri); }
      catch (error) { if (!cache.details[uri]) throw error; return { ...cache.details[uri], loadWarning: `${error.message} ${offline}` }; }
    }
    async function loadClasses(refresh) {
      if (!draft) return;
      const active = draft, origin = active.origin, ticket = ++generation;
      active.notice = "Bronklassen laden…"; active.items = []; renderBrowser();
      const form = formOf("studio-bsdd-browser");
      try {
        const result = active.route === "product" ? await getProducts(active.source, refresh) : await getClasses(active.source, active.entity, refresh);
        if (!current(ticket, form, origin) || draft !== active) return;
        active.items = result.items; active.related = active.route === "ifc" ? result : null;
        active.version = result.version; active.refresh = refresh;
        active.notice = result.loadWarning || "Bronklassen uit bSDD geladen.";
        renderBrowser();
      } catch (error) { if (current(ticket, form, origin)) { active.notice = error.message; renderBrowser(); report(formOf("studio-bsdd-browser"), error); } }
    }
    async function refreshRegistry() {
      if (!draft) return;
      const active = draft, origin = active.origin, form = formOf("studio-bsdd-browser"), ticket = ++generation;
      try {
        const registry = await domain.bsdd.dictionaries();
        if (!current(ticket, form, origin) || draft !== active) return;
        cache.registry = registry; active.notice = "Bronlijst uit bSDD geladen."; renderBrowser();
      } catch (error) { if (current(ticket, form, origin)) report(form, error); }
    }
    async function choose(uri) {
      if (!draft) return;
      const active = draft, origin = active.origin, ticket = ++generation;
      const product = active.items.find(item => item.uri === uri) || active.context?.find(item => item.uri === uri);
      if (!product) return;
      active.notice = "Eigenschappen laden…"; renderBrowser();
      const form = formOf("studio-bsdd-browser");
      try {
        const detail = await getDetails(uri, active.refresh);
        if (!current(ticket, form, origin) || draft !== active) return;
        let selections, warnings = [];
        if (active.route === "ifc") {
          selections = [{ source: active.source, entity: active.entity, version: active.related.version, classes: active.related.items, class: product, ifcTargets: active.related.ifcTargets }];
        } else ({ selections, warnings } = await domain.products.productSelections(product, active.source, detail, domain.catalog, (source, entity) => getClasses(source, entity, active.refresh)));
        if (!current(ticket, form, origin) || draft !== active) return;
        const result = await domain["property-loader"].collectProperties(selections, () => Promise.resolve(detail), { isCurrent: () => current(ticket, form, origin) && draft === active });
        if (!result || !current(ticket, form, origin) || draft !== active) return;
        active.entries = result.entries;
        if (!selections.length) active.entries = detail.properties.filter(item => item.valueKind === "Single").map(item => ({ item, selection: { source: active.source, entity: "", version: active.version, detail } }));
        active.reports = result.reports; active.selected = new Set(); active.propertyQuery = ""; active.product = product; active.detail = detail;
        active.notice = [...new Set([detail.loadWarning, ...warnings, ...result.reports.map(report => report.error || report.warning)].filter(Boolean))].join(" ") || "Bronrelaties gecontroleerd voor de beschikbare IFC-toepassingen.";
        active.context = [...(detail.hierarchy || []).filter(item => item.uri !== uri), ...(detail.childClassReferences || [])];
        renderProperties();
      } catch (error) { if (current(ticket, form, origin)) report(form, error); }
    }
    function matchingEntries() {
      const q = draft.propertyQuery.toLocaleLowerCase("nl");
      return draft.entries.map((entry, index) => ({ ...entry, index })).filter(({ item, selection }) => [item.name, item.code, item.propertySet, item.className, selection.entity].some(value => String(value || "").toLocaleLowerCase("nl").includes(q)));
    }
    function propertyResults() {
      const entries = matchingEntries(), indices = new Set(entries.map(entry => entry.index));
      return domain.uniform.groupEntries(draft.entries).filter(group => group.entries.some(entry => indices.has(entry.index))).slice(0, 200).map(group => {
        const applications = group.entries.filter(entry => indices.has(entry.index)), selectable = applications.filter(entry => entry.selection.entity), selected = selectable.filter(entry => draft.selected.has(entry.index)).length;
        const item = group.item;
        return `<div class="ids-proposal"><label><input type="checkbox" data-bsdd-group="${selectable.map(entry => entry.index).join(",")}"${selectable.length && selected === selectable.length ? " checked" : ""}${!selectable.length ? " disabled" : ""}><span><strong>${esc(item.name || item.code)}</strong><small>${esc(item.propertySet)} · ${esc(item.code)} · ${esc(item.dataType || "datatype niet opgegeven")}</small><small>${esc([...new Set(applications.map(entry => entry.selection.entity || "Geen bevestigde IFC-toepassing"))].join(", "))}</small></span></label><details><summary class="small">Brongegevens en toepassingen</summary><p class="small">${esc(item.description || "Geen omschrijving.")}</p><p class="small">Eenheden: ${esc((item.units || []).join(", ") || "niet opgegeven")}</p>${(item.allowedValues || []).length ? `<p class="small">Keuzewaarden: ${esc(item.allowedValues.map(value => value.value ?? value.code ?? String(value)).join(", "))}</p>` : ""}${Object.keys(item.constraints || {}).length ? `<p class="small">Beperkingen: ${esc(JSON.stringify(item.constraints))}</p>` : ""}${applications.map(entry => `<label class="small"><input type="checkbox" data-bsdd-property="${entry.index}"${draft.selected.has(entry.index) ? " checked" : ""}${!entry.selection.entity ? " disabled" : ""}>${esc(entry.selection.entity || "Alleen bekijken")} · ${esc(entry.item.className || "")} · ${esc(entry.item.propertySet)}</label>`).join("")}</details></div>`;
      }).join("") || '<p class="small muted">Geen eigenschappen voor deze zoekopdracht.</p>';
    }
    function renderProperties() {
      if (!draft) return;
      draft.stage = "properties";
      const excluded = (draft.reports || []).flatMap(report => report.excluded || []);
      showSourceDialog(`<form id="studio-bsdd-properties"><h2 id="dialog-title">${esc(draft.product.name || draft.product.code)}</h2><p class="small muted">${esc(draft.notice)}</p>${!draft.entries.some(entry => entry.selection.entity) ? '<p class="form-error">Geen bevestigde IFC-relatie. De eigenschappen zijn alleen te bekijken.</p>' : ""}
        ${draft.context?.length ? `<details><summary>Verwante bronklassen</summary><div class="buttons">${draft.context.slice(0, 30).map(item => button("bsdd-choose", item.name || item.code || item.uri, item.uri)).join("")}</div><p class="small muted">Een verwante klasse openen neemt geen eigenschappen automatisch over.</p></details>` : ""}
        ${excluded.length ? `<details><summary>${excluded.length} bronitems niet geschikt voor UDPS</summary>${excluded.map(item => `<p class="small">${esc(item.name)}: ${esc(item.reason)}</p>`).join("")}</details>` : ""}
        <label class="field">Zoek eigenschappen<input id="studio-bsdd-property-query" type="search" value="${esc(draft.propertyQuery)}"></label><div class="buttons">${button("bsdd-select-all", "Selecteer zoekresultaten")}${button("bsdd-select-none", "Wis selectie")}</div>
        <div class="ids-proposals" id="studio-bsdd-properties-list">${propertyResults()}</div><p class="small muted" id="studio-bsdd-count">${draft.selected.size} geselecteerd · ${draft.entries.length} toepassingen</p>
        <label class="field">Revit-parameter voor nieuwe koppelingen (optioneel)<input name="revit" id="studio-bsdd-revit" maxlength="500" value="${esc(draft.revit)}"><small>Leeg laat nieuwe koppelingen open. Bestaande namen blijven behouden.</small></label>${errorMarkup}<div class="dialog-actions">${button("bsdd-back", "Terug")}${cancel}<button class="button primary" type="submit"${draft.selected.size ? "" : " disabled"}>Wijzigingen controleren</button></div></form>`);
    }
    function updateProperties() {
      const list = dialog.querySelector("#studio-bsdd-properties-list");
      if (!list || !draft) return;
      list.innerHTML = propertyResults();
      dialog.querySelector("#studio-bsdd-count").textContent = `${draft.selected.size} geselecteerd · ${draft.entries.length} toepassingen`;
      formOf("studio-bsdd-properties").querySelector('[type="submit"]').disabled = !draft.selected.size;
    }
    async function preview(form) {
      const active = draft, origin = active.origin, ticket = ++generation;
      try {
        if (getProject() !== origin) throw Error("Het werkblad is gewijzigd. Open de bron opnieuw.");
        active.revit = form.elements.revit.value;
        const plan = await planImport([...active.selected].map(index => active.entries[index]), active.revit);
        if (!current(ticket, form, origin) || draft !== active) return;
        active.plan = plan; active.stage = "preview";
        showSourceDialog(`<form id="studio-bsdd-preview"><h2 id="dialog-title">Toevoeging controleren</h2><p>${plan.result.added} nieuwe regels · ${plan.result.skipped} bestaande combinaties behouden.</p><p class="small muted">Bronidentiteit, bronklasse, versie en voorwaarden blijven bij de koppelingen bewaard. Bronvoorwaarden worden niet door UDPS afgedwongen.</p><div class="ids-proposals">${plan.entries.map(({ item, selection }) => `<div class="ids-proposal"><div><strong>${esc(item.name || item.code)}</strong><small>${esc(selection.entity)} · ${esc(item.propertySet)} · ${esc(item.code)}</small></div></div>`).join("")}</div>${errorMarkup}<div class="dialog-actions">${button("bsdd-properties", "Terug")}${cancel}<button class="button primary" type="submit">Toevoegen aan werkblad</button></div></form>`);
      } catch (error) { if (current(ticket, form, origin)) report(form, error); }
    }
    async function apply(form) {
      const active = draft, origin = getProject(), ticket = ++generation;
      if (!active?.plan) return;
      try {
        if (origin !== active.plan.origin || signature(origin) !== active.plan.original) throw Error("Het werkblad is gewijzigd. Controleer de toevoeging opnieuw.");
        const plan = await planImport(active.plan.entries, active.plan.revit);
        if (!current(ticket, form, origin) || draft !== active) return;
        if (JSON.stringify(plan.raw) !== JSON.stringify(active.plan.raw)) throw Error("De toevoeging is gewijzigd. Controleer de selectie opnieuw.");
        const result = await complete(plan.raw, origin ? "add" : "new");
        if (result === false) return;
        if (form.isConnected && dialog.open && formOf(form.id) === form) dialog.close();
        message(`${plan.result.added} bSDD-regels toegevoegd; ${plan.result.skipped} bestaande combinaties behouden.`);
      } catch (error) { if (form.isConnected) report(form, error); }
    }
    function exportLibrary() {
      const project = getProject();
      if (!project) return message("Open eerst een werkblad.");
      generation++;
      const id = project.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "udps-bibliotheek";
      showSourceDialog(`<form id="studio-library-export"><h2 id="dialog-title">Werkblad als bibliotheek</h2><p class="small muted">Alle gekoppelde eigenschappen, ook uitgeschakelde. Revit-namen en exportkeuzes blijven alleen in je projectbestand.</p><div class="dialog-fields"><label class="field">Naam<input name="name" required maxlength="500" value="${esc(project.name)}"></label><label class="field">Versie<input name="version" required maxlength="500" value="1.0"></label><label class="field">Bibliotheek-id<input name="library-id" required maxlength="500" pattern="(?:[a-zA-Z0-9_]|-)+" value="${esc(id)}"></label>${errorMarkup}</div><div class="dialog-actions">${cancel}<button class="button primary" type="submit">Bibliotheek downloaden</button></div></form>`);
    }
    async function submitLibrary(form) {
      const origin = getProject(), ticket = ++generation;
      try {
        const fields = Object.fromEntries(new FormData(form));
        const library = await libraryOf({ ...fields, id: fields["library-id"] });
        if (!current(ticket, form, origin)) return;
        downloadFile(new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }), `${library.id}-${library.version.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
        dialog.close(); message("Bibliotheek gedownload.");
      } catch (error) { if (current(ticket, form, origin)) report(form, error); }
    }
    dialog.addEventListener("input", event => {
      if (!draft) return;
      const input = event.target;
      if (input.id === "studio-bsdd-query") { draft.query = input.value; dialog.querySelector("#studio-bsdd-results").innerHTML = classResults(); }
      if (input.id === "studio-bsdd-property-query") { draft.propertyQuery = input.value; updateProperties(); }
      if (input.id === "studio-bsdd-revit") draft.revit = input.value;
    });
    dialog.addEventListener("change", event => {
      if (!draft) return;
      const input = event.target;
      if (input.id === "studio-bsdd-source") { generation++; draft.source = input.value; draft.query = ""; draft.kind = "all"; void loadClasses(false); }
      if (input.id === "studio-bsdd-entity") { generation++; draft.entity = input.value; void loadClasses(false); }
      if (input.id === "studio-bsdd-kind") { draft.kind = input.value; dialog.querySelector("#studio-bsdd-results").innerHTML = classResults(); }
      const indices = input.dataset.bsddGroup !== undefined ? input.dataset.bsddGroup.split(",").filter(Boolean).map(Number) : input.dataset.bsddProperty !== undefined ? [Number(input.dataset.bsddProperty)] : null;
      if (indices) { for (const index of indices) if (draft.entries[index]?.selection.entity) input.checked ? draft.selected.add(index) : draft.selected.delete(index); updateProperties(); }
    });
    return {
      actions: {
        "bsdd-open": open,
        "bsdd-load": () => loadClasses(false), "bsdd-refresh": () => loadClasses(true), "bsdd-registry": refreshRegistry,
        "bsdd-route": route => { if (!draft || !["product", "ifc"].includes(route)) return; draft.route = route; draft.query = ""; draft.kind = "all"; return loadClasses(false); },
        "bsdd-choose": choose,
        "bsdd-back": () => { generation++; renderBrowser(); }, "bsdd-properties": () => { generation++; renderProperties(); },
        "bsdd-select-all": () => { if (!draft) return; for (const entry of matchingEntries()) if (entry.selection.entity) draft.selected.add(entry.index); updateProperties(); },
        "bsdd-select-none": () => { if (!draft) return; draft.selected.clear(); updateProperties(); },
        "library-export": exportLibrary
      },
      handleSubmit(form) {
        if (["studio-bsdd-properties", "studio-bsdd-preview"].includes(form.id) && (!draft || getProject() !== draft.origin)) {
          report(form, Error("Deze bronselectie is niet meer actief. Open de bSDD-bron opnieuw."));
          return true;
        }
        if (form.id === "studio-bsdd-properties") { void preview(form); return true; }
        if (form.id === "studio-bsdd-preview") { void apply(form); return true; }
        if (form.id === "studio-library-export") { void submitLibrary(form); return true; }
        return form.id === "studio-bsdd-browser" || form.id === "studio-bsdd-loading";
      },
      async readExcel(file) {
        if (!file || !/\.(xlsx|xlsm)$/i.test(file.name || "") || !Number.isFinite(file.size) || file.size < 0 || file.size > 20 * 1024 * 1024) throw Error("Kies een Excelbestand (.xlsx/.xlsm) van maximaal 20 MiB met tabel ILS_Gevel.");
        const module = await import(new URL("excel.js?v=1.12.1", base).href);
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength > 20 * 1024 * 1024) throw Error("Het Excelbestand is groter dan 20 MiB.");
        return module.readExcel(buffer, file.name);
      },
      planImport,
      libraryOf
    };
  };
})();
