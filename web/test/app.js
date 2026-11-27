(function prototypeApp() {
  "use strict";

  const storageKey = window.UDPS_STUDIO_STORAGE_NAMESPACE || "udps-studio-klikmodel-v2";
  const filterStorageKey = `${storageKey}:filters`;
  const maxProjectBytes = 32 * 1024 * 1024;
  const entities = [
    { code: "IfcDoor", label: "Deuren", propertySet: "Pset_DoorCommon" },
    { code: "IfcWindow", label: "Ramen", propertySet: "Pset_WindowCommon" },
    { code: "IfcCurtainWall", label: "Vliesgevels", propertySet: "Pset_CurtainWallCommon" },
    { code: "IfcPlate", label: "Platen", propertySet: "Pset_PlateCommon" },
    { code: "IfcFlowTerminal", label: "Aansluitpunten" },
    { code: "IfcMember", label: "Liggers en staven", propertySet: "Pset_MemberCommon" },
    { code: "IfcDiscreteAccessory", label: "Toebehoren", propertySet: "Pset_DiscreteAccessoryCommon" },
    { code: "IfcCovering", label: "Afwerkingen", propertySet: "Pset_CoveringCommon" },
    { code: "IfcObject", label: "Objecten" },
    { code: "IfcWall", label: "Wanden", propertySet: "Pset_WallCommon" }
  ];
  const types = {
    Text: "Tekst",
    Boolean: "Ja/nee",
    ThermalTransmittance: "Warmtedoorgang",
    Real: "Getal",
    Length: "Lengte",
    Area: "Oppervlakte",
    Integer: "Geheel getal",
    Label: "Tekstlabel", Identifier: "Identificatie", Logical: "Logische waarde",
    PositiveLength: "Positieve lengte", Volume: "Volume", MassDensity: "Massadichtheid",
    Count: "Aantal", PlaneAngle: "Hoek", PositivePlaneAngle: "Positieve hoek",
    Ratio: "Verhouding", PositiveRatio: "Positieve verhouding", NormalisedRatio: "Genormaliseerde verhouding",
    ThermodynamicTemperature: "Temperatuur", Power: "Vermogen", Pressure: "Druk", Frequency: "Frequentie",
    Force: "Kracht", VolumetricFlowRate: "Volumestroom", ElectricCurrent: "Elektrische stroom",
    ElectricVoltage: "Spanning", Illuminance: "Verlichtingssterkte", LuminousFlux: "Lichtstroom",
    LuminousIntensity: "Lichtsterkte", ColorTemperature: "Kleurtemperatuur", Currency: "Valuta",
    ElectricalEfficacy: "Lichtrendement", ClassificationReference: "Classificatieverwijzing"
  };

  function makeRow(id, entity, propertySet, name, label, type, key = id, source = "Voorbeeldconfiguratie") {
    return { id, entity, propertySet, name, label, type, key, source, override: null, active: true };
  }

  function demoProject() {
    return {
      name: "Gevel · basisconfiguratie",
      standards: {
        fire: "Brandwerendheid",
        acoustic: "Geluidsisolatie",
        windowThermal: "U-waarde kozijn",
        wallExternal: "Is buitenwand",
        glazing: "Beglazingsaandeel",
        asset: "Merkteken"
      },
      rows: [
        makeRow("door-fire", "IfcDoor", "Pset_DoorCommon", "FireRating", "Brandwerendheid", "Text", "fire"),
        makeRow("door-acoustic", "IfcDoor", "Pset_DoorCommon", "AcousticRating", "Geluidsisolatie", "Text", "acoustic"),
        makeRow("door-thermal", "IfcDoor", "Pset_DoorCommon", "ThermalTransmittance", "Warmtedoorgang", "ThermalTransmittance"),
        makeRow("door-mark", "IfcDoor", "Pset_Identity", "Mark", "Merkteken", "Text", "asset", "Eigen propertyset"),
        makeRow("window-thermal", "IfcWindow", "Pset_WindowCommon", "ThermalTransmittance", "Warmtedoorgang", "ThermalTransmittance", "windowThermal"),
        makeRow("window-glazing", "IfcWindow", "Pset_WindowCommon", "GlazingAreaFraction", "Beglazingsaandeel", "Real", "glazing"),
        makeRow("wall-external", "IfcWall", "Pset_WallCommon", "IsExternal", "Buitenwand", "Boolean", "wallExternal"),
        makeRow("wall-fire", "IfcWall", "Pset_WallCommon", "FireRating", "Brandwerendheid", "Text", "fire")
      ]
    };
  }

  const root = document.getElementById("app");
  const dialog = document.getElementById("dialog");
  const notice = document.getElementById("notice");
  const homeLink = document.getElementById("home-link");
  const matrixViewport = window.matchMedia("(min-width: 900px)");
  const matrixColumnMinWidth = 83;
  let noticeTimer;
  let dialogTrigger;
  let pendingProject;
  let pendingEditorAction;
  let afterDialogClose;
  let dialogTrail = [];
  let dialogRoute = "";
  let entityPickerState = null;
  let sourceInspection = false;
  let idsModule;
  let lastRemoval = null;
  let lastSourceRemoval = null;

  function largeProject() {
    return {
      name: "Gevel · groot voorbeeldproject",
      standards: Object.fromEntries(UDPS_LARGE_EXAMPLE.map(definition => [definition.key, definition.parameter])),
      rows: UDPS_LARGE_EXAMPLE.flatMap(definition => definition.applications.map(entity =>
        makeRow(`${definition.key}-${entity}`, entity, definition.propertySet, definition.name,
          definition.name, definition.type, definition.key, "Meegeleverd UDPS-voorbeeldproject")
      ))
    };
  }

  function readSavedProject() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      const versioned = stored?.version === 2 || stored?.version === 3;
      const project = versioned ? stored.project : stored;
      if (!project || typeof project.name !== "string" || !Array.isArray(project.rows) || !project.standards) return null;
      if (!versioned) {
        for (const row of project.rows) if (row.override === "") row.override = null;
      }
      const saved = { project, token: stored?.token, filters: stored?.filters };
      try {
        const view = JSON.parse(localStorage.getItem(filterStorageKey));
        if (saved.token && view?.token === saved.token) saved.filters = view.filters;
      } catch {
        // The project can still open with the filters from its snapshot.
      }
      return saved;
    } catch {
      // The example is also available when browser storage is unavailable.
    }
    return null;
  }

  const state = {
    view: "start",
    project: null,
    saved: readSavedProject(),
    projectHasSnapshot: false,
    ifcSelection: new Set(),
    entitiesExpanded: false,
    propertySet: "",
    expanded: new Set(),
    collapsedSets: new Set(),
    review: null,
    panel: "",
    exportPreviewOpen: false,
    editor: null,
    search: "",
    sourceRuleFilter: "",
    sourceReturnRule: "",
    source: "library",
    selection: new Set(),
    revised: false
  };

  const idsInterface = UDPSIdsInterface({
    dialog, showDialog, getProject: () => state.project, sourceMode: () => state.view === "sources" || sourceInspection, escapeHtml,
    onModule: value => { idsModule = value; },
    complete: (raw, mode) => completeSourceProject(raw, mode, "IDS")
  });
  const libraryInterface = UDPSLibraryInterface({
    dialog, showDialog, getProject: () => state.project, sourceMode: () => state.view === "sources" || sourceInspection, escapeHtml,
    complete: (raw, mode) => completeSourceProject(raw, mode, "bibliotheek")
  });

  function completeSourceProject(raw, mode, kind) {
    const context = state.view === "sources" ? { filters: currentFilters(), returnRule: state.sourceReturnRule,
      expanded: new Set(state.expanded), collapsed: new Set(state.collapsedSets) } : null;
    const project = UDPSProjectFiles.open(JSON.stringify(raw), `${raw.source || "Werkblad"}.json`);
    checkProjectSaveSize(project);
    project.needsSave = true;
    if (mode === "new") return switchProject(project);
    if (state.project?.studioContext) project.studioContext = structuredClone(state.project.studioContext);
    dialog.close();
    openProject(project);
    if (context) {
      state.ifcSelection = new Set(context.filters.entities);
      state.propertySet = context.filters.propertySet;
      state.search = context.filters.search;
      state.sourceRuleFilter = context.filters.sourceRuleFilter;
      state.sourceReturnRule = context.returnRule;
      state.expanded = context.expanded;
      state.collapsedSets = context.collapsed;
      navigate("sources");
    }
    message(context ? "Bron bij het werkblad bewaard." : `Regels uit ${kind} toegevoegd.`);
  }

  function checkProjectSaveSize(project) {
    if (new Blob([UDPSProjectFiles.save(project)]).size > maxProjectBytes) {
      throw new Error("Het werkblad wordt groter dan 32 MiB. Kies minder regels of een kleiner bronbestand.");
    }
  }

  function currentFilters() {
    return { entities: [...state.ifcSelection], propertySet: state.propertySet, search: state.search, sourceRuleFilter: state.sourceRuleFilter };
  }

  function rememberProject() {
    state.saved = { project: structuredClone(state.project), token: crypto.randomUUID(), filters: currentFilters() };
    state.projectHasSnapshot = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 3, ...state.saved }));
      localStorage.setItem(filterStorageKey, JSON.stringify({ token: state.saved.token, filters: state.saved.filters }));
    } catch {
      // The open project and downloaded files remain available.
    }
  }

  function rememberFilters() {
    if (!state.projectHasSnapshot || !state.saved?.token) return;
    state.saved.filters = currentFilters();
    try {
      const view = JSON.parse(localStorage.getItem(filterStorageKey));
      if (view?.token && view.token !== state.saved.token) return;
      localStorage.setItem(filterStorageKey, JSON.stringify({ token: state.saved.token, filters: state.saved.filters }));
    } catch {
      // Filters remain available in the open session.
    }
  }

  function escapeHtml(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value ?? "").replace(/[&<>"']/g, char => entities[char]);
  }

  function wordCount(amount, singular, plural) {
    return `${amount} ${amount === 1 ? singular : plural}`;
  }

  function icon(name, className = "") {
    // Lucide SVGs; source revision and license are recorded in assets/lucide-LICENSE.txt.
    const shapes = {
      "edit": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/><path d=\"m15 5 4 4\"/>",
      "inherit": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
      "override": "<line x1=\"5\" x2=\"19\" y1=\"9\" y2=\"9\"/><line x1=\"5\" x2=\"19\" y1=\"15\" y2=\"15\"/><line x1=\"19\" x2=\"5\" y1=\"5\" y2=\"19\"/>",
      "more": "<circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/>",
      "close": "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
      "check": "<path d=\"M20 6 9 17l-5-5\"/>",
      "batch": "<path d=\"M10 5H3\"/><path d=\"M12 19H3\"/><path d=\"M14 3v4\"/><path d=\"M16 17v4\"/><path d=\"M21 12h-9\"/><path d=\"M21 19h-5\"/><path d=\"M21 5h-7\"/><path d=\"M8 10v4\"/><path d=\"M8 12H3\"/>",
      "alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>",
      "folder": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/>",
      "plus": "<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>",
      "file": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>",
      "library": "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\"/><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\"/><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\"/>",
      "download": "<path d=\"M12 15V3\"/><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"m7 10 5 5 5-5\"/>",
      "home": "<path d=\"m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z\"/>",
      "arrow-left": "<path d=\"m12 19-7-7 7-7\"/><path d=\"M5 12h14\"/>",
      "chevron-right": "<path d=\"m9 18 6-6-6-6\"/>",
      "chevron-down": "<path d=\"m6 9 6 6 6-6\"/>"
    };
    return `<svg class="ui-icon${className ? ` ${className}` : ""}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name] || shapes.edit}</svg>`;
  }

  function entityName(code) {
    return entities.find(entity => entity.code === code);
  }

  function propertyPath(row) {
    return `${row.entity} · ${row.propertySet}`;
  }

  function rowParameter(row) {
    return UDPSProjectFiles.parameterOf(state.project, row);
  }

  function missingParameter(row) {
    return !row.implicitRevit && !rowParameter(row).trim();
  }

  function activeRows() {
    return state.project.rows.filter(row => row.active);
  }

  function issueGroupKey(row) {
    return JSON.stringify([row.propertySet, row.name]);
  }

  function exportTargetKey(row) {
    return JSON.stringify([row.propertySet, row.name, row.entity]);
  }

  function exportIssues() {
    const active = activeRows();
    const issues = [];
    for (const row of active) {
      if (missingParameter(row)) issues.push({ rows: [row], kind: "parameter", message: "Revit-parameter ontbreekt." });
      const invalid = [["Propertyset", row.propertySet], ["IFC-eigenschap", row.name], ["Datatype", row.type], ["IFC-entiteit", row.entity]]
        .filter(([, value]) => !value.trim() || /[\t\r\n]/.test(value)).map(([label]) => label);
      if (row.entity.trim() && !/^Ifc[A-Za-z0-9]+$/.test(row.entity)) invalid.push("IFC-entiteit");
      if (/[\t\r\n]/.test(rowParameter(row))) invalid.push("Revit-parameter");
      if (invalid.length) issues.push({ rows: [row], kind: "invalid", message: `${[...new Set(invalid)].join(", ")}: ontbreekt of bevat ongeldige tekens.` });
    }
    const targets = Map.groupBy(active, exportTargetKey);
    for (const rows of targets.values()) {
      if (rows.length < 2) continue;
      issues.push({ rows, kind: "duplicate", message: "Dubbele exportregel" });
    }
    return issues;
  }

  function message(text, undo = false, undoAction = "undo-remove") {
    window.clearTimeout(noticeTimer);
    notice.textContent = text;
    if (undo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notice-undo";
      button.dataset.action = undoAction;
      button.textContent = "Ongedaan maken";
      notice.append(button);
    }
    notice.hidden = false;
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, undo ? 12000 : 4400);
  }

  function navigate(view) {
    state.editor = null;
    state.review = null;
    state.panel = "";
    state.view = view;
    render(null);
    root.querySelector("[data-heading]")?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openProject(project, saved = null) {
    lastRemoval = null;
    lastSourceRemoval = null;
    state.sourceReturnRule = "";
    notice.hidden = true;
    state.exportPreviewOpen = false;
    const opened = structuredClone(project);
    studio.projectOpened(opened, saved);
    state.project = opened;
    state.ifcSelection = new Set(state.project.rows.length
      ? state.project.rows.map(row => row.entity)
      : ["IfcDoor", "IfcWindow", "IfcWall"]);
    const filters = saved?.filters || project.studioViewFilters;
    if (Array.isArray(filters?.entities)) {
      const present = new Set(state.project.rows.map(row => row.entity));
      state.ifcSelection = new Set(filters.entities.filter(entity => typeof entity === "string" && present.has(entity)));
    }
    state.propertySet = availablePropertySets().includes(filters?.propertySet) ? filters.propertySet : "";
    state.entitiesExpanded = false;
    state.expanded.clear();
    state.collapsedSets.clear();
    state.review = null;
    state.search = typeof filters?.search === "string" ? filters.search : "";
    state.sourceRuleFilter = typeof filters?.sourceRuleFilter === "string" ? filters.sourceRuleFilter : "";
    state.source = "library";
    state.selection.clear();
    state.revised = Boolean(state.project.needsSave);
    delete state.project.needsSave;
    delete state.project.studioViewFilters;
    const nextView = state.project.studioNextView;
    delete state.project.studioNextView;
    state.projectHasSnapshot = Boolean(saved);
    if (saved && !saved.token) rememberProject();
    navigate(nextView === "sources" ? "sources" : "mappings");
  }

  const studio = UDPSStudioShell({ state, dialog, escapeHtml, icon, showDialog, buttonRow,
    message, navigate, openProject, switchProject, currentFilters, downloadFile, render,
    openSources, demoProject, largeProject, startIds: name => idsInterface.startNew(name) });
  const productionSources = UDPSStudioSources({ getProject: () => state.project, dialog,
    showDialog: (markup, options) => showDialog(markup, { ...options, resetTrail:true }),
    escapeHtml, icon, buttonRow, message, downloadFile,
    complete: (raw, mode) => completeSourceProject(raw, mode, "bron") });
  function startPage() { return studio.startPage(); }

  function workspaceHeader() {
    if (!state.project) return "";
    return `
      <section class="project-bar">
        <button class="workspace-brand" type="button" data-action="start" aria-label="UDPS, naar start">UDPS${window.UDPS_STUDIO_MODE === "test" ? '<span class="studio-test-mark">Test</span>' : ""}</button>
        <div class="project-top">
          <h1 ${state.view === "mappings" ? 'data-heading tabindex="-1"' : ""}>${escapeHtml(state.project.name)}</h1>
          ${state.revised ? '<span class="project-dirty">Onbewaard</span>' : ""}
        </div>
        <div class="buttons project-actions">
          ${studio.contextActions()}
          <button type="button" class="button" data-action="start">${icon("home")}Home</button>
          <button type="button" class="button panel-toggle" data-action="sources" aria-pressed="${state.view === "sources"}">${icon("library")}Bronnen</button>
          <button type="button" class="button" data-action="save" aria-label="Project bewaren">Bewaren</button>
          <button type="button" class="button primary panel-toggle" data-action="export" aria-expanded="${state.panel === "export"}"${state.panel === "export" ? ' aria-controls="workspace-panel"' : ""}>${icon("download")}Exporteren</button>
        </div>
      </section>`;
  }

  function availableEntities() {
    const present = new Set(state.project.rows.map(row => row.entity));
    if (present.size === 0) return entities.filter(entity => ["IfcDoor", "IfcWindow", "IfcWall"].includes(entity.code));
    for (const code of state.ifcSelection) present.add(code);
    const known = entities.filter(entity => present.has(entity.code));
    const extra = [...present].filter(code => !entityName(code)).sort().map(code => ({ code, label: "" }));
    return [...known, ...extra];
  }

  function selectedRows() {
    return state.project.rows.filter(row => state.ifcSelection.has(row.entity));
  }

  function availablePropertySets() {
    return [...new Set(selectedRows().map(row => row.propertySet))]
      .sort((a, b) => a.localeCompare(b, "nl"));
  }

  function filteredRows() {
    const query = state.search.trim().toLocaleLowerCase("nl");
    return selectedRows().filter(row =>
      (!state.sourceRuleFilter || UDPSRuleFields.origin(state.project, row).origins.some(origin => sourceKey(origin) === state.sourceRuleFilter)) &&
      (!state.propertySet || row.propertySet === state.propertySet) &&
      (!query || [row.propertySet, row.name, row.label, rowParameter(row), row.entity, UDPSRuleFields.origin(state.project, row).label]
        .some(value => value.toLocaleLowerCase("nl").includes(query)))
    );
  }

  function mappingGroups() {
    const byProperty = Map.groupBy(state.project.rows, row => row.key);
    return [...Map.groupBy(filteredRows(), row => row.key)].map(([key, applications]) => ({
      key, applications, allApplications: byProperty.get(key)
    }));
  }

  function combinationGroups(visible = true) {
    return UDPSMappingRows.build(state.project, {
      visibleIds: visible ? new Set(filteredRows().map(row => row.id)) : undefined,
      parameterOf: UDPSProjectFiles.parameterOf
    });
  }

  function findCombination(id) {
    return combinationGroups().find(group => group.id === id) || combinationGroups(false).find(group => group.id === id);
  }

  function filtersActive() {
    return Boolean(state.propertySet || state.sourceRuleFilter || state.search.trim() ||
      availableEntities().some(entity => !state.ifcSelection.has(entity.code)));
  }

  function entityPanel() {
    const options = availableEntities();
    const selected = options.filter(entity => state.ifcSelection.has(entity.code)).map(entity => entity.code);
    const selection = selected.length === options.length ? `Alle ${selected.length}`
      : selected.length > 2 ? `${selected[0]} +${selected.length - 1}` : selected.join(", ") || "Geen selectie";
    return `<aside class="panel entity-panel" aria-label="IFC-entiteiten">
        <button class="entity-toggle" type="button" data-action="toggle-entities" aria-controls="entity-controls"
          aria-expanded="${state.entitiesExpanded}" title="${escapeHtml(selected.join(", "))}">
          <strong>IFC-entiteiten</strong>
          <span class="entity-selection">${escapeHtml(selection)}</span>
          ${icon("chevron-right", "chevron")}
        </button>
        <div id="entity-controls" class="entity-controls">
          <div class="entity-head">
            <h2>IFC-entiteiten</h2>
            <button class="text-button entity-action" type="button" data-action="all-entities">Alle selecteren</button>
          </div>
          <div class="entity-list">
            ${options.map(entity => {
              const count = state.project.rows.filter(row => row.entity === entity.code).length;
              return `<button class="entity" type="button" data-action="entity" data-value="${escapeHtml(entity.code)}" title="${escapeHtml(entity.code)}" aria-pressed="${state.ifcSelection.has(entity.code)}">
                <span><strong>${escapeHtml(entity.code)}</strong>${entity.label ? `<small>${entity.label}</small>` : ""}</span><span class="entity-count">${count}</span>
              </button>`;
            }).join("")}
          </div>
        </div>
      </aside>`;
  }

  function mappingsPage() {
    const matrix = matrixViewport.matches && !state.review;
    const options = matrix ? availableEntities() : [];
    const visible = options.filter(entity => state.ifcSelection.has(entity.code));
    return `
      ${state.review ? `<nav class="review-navigation" aria-label="Werkbladnavigatie"><button class="text-button" type="button" data-action="close-review">${icon("arrow-left")}Terug naar werkblad</button></nav>` : ""}
      <div class="workspace-grid${matrix ? " has-matrix" : ""}${state.review ? " is-review" : ""}">
        ${matrix || state.review ? "" : entityPanel()}
        <section class="panel mapping-panel" aria-labelledby="target-label">
          <h2 class="visually-hidden" id="target-label">Koppelingen</h2>
          <div class="mapping-sticky">
          ${state.review ? "" : `<div class="toolbar">
            <div class="toolbar-main">
              <button type="button" class="button add-property" data-action="add-property">${icon("plus")} Regel toevoegen</button>
              <label class="visually-hidden" for="search">Zoek in koppelingen</label>
              <input class="search" id="search" type="search" placeholder="Zoek regel, parameter of bron" value="${escapeHtml(state.search)}">
            </div>
            <div class="toolbar-filters${matrix ? " with-columns" : ""}">
              <select class="set-filter" id="property-set" aria-label="Propertyset filteren">
                <option value="">Alle propertysets</option>
                ${availablePropertySets().map(set => `<option value="${escapeHtml(set)}"${set === state.propertySet ? " selected" : ""}>${escapeHtml(set)}</option>`).join("")}
              </select>
              ${matrix ? `<button type="button" class="button column-picker" data-action="choose-columns"
                aria-haspopup="dialog" aria-label="IFC-kolommen kiezen, ${visible.length} van ${options.length} zichtbaar"
                title="${escapeHtml(visible.map(entity => entity.code).join(", "))}">
                IFC-kolommen <span class="entity-count">${visible.length}/${options.length}</span>
              </button>` : ""}
            </div>
            <div class="toolbar-status" id="toolbar-status">${toolbarIssueActions(exportIssues())}</div>
          </div>`}
            <div id="mapping-summary"></div>
          </div>
          <div class="mapping-list" id="mapping-list"></div>
        </section>
      </div>`;
  }

  function propertySetOf(group) {
    return group.propertySet;
  }

  function mappingList(groups, issues, matrix) {
    if (!groups.length) {
      if (!state.ifcSelection.size) {
        const instruction = matrix ? "Open IFC-kolommen en kies welke entiteiten je wilt zien." : "Selecteer één of meer entiteiten in de lijst.";
        return `<div class="empty"><h3>Kies een IFC-entiteit</h3><p>${instruction}</p></div>`;
      }
      if (state.search || state.propertySet) {
        return '<div class="empty"><h3>Geen resultaten</h3><p>Wijzig de filters om andere koppelingen te zien.</p></div>';
      }
      return `<div class="empty">
        <h3>${state.project.rows.length ? `Nog geen regels voor ${[...state.ifcSelection].map(escapeHtml).join(", ")}` : "Voeg je eerste regel toe"}</h3>
        <p>Voeg zelf een regel toe of kies er een uit een bron.</p>
        <div class="buttons empty-actions">
          <button type="button" class="button primary" data-action="rule-from-source">${icon("library")}Kies uit bronnen</button>
          <button type="button" class="button" data-action="add-property">${icon("plus")}Regel toevoegen</button>
        </div>
      </div>`;
    }
    const sections = [...Map.groupBy(groups, propertySetOf)].map(([name, properties]) => {
      const rowIds = new Set(properties.flatMap(group => group.applications.map(row => row.id)));
      const count = issues.filter(issue => issue.rows.some(row => rowIds.has(row.id))).length;
      return { name, properties, count, expanded: !state.collapsedSets.has(name) };
    });
    if (matrix) return matrixMarkup(sections, issues);
    return sections.map(section => `<h3 class="propertyset">${propertySetToggle(section)}</h3>
      ${section.expanded ? section.properties.map(groupMarkup).join("") : ""}`).join("");
  }

  function propertySetToggle({ name, properties, count, expanded }) {
    return `<button type="button" data-action="collapse-set" data-value="${escapeHtml(name)}" aria-expanded="${expanded}">
      <span class="propertyset-name">${icon(expanded ? "chevron-down" : "chevron-right", "chevron")}${escapeHtml(name || "Propertyset ontbreekt")}</span>
      <span class="propertyset-count"><small>${wordCount(properties.length, "regel", "regels")}</small>
        ${count ? `<span class="state warning">${wordCount(count, "exportprobleem", "exportproblemen")}</span>` : ""}</span>
    </button>`;
  }

  function toolbarIssueActions(issues) {
    return `${state.sourceRuleFilter ? '<span class="active-source-filter">Bronregels</span>' : ""}${filtersActive() ? '<button type="button" class="text-button clear-filters" data-action="clear-filters">Wis filters</button>' : ""}
      ${issues.length ? `<button type="button" class="button issue-button" id="export-problems" data-action="review"
        title="Alle exportproblemen bekijken: ontbrekende Revit-parameters, dubbele regels en ongeldige velden.">${icon("alert")}<span class="issue-button-label">${wordCount(issues.length, "exportprobleem", "exportproblemen")}</span></button>` : ""}`;
  }

  function mappingSummary(groups, matrix) {
    const count = groups.reduce((sum, group) => sum + group.applications.length, 0);
    return `
      <div class="mapping-meta visually-hidden">
        <span class="small muted mapping-counts" aria-live="polite">${wordCount(groups.length, "regel", "regels")} · ${count} getoond <span>· ${activeRows().length} actief in project</span></span>
      </div>
      ${groups.length && !matrix ? `<div class="columns compact-columns" aria-hidden="true">
        <span>IFC eigenschap</span><span>Revit parameter</span>
        <span><span class="scope-heading-wide">Toepassingen</span><span class="scope-heading-narrow">Aantal</span></span>
        <span class="export-heading" title="Actief in export">Export</span>
      </div>` : ""}`;
  }

  function combinationParameter(group) {
    const label = group.parameterKind === "implicit" ? "Zelfde naam als IFC" : group.parameterKind === "missing" ? "Parameter invullen" : group.parameter;
    const central = group.isStandard;
    return `<button type="button" class="cell-button row-parameter${group.parameterKind === "missing" ? " incomplete" : ""}"
      data-action="${central ? "combination-standard" : "edit-combination"}" data-value="${escapeHtml(group.id)}"
      aria-label="${central ? "Standaard wijzigen" : "Revit parameter wijzigen"}: ${escapeHtml(group.name)} · ${escapeHtml(label)}"
      title="${escapeHtml(central ? "Revit parameter (standaard)" : "Revit parameter voor deze regel")}">
      <span>${breakableIdentifier(label)}</span>${icon("edit", "edit-icon")}
    </button>`;
  }

  function ruleFields(group) {
    return UDPSRuleFields.info(state.project, group.allApplications.length ? group.allApplications : [group.representative]);
  }

  function ruleOriginMark(group) {
    const fields = ruleFields(group);
    if (!fields.linked) return "";
    const label = fields.origins.filter(origin => origin.linked).map(origin => origin.label).join(" · ");
    return `<button type="button" class="cell-button rule-origin" data-action="rule-source" data-value="${escapeHtml(group.id)}" aria-label="Bron bekijken voor ${escapeHtml(group.name)}" title="${escapeHtml(label)} · IFC-velden en datatype volgen de bron">${icon("library")}</button>`;
  }

  function dataTypeCell(group) {
    const info = ruleFields(group);
    const values = [...new Set(info.types.map(UDPSProjectFiles.exportDataType))];
    const value = values.length === 1 ? values[0] : "";
    const label = values.length > 1 ? "Meerdere" : (Object.hasOwn(types, value) ? types[value] : value) || "Niet ingesteld";
    if (!info.editable || !group.applications.length) return `<span class="rule-type-fixed" title="${escapeHtml(info.linked ? `${info.types.join(", ")} · Vastgelegd door de bron` : info.types.join(", "))}">${escapeHtml(label)}</span>`;
    return `<select class="rule-type-select" id="${escapeHtml(`datatype-${group.id}`)}" data-rule-type="${escapeHtml(group.id)}" aria-label="Datatype voor ${escapeHtml(group.name)}" title="${escapeHtml(value || "Kies een datatype")}">
      ${!value || !Object.hasOwn(types, value) ? `<option value="" selected>${escapeHtml(label)}</option>` : ""}${Object.entries(types).map(([code, text]) => `<option value="${code}"${code === value ? " selected" : ""}>${text}</option>`).join("")}
    </select>`;
  }

  function ruleSourceDialog(id) {
    const group = findCombination(id);
    if (!group) return;
    const fields = ruleFields(group);
    showDialog(`<section data-dialog-route="rule-source:${escapeHtml(id)}"><h2 id="dialog-title">Herkomst van de regel</h2><p class="dialog-subject">${escapeHtml(group.propertySet)} · ${escapeHtml(group.name)}</p>
      <p class="small muted">IFC-velden en datatype volgen de bron. De Revit parameter en exportkeuzes kun je aanpassen.</p>
      <div class="application-manager">${fields.origins.map(origin => `<article class="managed-application"><div><strong>${escapeHtml(origin.label)}</strong><small>${escapeHtml(origin.kind === "ids" ? "IDS" : origin.kind === "library" ? "Bibliotheek" : "Bronverwijzing")}</small></div>${origin.navigation ? `<button type="button" class="button" data-action="inspect-source" data-value="${escapeHtml(JSON.stringify(origin.navigation))}">Bekijken</button>` : ""}</article>`).join("")}</div>
      <div class="dialog-actions"><button type="button" class="button" data-action="sources" data-value="${escapeHtml(id)}">Bronnen beheren</button><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`);
  }

  function combinationExport(group, applications = group.applications, entity = "", controlId = entity) {
    if (!applications.length) return "";
    const active = applications.filter(row => row.active).length;
    const subject = `${group.name} · ${group.parameterKind === "named" ? group.parameter : group.parameterKind === "implicit" ? "IFC-naam" : "parameter ontbreekt"}${entity ? ` op ${entity}` : ""}`;
    return `<label class="export-cell" title="${escapeHtml(`${active === applications.length ? "Uitschakelen" : "Inschakelen"} voor export · ${wordCount(applications.length, "toepassing", "toepassingen")}`)}">
      <input type="checkbox" id="${escapeHtml(JSON.stringify(["export-combination", group.id, controlId]))}"
        data-combination-export="${escapeHtml(JSON.stringify(applications.map(row => row.id)))}"
        aria-label="Actief in export voor ${escapeHtml(subject)}"${active === applications.length ? " checked" : active ? " data-export-mixed" : ""}>
    </label>`;
  }

  function matrixMarkup(sections, issues) {
    const hasGroupExport = sections.some(section => section.properties.some(group => group.applications.length > 1));
    const rowIssues = Map.groupBy(issues.flatMap(issue => issue.rows.map(row => ({ id: row.id, message: issue.message }))), item => item.id);
    const columns = availableEntities().filter(entity => state.ifcSelection.has(entity.code));
    return `<div class="matrix-scroll" role="region" tabindex="0" aria-label="IFC-koppelingen. Scroll om meer te zien.">
      <table class="matrix-table" style="--ifc-total-width: ${columns.length * matrixColumnMinWidth}px">
        <colgroup><col class="matrix-property-width"><col class="matrix-standard-width"><col class="matrix-type-width">${columns.map(() => `<col class="matrix-entity-width" style="width: ${matrixColumnMinWidth}px">`).join("")}</colgroup>
        <thead><tr>
          <th class="matrix-property" scope="col"><div class="column-heading"><span>IFC eigenschap</span>${hasGroupExport ? '<span class="column-export-label" title="Export voor de getoonde IFC-entiteiten van deze regel">Export</span>' : ""}</div></th>
          <th class="matrix-standard" scope="col">Revit parameter</th><th class="matrix-type" scope="col">Datatype</th>
          ${columns.map(entity => `<th scope="col" title="${escapeHtml(entity.code)} · exportkeuzes">${escapeHtml(entity.code).replace(/([a-z])([A-Z])/g, "$1<wbr>$2")}</th>`).join("")}
        </tr></thead>
        ${sections.map(section => `<tbody>
          <tr class="matrix-set"><th class="propertyset matrix-set-label" scope="rowgroup" colspan="3">${propertySetToggle(section)}</th><td colspan="${columns.length}"></td></tr>
          ${section.expanded ? section.properties.map(group => matrixRow(group, columns, rowIssues)).join("") : ""}
        </tbody>`).join("")}
      </table>
    </div>`;
  }

  function matrixRow(group, columns, rowIssues) {
    const byEntity = Map.groupBy(group.applications, row => row.entity);
    return `<tr class="matrix-row combination-row${group.isStandard ? " is-standard" : " is-variant"}${!group.applications.length ? " is-context" : ""}" data-combination="${escapeHtml(group.id)}">
      <th class="matrix-property" scope="row"><div class="matrix-property-content">
        ${ruleOriginMark(group)}<button type="button" class="cell-button property-manage" data-action="manage-combination" data-value="${escapeHtml(group.id)}" aria-label="Regel beheren: ${escapeHtml(group.name)} · ${escapeHtml(group.parameter || "zonder parameter")}" title="Regel en IFC-entiteiten beheren"><strong>${escapeHtml(group.name || "Eigenschap ontbreekt")}</strong></button>
        ${group.isStandard ? `<button type="button" class="cell-button add-combination" data-action="new-combination" data-value="${escapeHtml(group.id)}" aria-label="Afwijkende Revit parameter maken voor ${escapeHtml(group.name)}" title="Afwijkende Revit parameter maken">${icon("plus")}</button>` : ""}
        ${group.applications.length > 1 ? combinationExport(group) : ""}
      </div></th>
      <td class="matrix-standard"><div class="matrix-standard-content">${combinationParameter(group)}</div></td><td class="matrix-type">${dataTypeCell(group)}</td>
      ${columns.map(({code}) => {
        const rows = byEntity.get(code);
        return `<td class="matrix-entity" data-entity="${escapeHtml(code)}">${rows ? matrixCombinationCell(group, rows, rowIssues, code)
          : group.allApplications.some(row => row.entity === code) ? '<span class="matrix-unmatched">Buiten filter</span>'
          : ruleFields(group).linked && !group.familyApplications.some(row => row.entity === code) ? '<span class="empty-dash" title="Niet opgenomen in de bron" aria-label="Niet opgenomen in de bron">—</span>'
          : `<button type="button" class="cell-button matrix-add" data-action="assign-combination" data-value="${escapeHtml(JSON.stringify([group.id, code]))}" aria-label="Revit parameter gebruiken voor ${escapeHtml(group.name)} op ${escapeHtml(code)}" title="Deze Revit parameter gebruiken op ${escapeHtml(code)}"><span class="empty-dash" aria-hidden="true">—</span>${icon("plus", "empty-plus")}</button>`}</td>`;
      }).join("")}
    </tr>`;
  }

  function matrixCombinationCell(group, rows, rowIssues, entity) {
    const messages = [...new Set(rows.flatMap(row => rowIssues.get(row.id) || []).map(issue => issue.message))];
    const warning = messages.join(" · ");
    return `<div class="combination-cell${warning ? " has-issue" : ""}" data-applications="${escapeHtml(JSON.stringify(rows.map(row => row.id)))}">
      ${warning ? `<button type="button" class="cell-issue" id="matrix-issue-${escapeHtml(rows.find(row => rowIssues.has(row.id)).id)}" data-action="review" data-value="${escapeHtml(issueGroupKey(rows[0]))}" aria-label="Exportprobleem bij ${escapeHtml(group.name)} op ${escapeHtml(entity)}" title="${escapeHtml(warning)}">${icon("alert", "issue-icon")}<span class="visually-hidden">${escapeHtml(warning)}</span></button>` : ""}
      ${combinationExport(group, rows, entity)}
    </div>`;
  }

  function groupMarkup(group) {
    const expanded = state.expanded.has(group.id);
    return `<div class="mapping-group combination-row${group.isStandard ? " is-standard" : " is-variant"}${!group.applications.length ? " is-context" : ""}" data-combination="${escapeHtml(group.id)}">
      <div class="compact-row">
        <div class="compact-rule-name">${ruleOriginMark(group)}<button type="button" class="cell-button property-manage" data-action="manage-combination" data-value="${escapeHtml(group.id)}"><strong>${escapeHtml(group.name)}</strong></button></div>
        ${combinationParameter(group)}
        <button type="button" class="text-button combination-scope" data-action="expand-combination" data-value="${escapeHtml(group.id)}" aria-expanded="${expanded}">${wordCount(group.applications.length, "toepassing", "toepassingen")}${icon(expanded ? "chevron-down" : "chevron-right")}</button>
        ${combinationExport(group)}
      </div>
      ${expanded ? `<div class="applications combination-applications"><div class="compact-datatype"><span>Datatype</span>${dataTypeCell(group)}</div>${group.applications.map(row => `<div class="combination-application"><span>${escapeHtml(row.entity)}</span><small>${escapeHtml(types[row.type] || row.type)}</small>${combinationExport(group, [row], row.entity, row.id)}</div>`).join("")}
        ${group.isStandard ? `<button type="button" class="text-button" data-action="new-combination" data-value="${escapeHtml(group.id)}">${icon("plus")}Afwijkende Revit parameter</button>` : ""}</div>` : ""}
    </div>`;
  }

  function exportCheckbox(group, row = null) {
    const applications = row ? [row] : group.applications;
    const active = applications.filter(application => application.active).length;
    const allActive = active === applications.length;
    const subject = row ? `${row.name} op ${row.entity}` : applications[0].name;
    const label = `Actief in export voor ${subject}`;
    const changeCount = allActive ? active : applications.length - active;
    const title = `${wordCount(changeCount, row ? "toepassing" : "getoonde toepassing", row ? "toepassingen" : "getoonde toepassingen")} ${allActive ? "uitschakelen" : "inschakelen"} voor export`;
    const id = row ? `export-application-${row.id}` : `export-group-${group.key}`;
    return `<label class="export-cell" title="${escapeHtml(title)}">
      <input type="checkbox" id="${escapeHtml(id)}" aria-label="${escapeHtml(label)}"
        data-export-group="${escapeHtml(group.key)}" ${row ? `data-export-application="${escapeHtml(row.id)}"` : ""}
        ${allActive ? "checked" : active ? "data-export-mixed" : ""}>
    </label>`;
  }

  function inlineParameterForm(edit, rows, compact) {
    const scope = wordCount(edit.ids.length, "toepassing wijzigen", "toepassingen wijzigen");
    const targets = [...new Set(rows.map(row => row.entity))];
    const single = edit.ids.length === 1;
    const row = single ? rows[0] : null;
    const allApplications = state.project.rows.filter(row => row.key === edit.key);
    const standard = state.project.standards[edit.key] ||
      ((row ? row.implicitRevit : allApplications.every(application => application.implicitRevit)) ? "Zelfde naam als IFC" : "Niet ingesteld");
    const secondaryActions = [
      row?.override != null ? `<button type="button" class="text-button" data-action="reset-override" data-value="${escapeHtml(row.id)}">Standaard gebruiken</button>` : "",
      !compact ? `<button type="button" class="text-button" data-action="standard" data-value="${escapeHtml(edit.key)}" data-row-id="${escapeHtml(row?.id || "")}">Standaard wijzigen</button>` : ""
    ].join("");
    return `<form class="inline-edit${compact ? " matrix-edit" : ""}" id="edit-parameter">
        <div class="inline-edit-context" id="inline-scope">
          <strong>${single ? `Revit parameter (${escapeHtml(targets[0])})` : `${edit.ids.length} toepassingen wijzigen`}</strong>
          ${single ? "" : `<span>${escapeHtml(targets.join(", "))}</span>`}
        </div>
        <label for="inline-parameter" class="inline-field-label${single ? " visually-hidden" : ""}">Revit-parameter</label>
        <input id="inline-parameter" name="parameter" aria-describedby="inline-scope${single ? " inline-baseline" : ""}" required maxlength="120"
          placeholder="${edit.mixed ? "Meerdere waarden" : "Parameternaam"}" value="${escapeHtml(edit.initial)}">
        ${single ? `<p class="inline-baseline" id="inline-baseline">Standaard: ${escapeHtml(standard)}</p>` : ""}
        <div class="inline-edit-actions">
          <button class="button primary" type="submit" aria-label="${scope}" title="${scope} · Enter">
            ${single ? "Toepassen" : `${edit.ids.length} wijzigen`}
          </button>
          <button class="text-button cancel-edit" type="button" data-action="cancel-edit" aria-label="Bewerking annuleren" title="Annuleren (Esc)">Annuleren</button>
        </div>
        ${secondaryActions ? `<div class="parameter-secondary">${secondaryActions}</div>` : ""}
        ${row ? `<details class="parameter-info"><summary>Eigenschapsinformatie</summary><dl>
          <dt>IFC-entiteit</dt><dd>${escapeHtml(row.entity)}</dd>
          <dt>Propertyset</dt><dd>${escapeHtml(row.propertySet || "Niet ingesteld")}</dd>
          <dt>Eigenschap</dt><dd>${escapeHtml(row.name)}</dd>
          ${row.label !== row.name ? `<dt>Omschrijving</dt><dd>${escapeHtml(row.label)}</dd>` : ""}
          <dt>Datatype</dt><dd>${escapeHtml(types[row.type] || row.type || "Niet ingesteld")}</dd>
          <dt>Bron</dt><dd>${escapeHtml(row.source || "Niet opgegeven")}</dd>
        </dl><button type="button" class="text-button" data-action="edit-fields" data-value="${escapeHtml(row.id)}">IFC-velden bewerken</button></details>` : ""}
      </form>`;
  }

  function parameterCell(group, row, { inReview = false, compact = false } = {}) {
    const target = row ? row.id : group.key;
    const rows = row ? [row] : group.applications;
    const edit = state.editor;
    if (edit?.key === group.key && edit.inReview === inReview && edit.rowId === (row?.id || "")) {
      return inlineParameterForm(edit, rows, compact);
    }
    const values = new Set(rows.map(rowParameter));
    if (!row && values.size > 1) {
      const expanded = state.expanded.has(group.key);
      return `<button type="button" class="cell-button parameter-cell mixed-parameter" data-action="show-applications"
        data-value="${escapeHtml(target)}" aria-expanded="${expanded}" aria-label="Meerdere waarden voor ${escapeHtml(rows[0].name)}" title="Meerdere waarden">
        <span>Meerdere waarden</span>${icon(expanded ? "chevron-down" : "chevron-right", "chevron")}
      </button>`;
    }
    const action = inReview ? "edit-review" : row ? "edit-application" : "edit-group";
    const incomplete = rows.some(missingParameter);
    const parameter = values.values().next().value;
    const value = parameter || (incomplete ? "Nog te kiezen" : "Zelfde naam als IFC");
    const subject = inReview ? `${value} op ${row.entity}` : row ? `${row.name} op ${row.entity}` : rows[0].name;
    const inherited = compact && row.override == null && !incomplete && !(row.implicitRevit && !parameter.trim());
    const marker = compact && (inherited || incomplete);
    const override = compact && row.override != null;
    const title = inherited ? `Bewerk alleen ${row.entity} · Huidige waarde: ${value}` : `${override ? "Afwijking: " : ""}${value}`;
    return `<button type="button" class="cell-button parameter-cell${compact ? " matrix-parameter" : ""}${incomplete ? " incomplete" : ""}${inherited ? " is-inherited" : ""}${override ? " is-override" : ""}" data-action="${action}"
      data-value="${escapeHtml(target)}" aria-label="Revit-parameter bewerken voor ${escapeHtml(subject)}" title="${escapeHtml(title)}">
      ${marker ? `${icon("edit", "application-edit-icon")}<span class="visually-hidden">${incomplete ? "Revit-parameter ontbreekt" : `Huidige Revit-parameter: ${escapeHtml(value)}`}</span>` :
        `<span class="parameter-name">${override ? String(value).split(/(?<=_)|(?<=[a-z0-9])(?=[A-Z])/u).map(escapeHtml).join("<wbr>") : escapeHtml(value)}</span>${icon(incomplete ? "alert" : override ? "override" : "edit", override || incomplete ? "parameter-state" : "edit-icon")}`}
    </button>`;
  }

  function panelHeading(title) {
    return `<header class="workspace-panel-heading"><h2 id="workspace-panel-title" tabindex="-1">${title}</h2>
      <button class="cell-button" type="button" data-action="close-panel" aria-label="${title} sluiten" title="Sluiten (Esc)">${icon("close")}</button></header>`;
  }

  function openWorkspacePanel(kind) {
    if (!state.project) return navigate("sources");
    if (state.panel === kind) return closeWorkspacePanel();
    state.editor = null;
    state.view = "mappings";
    state.panel = kind;
    render();
    document.getElementById("workspace-panel-title")?.focus({ preventScroll: true });
  }

  function closeWorkspacePanel() {
    const kind = state.panel;
    state.panel = "";
    state.editor = null;
    render();
    if (!focusControl(kind)) document.getElementById("search")?.focus({ preventScroll: true });
  }

  function sourceKey(origin) {
    return JSON.stringify([origin.kind, origin.sourceId || origin.sourceUri || origin.label, origin.sourceVersion || ""]);
  }

  function sourceRecords() {
    const project = state.project;
    if (!project) return [];
    const result = [];
    const savedIds = Array.isArray(project.sourceData?.idsImports) ? project.sourceData.idsImports : [];
    const savedLibraries = Array.isArray(project.sourceData?.libraryImports) ? project.sourceData.libraryImports : [];
    for (const source of savedIds) if (source && typeof source.id === "string" && typeof source.fileName === "string") result.push({ kind: "ids", sourceId: source.id, label: source.fileName, available: true, navigation: { action: "ids-source", value: source.id } });
    for (const source of savedLibraries) if (source && typeof source.id === "string" && source.library) result.push({ kind: "library", sourceId: source.id, sourceVersion: source.version, sourceUri: source.uri, label: source.name || source.id, available: true, navigation: { action: "library-source", value: JSON.stringify([source.id, source.version]) } });
    const represented = new Set(project.rows.map(row => row.sourceIndex));
    const removed = new Set(project.removedSourceIndices || []);
    // The JSON adapter also preserves rows without an IFC application. Their
    // provenance still requires the original source, even though no table row exists.
    const retainedOrigins = (project.sourceData?.rows || []).flatMap((_row, sourceIndex) =>
      represented.has(sourceIndex) || removed.has(sourceIndex) ? [] : UDPSRuleFields.origin(project, { sourceIndex }).origins || []
    ).filter(origin => origin.linked);
    const allOrigins = [...project.rows.flatMap(row => UDPSRuleFields.origin(project, row).origins || []), ...retainedOrigins].filter(origin => origin.linked);
    for (const origin of allOrigins) if (!result.some(record => sourceKey(record) === sourceKey(origin))) result.push(origin);
    return result.map(record => {
      const key = sourceKey(record);
      const used = project.rows.filter(row => UDPSRuleFields.origin(project, row).origins.some(origin => sourceKey(origin) === key));
      const usedIds = new Set(used.map(row => row.id));
      const count = UDPSMappingRows.build(project).filter(group => group.applications.some(row => usedIds.has(row.id))).length;
      const retained = retainedOrigins.filter(origin => sourceKey(origin) === key).length;
      return { ...record, key, used, count, retained };
    });
  }

  function sourceRecordMarkup(record, picker) {
    return `<article class="source-record"><span class="source-record-icon">${icon(record.kind === "ids" ? "file" : "library")}</span>
      <div class="source-record-copy"><strong>${escapeHtml(record.label)}</strong><small>${record.kind === "ids" ? "IDS" : record.kind === "library" ? "Bibliotheek" : "Bronverwijzing"}${record.sourceVersion ? ` · ${escapeHtml(record.sourceVersion)}` : ""} · ${wordCount(record.count, "regel", "regels")}${record.retained ? ` · ${wordCount(record.retained, "bewaarde bronverwijzing", "bewaarde bronverwijzingen")} zonder IFC-entiteit` : ""}</small></div>
      <div class="source-record-actions">${record.navigation ? `<button type="button" class="button" data-action="${picker ? record.navigation.action : "inspect-source"}" data-value="${escapeHtml(picker ? record.navigation.value : JSON.stringify(record.navigation))}">${picker ? "Regels kiezen" : "Bekijken"}</button>` : '<span class="small muted">Bron niet ingesloten</span>'}
        ${!picker && record.used.length ? `<button type="button" class="text-button" data-action="source-rules" data-value="${escapeHtml(record.key)}">Regels tonen</button>` : ""}
        ${!picker && !record.used.length && !record.retained && record.sourceId ? `<button type="button" class="text-button" data-action="remove-source" data-value="${escapeHtml(record.key)}" aria-label="Bron verwijderen: ${escapeHtml(record.label)}">Verwijderen</button>` : ""}
      </div></article>`;
  }

  function sourcesPage(inPanel = false) {
    const records = sourceRecords();
    if (inPanel) return `<aside class="workspace-panel" id="workspace-panel" aria-labelledby="workspace-panel-title">${panelHeading("Regels uit een bron")}
      <div class="workspace-panel-content"><p class="small muted source-intro">Kies een bewaarde bron of lees een bestand in.</p>
        <div class="source-file-actions"><button type="button" class="button" data-action="ids-add">${icon("folder")}IDS-bestand</button><button type="button" class="button" data-action="library-open">${icon("folder")}Bibliotheekbestand</button></div>
        ${records.map(record => sourceRecordMarkup(record, true)).join("")}
        <section class="source-examples"><h3>Voorbeelden</h3><button type="button" class="sample-item" data-action="library-example"><span><strong>Voorbeeldbibliotheek</strong><small>Eigenschappen voor deuren, ramen en wanden</small></span>${icon("chevron-right")}</button><button type="button" class="sample-item" data-action="ids-example"><span><strong>Voorbeeld-IDS</strong><small>Twee eigenschappen en één classificatie-eis</small></span>${icon("chevron-right")}</button></section>
      </div></aside>`;
    return `<section class="source-manager" aria-labelledby="sources-title"><div class="source-manager-heading"><div><p class="eyebrow">${state.project ? "In dit werkblad" : "Verkennen"}</p><h1 id="sources-title" data-heading tabindex="-1">Bronnen</h1></div><div class="buttons">${state.project ? state.sourceReturnRule ? `<button type="button" class="button" data-action="return-source-rule" data-value="${escapeHtml(state.sourceReturnRule)}">Terug naar Regel beheren</button>` : '<button type="button" class="button" data-action="mappings">Naar werkblad</button>' : '<button type="button" class="button" data-action="start">Home</button>'}<button type="button" class="button" data-action="ids-add">${icon("plus")}IDS-bestand</button><button type="button" class="button" data-action="library-open">${icon("plus")}Bibliotheek</button></div></div>
      <p class="small muted source-manager-description">${state.project ? "Bronbestanden en hun versies blijven bij het werkblad bewaard. Nieuwe regels kies je via Regel toevoegen." : "Bekijk een bronbestand. Open een werkblad om bronnen daarbij te bewaren."}</p>
      <div class="source-record-list">${records.map(record => sourceRecordMarkup(record, false)).join("") || '<div class="source-empty"><h2>Nog geen bronnen</h2><p>Lees een IDS- of bibliotheekbestand in, of bekijk een voorbeeld.</p></div>'}</div>
      <section class="source-examples"><h2>Meer bronnen</h2><div class="source-example-links"><button type="button" class="text-button" data-action="bsdd-open">bSDD verkennen</button><button type="button" class="text-button" data-action="library-export">Werkblad als bibliotheek</button></div><h2>Voorbeeldbronnen</h2><div class="source-example-links"><button type="button" class="text-button" data-action="library-example">${icon("library")}Voorbeeldbibliotheek bekijken</button><button type="button" class="text-button" data-action="ids-example">${icon("file")}Voorbeeld-IDS bekijken</button></div></section>
    </section>`;
  }

  function openSources(ruleId = "") {
    state.sourceReturnRule = ruleId;
    sourceInspection = false;
    if (dialog.open) dialog.close();
    if (!state.project && state.saved?.project) openProject(state.saved.project, state.saved);
    navigate("sources");
  }

  function sourceRules(key) {
    if (!sourceRecords().some(record => record.key === key && record.used.length)) return;
    state.sourceRuleFilter = key;
    state.search = "";
    state.propertySet = "";
    state.ifcSelection = new Set(availableEntities().map(entity => entity.code));
    rememberFilters();
    navigate("mappings");
  }

  function removeSourceDialog(key) {
    const record = sourceRecords().find(item => item.key === key);
    if (!record || record.used.length || record.retained || !record.sourceId) return;
    showDialog(`<section data-dialog-route="remove-source"><h2 id="dialog-title">Bron verwijderen?</h2><p class="dialog-subject">${escapeHtml(record.label)}</p><p>Deze bron is niet aan regels gekoppeld. Het bronbestand verdwijnt uit dit werkblad.</p><p class="form-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button><button type="button" class="button danger-button" data-action="confirm-remove-source" data-value="${escapeHtml(key)}">Verwijderen</button></div></section>`);
  }

  function removeSource(key) {
    const record = sourceRecords().find(item => item.key === key);
    if (!record || record.used.length || record.retained) return;
    const field = record.kind === "ids" ? "idsImports" : record.kind === "library" ? "libraryImports" : "";
    if (!field) return;
    const list = state.project.sourceData[field];
    const matches = item => item.id === record.sourceId && (record.kind !== "library" || item.version === record.sourceVersion);
    const related = (state.project.sourceData.idsImports || []).filter(item => !matches(item));
    if (record.kind === "ids" && related.some(item => JSON.stringify(item).includes(record.sourceId))) {
      const error = dialog.querySelector(".form-error");
      error.textContent = "Een andere IDS-bron verwijst nog naar deze versie. Bewaar deze bron bij het werkblad.";
      error.hidden = false;
      return;
    }
    lastSourceRemoval = { field, source: list.find(matches), index: list.findIndex(matches) };
    state.project.sourceData[field] = list.filter(item => !matches(item));
    state.revised = true;
    dialog.close();
    render();
    document.getElementById("sources-title")?.focus();
    message("Ongebruikte bron uit het werkblad verwijderd.", true, "undo-source-removal");
  }

  function undoSourceRemoval() {
    if (!lastSourceRemoval || !state.project) return;
    const { field, source, index } = lastSourceRemoval;
    const list = state.project.sourceData[field] || [];
    if (!list.some(item => item.id === source.id && item.version === source.version)) {
      const next = [...list];
      next.splice(Math.min(index, next.length), 0, source);
      state.project.sourceData[field] = next;
      state.revised = true;
    }
    lastSourceRemoval = null;
    render();
    message("Bron teruggezet.");
    document.getElementById("sources-title")?.focus();
  }

  function issueGroups(issues) {
    return Map.groupBy(issues, issue => issueGroupKey(issue.rows[0]));
  }

  function reviewSummary(issues, candidates) {
    const ready = !issues.length && activeRows().length > 0;
    return `<div class="review-header">
      <div class="review-heading"><h3 id="review-heading" tabindex="-1">${issues.length ? "Exportproblemen" : ready ? "Alles opgelost" : "Geen actieve koppelingen"}</h3>
        <span class="state ${issues.length ? "warning" : ready ? "valid" : "inactive"}">${icon(issues.length ? "alert" : ready ? "check" : "file")}${issues.length ? wordCount(issues.length, "probleem", "problemen") : ready ? "Klaar voor export" : "Schakel een toepassing in"}</span></div>
      ${ready ? '<button type="button" class="button primary" data-action="export">Verder naar export</button>' : ""}
      ${candidates.size ? '<p class="review-guidance">Dezelfde keuze voor meerdere IFC-entiteiten? Selecteer de regels om ze samen op te lossen.</p>' : ""}
      <div id="review-batch">${reviewBatchControls(candidates)}</div>
    </div>`;
  }

  function batchConflict(problems) {
    if (problems.length !== 1 || problems[0].kind !== "duplicate") return null;
    const rows = problems[0].rows;
    const choices = rows.map(row => {
      const parameter = rowParameter(row);
      const useIfcName = !parameter.trim();
      return {
        id: JSON.stringify([useIfcName ? "" : parameter, row.type]),
        row,
        useIfcName,
        label: useIfcName ? "Zelfde naam als IFC" : parameter
      };
    });
    const keys = choices.map(choice => choice.id).sort();
    if (new Set(keys).size !== choices.length) return null;
    return { choices, signature: JSON.stringify([issueGroupKey(rows[0]), keys]) };
  }

  function reviewEntries(issues) {
    const byTarget = Map.groupBy(issues, issue => exportTargetKey(issue.rows[0]));
    for (const target of byTarget.keys()) state.review.targets.add(target);
    const rows = state.project.rows.filter(row => state.review.targets.has(exportTargetKey(row)));
    const filteredIds = new Set(filteredRows().map(row => row.id));
    return [...Map.groupBy(rows, exportTargetKey)].map(([target, applications]) => {
      const problems = byTarget.get(target) || [];
      const affected = problems.length ? problems.flatMap(problem => problem.rows) : applications;
      return {
        target, applications, problems,
        inFilters: affected.some(row => filteredIds.has(row.id)),
        batch: batchConflict(problems)
      };
    });
  }

  function batchCandidates(entries) {
    const groups = Map.groupBy(entries.filter(entry => entry.batch), entry => entry.batch.signature);
    const candidates = new Map();
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (const entry of group) candidates.set(entry.target, entry.batch);
    }
    return candidates;
  }

  function pruneBatch(candidates) {
    const batch = state.review.batch;
    if (!batch) return;
    for (const target of batch.selected) {
      if (candidates.get(target)?.signature !== batch.signature) batch.selected.delete(target);
    }
    if (!batch.selected.size) state.review.batch = null;
  }

  function reviewBatchControls(candidates) {
    const batch = state.review.batch;
    if (!batch) return "";
    const count = batch.selected.size;
    const { choices } = candidates.get(batch.selected.values().next().value);
    const keeper = choices.find(choice => choice.id === batch.keep);
    const label = choice => {
      const ambiguous = choices.filter(option => option.label.trim() === choice.label.trim()).length > 1;
      if (!ambiguous) return choice.label;
      const mapping = choice.useIfcName ? "IFC-naam overnemen" : `Revit-parameter ‘${choice.label}’`;
      return `${mapping} (${choice.row.type})`;
    };
    const scope = `Behouden voor ${wordCount(count, "entiteit", "entiteiten")}`;
    return `<div class="review-batch-controls">
      <span class="small" aria-live="polite">${count} geselecteerd</span>
      <select class="set-filter" id="review-keeper" aria-label="Te behouden Revit-parameter">
        <option value="">Kies te behouden waarde</option>
        ${choices.map(choice => `<option value="${escapeHtml(choice.id)}"${choice === keeper ? " selected" : ""}>${escapeHtml(label(choice))}</option>`).join("")}
      </select>
      <button type="button" class="button primary" data-action="resolve-batch"${count < 2 || !keeper ? " disabled" : ""}
        ${keeper ? `title="${escapeHtml(`${label(keeper)} ${scope}`)}"` : ""}>
        ${scope}
      </button>
      ${keeper && label(keeper).length > 36 ? `<p class="review-batch-value">Gekozen: <strong>${breakableIdentifier(label(keeper))}</strong></p>` : ""}
    </div>`;
  }

  function breakableIdentifier(value) {
    return escapeHtml(value).replace(/_/g, "_<wbr>");
  }

  function reviewList(entries, candidates) {
    const scopes = filtersActive()
      ? [[true, "Binnen je filters", entries.filter(entry => entry.inFilters)], [false, "Buiten je filters", entries.filter(entry => !entry.inFilters)]]
      : [[false, "", entries]];
    return scopes.filter(([, , list]) => list.length).map(([highlight, scope, list]) => `<section class="review-scope">
      ${scope ? `<h3 class="review-scope-title${highlight ? " in-filters" : ""}">${scope} <span>${wordCount(list.length, "probleemlocatie", "probleemlocaties")}</span></h3>` : ""}
      ${[...Map.groupBy(list, entry => issueGroupKey(entry.applications[0]))].map(([key, group]) => {
        const [set, name] = JSON.parse(key);
        const kinds = new Set(group.flatMap(entry => entry.problems.map(problem => problem.kind)));
        const sourceFields = group.some(entry => entry.applications.some(row => UDPSRuleFields.origin(state.project, row).linked));
        const instruction = kinds.has("duplicate") ? "Kies per IFC-entiteit welke Revit-parameter je wilt behouden." : kinds.has("parameter") ? "Vul de ontbrekende Revit-parameter in." : kinds.has("invalid") ? sourceFields ? "Controleer de brongegevens of schakel de betrokken IFC-entiteit uit voor export." : "Corrigeer de IFC-velden of schakel de IFC-entiteit uit voor export." : "De herstelde toepassingen blijven hieronder zichtbaar.";
        return `<section class="review-section">
          <div class="review-title" data-review-property="${escapeHtml(key)}" tabindex="-1">
            <div><h4>${escapeHtml(name || "Eigenschap ontbreekt")}</h4><p class="small muted">${escapeHtml(set || "Propertyset ontbreekt")}</p></div>
            <span class="small muted">${wordCount(group.length, "IFC-entiteit", "IFC-entiteiten")}</span>
          </div>
          <p class="review-instruction">${instruction}</p>
          <div class="review-labels" aria-hidden="true"><span>IFC-entiteit</span><span>${kinds.has("duplicate") ? "Te behouden Revit-parameter" : "Herstel"}</span></div>
          ${group.map(entry => reviewRow(entry, candidates.get(entry.target), highlight)).join("")}
        </section>`;
      }).join("")}
    </section>`).join("");
  }

  function reviewRow(entry, candidate, highlight) {
    const { target, applications, problems } = entry;
    const row = applications[0];
    const messages = [...new Set(problems.filter(issue => issue.kind === "invalid").map(issue => issue.message))];
    const batch = state.review.batch;
    const duplicate = applications.length > 1;
    const active = applications.filter(application => application.active);
    return `<div class="review-row${highlight ? " in-filters" : ""}">
      <div class="review-entity">
        ${candidate ? `<label class="batch-checkbox" title="Selecteren voor groepsactie">
          <input type="checkbox" data-review-select="${escapeHtml(target)}"
            aria-label="Conflict selecteren voor ${escapeHtml(`${row.name} op ${row.entity} in ${row.propertySet}`)}"
            ${batch?.selected.has(target) ? "checked" : ""}${batch && batch.signature !== candidate.signature ? " disabled" : ""}>
        </label>` : ""}
        <div class="review-entity-description"><strong>${escapeHtml(row.entity || "IFC-entiteit ontbreekt")}</strong>
          ${messages.length ? `<small class="review-warning">${escapeHtml(messages.join(" · "))}</small>` : !problems.length ? `<small class="review-resolved">${icon("check")}Opgelost</small>` : ""}</div>
      </div>
      <div class="review-options">${applications.map(application => reviewOption(application, { duplicate, selected: active.length === 1 && active[0].id === application.id, target, invalid: problems.some(problem => problem.kind === "invalid" && problem.rows.some(item => item.id === application.id)) })).join("")}</div>
    </div>`;
  }

  function reviewOption(row, { duplicate = false, selected = false, target = "", invalid = false } = {}) {
    const subject = rowParameter(row) || (missingParameter(row) ? row.name : "Zelfde naam als IFC");
    const editing = state.editor?.inReview && state.editor.rowId === row.id;
    const protectedFields = UDPSRuleFields.origin(state.project, row).linked;
    const rule = invalid && protectedFields ? combinationGroups(false).find(group => group.allApplications.some(item => item.id === row.id)) : null;
    if (editing) return `<div class="review-option is-editing">${parameterCell({ key: row.key }, row, { inReview: true })}</div>`;
    return `<div class="review-option${selected ? " is-kept" : ""}">
      ${duplicate ? `<label class="review-keep"><input type="radio" name="keep-${escapeHtml(target)}" data-review-keep="${escapeHtml(row.id)}" aria-label="Behoud ${escapeHtml(subject)} voor ${escapeHtml(row.entity)}"${selected ? " checked" : ""}><span>${breakableIdentifier(rowParameter(row) || (missingParameter(row) ? "Parameter ontbreekt" : "Zelfde naam als IFC"))}</span></label>
        <button type="button" class="cell-button review-edit" data-action="edit-review" data-value="${escapeHtml(row.id)}" aria-label="Revit-parameter bewerken voor ${escapeHtml(subject)} op ${escapeHtml(row.entity)}" title="Parameter bewerken">${icon("edit")}</button>` : `<label class="export-cell" title="Actief in export">
        <input type="checkbox" id="review-export-${escapeHtml(row.id)}" data-review-export="${escapeHtml(row.id)}"
          aria-label="Actief in export voor ${escapeHtml(`${subject} op ${row.entity}`)}"${row.active ? " checked" : ""}>
      </label>${missingParameter(row) ? `<button type="button" class="button review-fill" data-action="edit-review" data-value="${escapeHtml(row.id)}">${icon("edit")}Parameter invullen</button>` : parameterCell({ key: row.key }, row, { inReview: true })}`}
      ${invalid ? protectedFields && rule ? `<button type="button" class="text-button review-fields" data-action="rule-source" data-value="${escapeHtml(rule.id)}">${icon("library")}Brongegevens bekijken</button>` : `<button type="button" class="text-button review-fields" data-action="edit-fields" data-value="${escapeHtml(row.id)}">${icon("edit")}IFC-velden corrigeren</button>` : ""}
    </div>`;
  }

  function exportPage() {
    const issues = exportIssues();
    const count = activeRows().length;
    const good = count > 0 && issues.length === 0;
    const label = issues.length ? wordCount(issues.length, "exportprobleem", "exportproblemen") : good ? "Klaar voor export" : "Nog geen actieve koppelingen";
    return `
      <aside class="workspace-panel export-panel" id="workspace-panel" aria-labelledby="workspace-panel-title">
        ${panelHeading("Exporteren")}
        <div class="workspace-panel-content">
            <div class="export-status ${good ? "is-ready" : issues.length ? "is-blocked" : "is-empty"}">
              <span class="status-symbol">${icon(good ? "check" : issues.length ? "alert" : "file")}</span>
              <div><strong>${label}</strong><p>${good ? "Alle actieve koppelingen zijn gecontroleerd." : issues.length ? "Los de problemen op voordat je exporteert." : "Voeg koppelingen toe of schakel ze in voor export."}</p></div>
            </div>
            <div class="export-meta"><span>${wordCount(count, "actieve koppeling", "actieve koppelingen")}</span><span>UDPS.txt</span></div>
            <label class="field export-sorting">Sorteren op<select id="export-order" aria-label="Export sorteren op"><option value="propertyset"${!state.project.sourceData?.exportOrder || state.project.sourceData.exportOrder === "propertyset" ? " selected" : ""}>Propertyset</option><option value="entity"${state.project.sourceData?.exportOrder === "entity" ? " selected" : ""}>IFC-entiteit</option><option value="classification"${state.project.sourceData?.exportOrder === "classification" ? " selected" : ""}>Classificatie</option></select></label>
            ${issues.length ? `<ul class="checks">${[...issueGroups(issues)].map(([key, group]) => {
              const [set, name] = JSON.parse(key);
              return `<li class="issue">
                <span><strong>${escapeHtml(name || "Eigenschap ontbreekt")}</strong><small>${escapeHtml(set)}</small><small>${wordCount(group.length, "exportprobleem", "exportproblemen")}</small></span>
                <button type="button" class="button" data-action="review" data-value="${escapeHtml(key)}">Oplossen</button>
              </li>`;
            }).join("")}</ul>` : ""}
            ${good ? `<details class="export-text-preview"${state.exportPreviewOpen ? " open" : ""}><summary id="export-preview-toggle">${icon("file")}TXT-voorbeeld</summary><pre class="terminal" id="txt-preview" tabindex="0">${escapeHtml(UDPSProjectFiles.exportText(state.project))}</pre></details>` : ""}
        </div>
        <footer class="panel-actions export-actions"><button type="button" class="text-button" data-action="copy-txt" ${good ? "" : "disabled"}>Kopiëren</button>
          <button type="button" class="button primary" data-action="download-txt" ${good ? "" : "disabled"}>${icon("download")}Download UDPS.txt</button></footer>
      </aside>`;
  }

  function matrixPosition() {
    const scroll = root.querySelector(".matrix-scroll");
    return scroll ? { left: scroll.scrollLeft, top: scroll.scrollTop } : null;
  }

  function fitMatrixViewport() {
    const scroll = root.querySelector(".matrix-scroll");
    if (!scroll) return;
    const top = Math.max(0, scroll.getBoundingClientRect().top);
    scroll.style.setProperty("--matrix-height", `${Math.max(230, window.innerHeight - top - 25)}px`);
  }

  function render(position = matrixPosition()) {
    studio.track();
    document.body.dataset.view = state.view;
    document.body.dataset.hasProject = Boolean(state.project);
    homeLink.hidden = state.view === "start";
    if (state.view === "start") {
      root.innerHTML = startPage();
      return;
    }
    const content = state.view === "sources" ? sourcesPage() : mappingsPage();
    root.innerHTML = workspaceHeader() + content + (state.panel === "sources" ? sourcesPage(true) : state.panel === "export" ? exportPage() : "");
    if (state.view === "mappings") renderMappingList(position);
  }

  function renderMappingList(position = matrixPosition()) {
    const list = document.getElementById("mapping-list");
    const summary = document.getElementById("mapping-summary");
    const issues = exportIssues();
    const toolbarStatus = document.getElementById("toolbar-status");
    if (toolbarStatus) toolbarStatus.innerHTML = toolbarIssueActions(issues);
    if (state.review) {
      const entries = reviewEntries(issues);
      const candidates = batchCandidates(entries);
      pruneBatch(candidates);
      summary.innerHTML = reviewSummary(issues, candidates);
      list.innerHTML = reviewList(entries, candidates);
      return;
    }
    const groups = combinationGroups();
    const matrix = matrixViewport.matches;
    summary.innerHTML = mappingSummary(groups, matrix);
    list.innerHTML = mappingList(groups, issues, matrix);
    for (const checkbox of list.querySelectorAll("[data-export-mixed]")) {
      checkbox.indeterminate = true;
    }
    if (position) list.querySelector(".matrix-scroll")?.scrollTo(position.left, position.top);
    fitMatrixViewport();
  }

  function captureDialog() {
    const copy = dialog.cloneNode(true);
    copy.querySelector(".dialog-back")?.remove();
    const originals = [...dialog.querySelectorAll("input, select, textarea, details")];
    [...copy.querySelectorAll("input, select, textarea, details")].forEach((control, index) => {
      const original = originals[index];
      if (control.tagName === "SELECT") [...control.options].forEach((option, i) => option.toggleAttribute("selected", original.options[i].selected));
      else if (control.tagName === "TEXTAREA") control.textContent = original.value;
      else if (control.tagName === "DETAILS") control.toggleAttribute("open", original.open);
      else if (control.type !== "file") {
        control.setAttribute("value", original.value);
        control.toggleAttribute("checked", original.checked);
      }
    });
    return { markup: copy.innerHTML, route: dialogRoute, title: dialog.querySelector("h2")?.textContent || "vorige venster" };
  }

  function showDialog(markup, { replace = false, fromBack = false, resetTrail = false } = {}) {
    if (resetTrail) dialogTrail=[];
    const template = document.createElement("template");
    template.innerHTML = markup;
    const route = template.content.querySelector("[data-dialog-route]")?.dataset.dialogRoute || template.content.querySelector("form")?.id || template.content.querySelector("h2")?.textContent || "dialog";
    if (!dialog.open) { dialogTrigger = document.activeElement; dialogTrail = []; }
    else if (!replace && route !== dialogRoute) dialogTrail.push(captureDialog());
    else if (replace && !fromBack && dialogTrail.at(-1)?.route === route) dialogTrail.pop();
    dialogRoute = route;
    dialog.innerHTML = markup;
    if (dialogTrail.length) dialog.insertAdjacentHTML("afterbegin", `<button type="button" class="text-button dialog-back" data-action="dialog-back">${icon("arrow-left")}Terug naar ${escapeHtml(dialogTrail.at(-1).title)}</button>`);
    if (!dialog.open) dialog.showModal();
    const focusTarget = dialog.querySelector('[data-focus], input:not([type="hidden"]), .dialog-back') || dialog.querySelector("h2");
    if (focusTarget?.tagName === "H2") focusTarget.tabIndex = -1;
    focusTarget?.focus();
  }

  function dialogBack() {
    const previous = dialogTrail.pop();
    if (!previous) return dialog.close();
    dialog.dispatchEvent(new Event("udps:dialog-back"));
    showDialog(previous.markup, { replace: true, fromBack: true });
  }

  function buttonRow(submitLabel) {
    return `<div class="dialog-actions">
      <button type="button" class="button" data-action="cancel">Annuleren</button>
      <button type="submit" class="button primary">${submitLabel}</button>
    </div>`;
  }

  function columnsDialog() {
    showDialog(`<form id="choose-columns" aria-describedby="column-visibility-help"><h2 id="dialog-title">IFC-kolommen</h2>
      <p class="small muted" id="column-visibility-help">Kolommen verbergen verandert niet welke toepassingen worden geëxporteerd.</p>
      <div class="column-options-actions">
        <button type="button" class="text-button" data-action="select-columns" data-value="all">Alle selecteren</button>
        <button type="button" class="text-button" data-action="select-columns" data-value="none">Geen selecteren</button>
      </div>
      <div class="column-options">${availableEntities().map(entity => `
        <label class="column-option">
          <input type="checkbox" name="entity" value="${escapeHtml(entity.code)}"${state.ifcSelection.has(entity.code) ? " checked" : ""}>
          <strong>${escapeHtml(entity.code)}</strong>
          ${entity.label ? `<small class="muted">${escapeHtml(entity.label)}</small>` : ""}
        </label>`).join("")}
      </div>
      ${buttonRow("Toepassen")}
    </form>`);
  }

  function newDialog() { idsInterface.newDialog(); }

  function emptyProjectDialog() {
    showDialog(`<form id="new-project"><h2 id="dialog-title">Nieuw werkblad</h2>
      <div class="dialog-fields"><label class="field">Naam
        <input required name="project-name" maxlength="72" placeholder="Bijv. Deuren en kozijnen">
      </label></div>
      ${buttonRow("Beginnen")}
    </form>`);
  }

  function openDialog() {
    showDialog(`<form id="open-project-file"><h2 id="dialog-title">Werkblad openen</h2>
      <div class="dialog-fields">
        <label class="field">UDPS-werkblad of Excel<input type="file" name="project-file" accept=".json,.xlsx,.xlsm,application/json" required></label>
        <p class="form-error" role="alert" hidden></p>
      </div>
      ${buttonRow("Openen")}
    </form>`);
  }

  function examplesDialog() {
    showDialog(`<h2 id="dialog-title">Voorbeeldproject openen</h2>
      <div class="start-options">
        <button class="action-card" type="button" data-action="example" data-value="large" data-focus>
          <span class="action-icon">${icon("library")}</span>
          <span><strong>Groot voorbeeldproject</strong><small class="muted">58 regels · 416 toepassingen</small></span>
        </button>
        <button class="action-card" type="button" data-action="example" data-value="small">
          <span class="action-icon">${icon("file")}</span>
          <span><strong>Klein voorbeeldproject</strong><small class="muted">8 toepassingen · 3 IFC-entiteiten</small></span>
        </button>
      </div>
      <div class="dialog-actions"><button class="button" type="button" data-action="cancel">Annuleren</button></div>`);
  }

  function switchProject(project) {
    if (!state.revised) {
      if (dialog.open) dialog.close();
      openProject(project);
      return;
    }
    pendingProject = project;
    showDialog(`<h2 id="dialog-title">Onbewaarde wijzigingen</h2>
      <p>Bewaar ${escapeHtml(state.project.name)} voordat je ${escapeHtml(project.name)} opent.</p>
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions switch-actions">
        <button type="button" class="button" data-action="cancel" data-focus>Verder bewerken</button>
        <button type="button" class="text-button" data-action="discard-and-open">Openen zonder bewaren</button>
        <button type="button" class="button primary" data-action="save-and-open">Bewaren en openen</button>
      </div>`);
  }

  function finishSwitch() {
    if (!pendingProject) return;
    const project = pendingProject;
    pendingProject = null;
    dialog.close();
    openProject(project);
  }

  async function loadProjectFile(form) {
    const input = form.elements["project-file"];
    const file = input.files[0];
    if (!file) return;
    const button = form.querySelector('button[type="submit"]');
    const error = form.querySelector(".form-error");
    error.hidden = true;
    button.disabled = true;
    try {
      if (file.size > maxProjectBytes) throw new Error("Het bestand is groter dan 32 MiB.");
      const text = /\.xls[xm]$/i.test(file.name)
        ? JSON.stringify(await productionSources.readExcel(file)) : await file.text();
      if (!dialog.open || !form.isConnected || input.files[0] !== file) return;
      switchProject(UDPSProjectFiles.open(text, file.name));
    } catch (failure) {
      if (!form.isConnected) return;
      error.textContent = failure.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  function addRuleDialog() {
    sourceInspection = false;
    showDialog(`<section data-dialog-route="add-rule-choice"><h2 id="dialog-title">Regel toevoegen</h2>
      <div class="new-project-choices"><button type="button" class="project-choice" data-action="own-rule"><strong>Eigen regel</strong><span>Zelf een IFC eigenschap en Revit parameter instellen</span><span aria-hidden="true">→</span></button>
      <button type="button" class="project-choice" data-action="rule-from-source"><strong>Uit een bron</strong><span>Regels kiezen uit een bibliotheek of IDS</span><span aria-hidden="true">→</span></button></div>
      <div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`);
  }

  function addDialog() {
    const entityCode = state.ifcSelection.values().next().value || "IfcDoor";
    const defaultSet = state.propertySet || entityName(entityCode)?.propertySet || "";
    showDialog(`<form id="add-property-form"><h2 id="dialog-title">Eigen regel toevoegen</h2>
      <div class="dialog-fields"><label class="field">IFC-entiteit<input type="hidden" name="entity" value="${escapeHtml(entityCode)}"><button type="button" class="button entity-field" data-action="pick-new-rule-entity"><span id="new-rule-entity-label">${escapeHtml(entityCode)}</span>${icon("chevron-down")}</button></label>
        <label class="field">Propertyset<input name="set" value="${escapeHtml(defaultSet)}" required maxlength="500"></label>
        <label class="field">IFC eigenschap<input name="property" placeholder="Bijv. IsExternal" required maxlength="500"></label>
        <label class="field">Datatype<select name="type">${Object.entries(types).map(([type, label]) => `<option value="${type}">${label}</option>`).join("")}</select></label>
        <label class="field">Revit parameter<input name="parameter" placeholder="Later invullen kan ook" maxlength="500"></label>
        <p class="form-error" role="alert" id="add-error" hidden></p>
      </div>${buttonRow("Regel toevoegen")}</form>`);
  }

  function entityPicker(id = "") {
    const group = id ? findCombination(id) : null;
    if (id && (!group || ruleFields(group).linked)) return message("Deze IFC-entiteiten volgen de bron. Voeg een eigen regel toe voor eigen entiteiten.");
    entityPickerState = { id, version: entityPickerState?.version || "IFC4X3", query: "" };
    showDialog(`<section data-dialog-route="entity-picker:${escapeHtml(id || "new-rule")}"><h2 id="dialog-title">${id ? "IFC-entiteit toevoegen" : "IFC-entiteit kiezen"}</h2>
      ${group ? `<p class="dialog-subject">${escapeHtml(group.name)} · ${breakableIdentifier(group.parameter || "zonder parameter")}</p>` : ""}
      <div class="entity-picker-controls"><label class="field">IFC-versie<select id="entity-version">${UDPSIfcCatalog.versions.map(version => `<option value="${version.id}"${version.id === entityPickerState.version ? " selected" : ""}>${version.label}</option>`).join("")}</select></label>
      <label class="field">Entiteit zoeken<input id="entity-search" type="search" placeholder="Bijv. door, wall of air terminal" autocomplete="off"></label></div>
      <p class="small muted">De versie helpt bij het zoeken en wordt niet in de regel vastgelegd.</p>
      <div class="entity-picker-list" id="entity-picker-list">${entityPickerList()}</div>
      <div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`);
    dialog.querySelector("#entity-search")?.focus();
  }

  function entityPickerList() {
    const picker = entityPickerState;
    if (!picker) return "";
    const group = picker.id ? findCombination(picker.id) : null;
    const present = new Set(state.project?.rows.map(row => row.entity) || []);
    const linked = new Set(group?.allApplications.map(row => row.entity) || []);
    const results = UDPSIfcCatalog.search(picker.version, picker.query);
    return results.map(entity => `<button type="button" class="entity-picker-option" data-action="select-rule-entity" data-value="${escapeHtml(entity.code)}"${linked.has(entity.code) ? " disabled" : ""}>
      <span><strong>${escapeHtml(entity.code)}</strong>${entity.abstract ? '<small>Basisklasse</small>' : ""}</span>
      ${linked.has(entity.code) ? '<span class="entity-present">In deze regel</span>' : present.has(entity.code) ? '<span class="entity-present">In het werkblad</span>' : icon("plus")}
    </button>`).join("") || '<p class="empty-picker">Geen entiteiten gevonden. Probeer een andere zoekterm of IFC-versie.</p>';
  }

  function chooseRuleEntity(code) {
    const picker = entityPickerState;
    if (!picker || !UDPSIfcCatalog.search(picker.version, "").some(entity => entity.code === code)) return;
    if (!picker.id) {
      dialogBack();
      const form = dialog.querySelector("#add-property-form");
      if (!form) return;
      form.elements.entity.value = code;
      form.querySelector("#new-rule-entity-label").textContent = code;
      form.querySelector('[data-action="pick-new-rule-entity"]').focus();
      return;
    }
    const group = findCombination(picker.id);
    if (!group) return;
    if (group.familyApplications.some(row => row.entity === code)) {
      combinationDialog(picker.id, { entity: code });
      return;
    }
    linkRuleEntity(picker.id, code);
  }

  function linkRuleEntity(id, entity) {
    if (typeof entity !== "string" || !/^Ifc[A-Za-z0-9]+$/.test(entity)) return message("Kies een geldige IFC-entiteit.");
    const group = findCombination(id);
    if (!group || ruleFields(group).linked) return message("De IFC-entiteiten van deze regel volgen de bron.");
    const fields = ruleFields(group);
    if (fields.mixedTypes) return message("Kies eerst één datatype voor de regel.");
    if (group.familyApplications.some(row => row.entity === entity)) return combinationDialog(id, { entity });
    const original = group.allApplications[0] || group.representative;
    const standard = state.project.standards[original.key] || "";
    const row = { ...original, id: `own-${crypto.randomUUID()}`, entity, sourceIndex: undefined, propertySet: group.propertySet, name: group.name,
      type: fields.types[0] || original.type, source: "Eigen regel", active: true, implicitRevit: group.parameterKind === "implicit",
      override: group.parameterKind === "named" && group.parameter === standard ? null : group.parameter };
    state.project.rows.push(row);
    state.ifcSelection.add(entity);
    state.collapsedSets.delete(group.propertySet);
    state.revised = true;
    if (dialog.open) {
      const managerIndex = dialogTrail.findLastIndex(frame => frame.route === `rule:${id}`);
      if (managerIndex >= 0) { dialogTrail.splice(managerIndex); manageCombination(id, { replace: true }); }
      else dialog.close();
    }
    render();
    focusCombinationForApplication(row.id);
    message(`${entity} aan de regel toegevoegd.`);
  }

  function addRowFromForm(form) {
    const fields = new FormData(form);
    const entity = fields.get("entity");
    const propertySet = fields.get("set").trim();
    const name = fields.get("property").trim();
    if (!propertySet || !name) return;
    const exists = state.project.rows.some(row => row.entity === entity && row.propertySet === propertySet && row.name === name);
    if (exists) {
      const error = document.getElementById("add-error");
      error.textContent = `Deze regel bestaat al bij ${entity}.`;
      error.hidden = false;
      return;
    }
    const id = `own-${crypto.randomUUID()}`;
    const row = makeRow(id, entity, propertySet, name, name, fields.get("type"), id, "Eigen regel");
    state.project.rows.push(row);
    state.project.standards[id] = fields.get("parameter").trim();
    state.revised = true;
    dialog.close();
    focusMapping(row);
  }

  function focusControl(action, value) {
    const matchingValue = value === undefined ? "" : `[data-value="${CSS.escape(value)}"]`;
    const control = root.querySelector(`[data-action="${CSS.escape(action)}"]${matchingValue}`);
    if (!control?.getClientRects().length) return false;
    control.focus();
    return true;
  }

  function manageProperty(key) {
    const rows = state.project.rows.filter(row => row.key === key);
    if (!rows.length) return;
    showDialog(`<h2 id="dialog-title">Regel beheren</h2><p class="dialog-subject">${escapeHtml(rows[0].name)}</p>
      <div class="application-manager">${rows.map(row => `<div class="managed-application"><div><strong>${escapeHtml(row.entity)}</strong><small>${escapeHtml(row.propertySet || "Propertyset ontbreekt")} · ${escapeHtml(types[row.type] || row.type || "Datatype ontbreekt")}</small></div><button type="button" class="button" data-action="edit-fields" data-value="${escapeHtml(row.id)}">Bewerken</button></div>`).join("")}</div>
      <div class="dialog-actions manager-actions"><button type="button" class="text-button danger-text" data-action="remove-property" data-value="${escapeHtml(key)}">Regel verwijderen</button><button type="button" class="button" data-action="add-application" data-value="${escapeHtml(key)}">${icon("plus")}IFC-toepassing</button><button type="button" class="button" data-action="cancel">Sluiten</button></div>`);
  }

  function focusCombinationForApplication(id) {
    const group = combinationGroups().find(item => item.applications.some(row => row.id === id));
    const control = group && root.querySelector(`[data-combination="${CSS.escape(group.id)}"] .row-parameter`);
    if (!control?.getClientRects().length) return false;
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }

  function focusStandardFamily(familyId, keys) {
    const group = combinationGroups().find(item => item.familyId === familyId && item.isStandard && item.baseKeys.some(key => keys.includes(key)));
    if (group && focusControl("combination-standard", group.id)) return true;
    return false;
  }

  function manageCombination(id, options = {}) {
    const group = findCombination(id);
    if (!group) return;
    const fields = ruleFields(group);
    showDialog(`<section data-dialog-route="rule:${escapeHtml(id)}"><h2 id="dialog-title">Regel beheren</h2><p class="dialog-subject">${escapeHtml(group.propertySet)} · ${escapeHtml(group.name)}</p>
      <p class="combination-current">${breakableIdentifier(group.parameter || (group.parameterKind === "implicit" ? "Zelfde naam als IFC" : "Parameter ontbreekt"))}</p>
      ${fields.linked ? `<div class="rule-source-note">${icon("library")}<span>IFC-velden en datatype volgen de bron.</span><button type="button" class="text-button" data-action="rule-source" data-value="${escapeHtml(id)}">Bron bekijken</button></div>` : ""}
      <div class="application-manager">${group.allApplications.map(row => `<div class="managed-application"><div><strong>${escapeHtml(row.entity)}</strong><small>${escapeHtml(types[UDPSProjectFiles.exportDataType(row.type)] || row.type || "Datatype ontbreekt")}</small></div><button type="button" class="button" data-action="edit-fields" data-value="${escapeHtml(row.id)}">${UDPSRuleFields.origin(state.project, row).linked ? "Bekijken" : "IFC-velden"}</button></div>`).join("") || '<p class="small muted">Geen IFC-entiteit gebruikt deze standaard.</p>'}</div>
      <div class="dialog-actions manager-actions">${group.allApplications.length ? `<button type="button" class="text-button danger-text" data-action="remove-combination" data-value="${escapeHtml(id)}">Regel verwijderen</button>` : ""}
        <button type="button" class="button" data-action="new-combination" data-value="${escapeHtml(id)}">${icon("plus")}Afwijkende Revit parameter</button>
        <button type="button" class="button" data-action="add-combination-application" data-value="${escapeHtml(id)}"${fields.linked ? ' disabled title="De IFC-entiteiten volgen de bron"' : ""}>${icon("plus")}IFC entiteit</button><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`, options);
  }

  function combinationStandardDialog(id, trigger) {
    const group = findCombination(id);
    if (!group?.baseKeys.length) return;
    const rowId = group.applications[0]?.id || group.representative.id;
    if (group.baseKeys.length === 1) return standardDialog(group.baseKeys[0], trigger, rowId, group.familyId);
    const keys = new Set(group.baseKeys);
    const followers = state.project.rows.filter(row => keys.has(row.key) && row.override == null);
    showDialog(`<form id="edit-combination-standards" data-keys="${escapeHtml(JSON.stringify(group.baseKeys))}" data-row-id="${escapeHtml(rowId)}" data-family="${escapeHtml(group.familyId)}">
      <h2 id="dialog-title">Revit parameter (standaard)</h2><p class="dialog-subject">${escapeHtml(group.propertySet)} · ${escapeHtml(group.name)}</p>
      <div class="central-edit-scope"><strong>${wordCount(group.baseKeys.length, "standaard", "standaarden")} · ${wordCount(followers.length, "toepassing", "toepassingen")}</strong><p>${escapeHtml([...new Set(followers.map(row => row.entity))].join(", ")) || "Geen toepassing volgt deze standaarden."}</p><p>Afwijkende Revit parameters blijven behouden.</p></div>
      <div class="dialog-fields"><label class="field">Revit parameter<input name="standard" value="${escapeHtml(group.parameter)}" required maxlength="500"></label></div>${buttonRow("Standaarden toepassen")}</form>`);
  }

  function combinationDialog(id, { create = false, entity = "" } = {}) {
    const group = findCombination(id);
    if (!group) return;
    const visible = new Set(filteredRows().map(row => row.id));
    const rows = (create || entity ? group.familyApplications : group.applications)
      .filter(row => visible.has(row.id) && (!entity || row.entity === entity));
    if (!rows.length) return message("Kies eerst de betrokken IFC-kolommen of verruim je filters.");
    const fixedKind = !create && entity && group.parameterKind !== "named" ? group.parameterKind : "named";
    showDialog(`<form id="edit-combination" data-allowed="${escapeHtml(JSON.stringify(rows.map(row => row.id)))}" data-parameter-kind="${fixedKind}">
      <h2 id="dialog-title">${create ? "Afwijkende Revit parameter" : entity ? "Revit parameter gebruiken" : "Revit parameter wijzigen"}</h2>
      <p class="dialog-subject">${escapeHtml(group.propertySet)} · ${escapeHtml(group.name)}</p>
      <div class="dialog-fields">${fixedKind !== "named" ? `<p class="combination-current">${fixedKind === "implicit" ? "Zelfde naam als IFC" : "Parameter ontbreekt"}<input type="hidden" name="parameter" value=""></p>` : `<label class="field">Revit parameter<input name="parameter" value="${escapeHtml(create ? "" : group.parameter)}" required maxlength="500" placeholder="Parameternaam"></label>`}
        <fieldset class="combination-targets"><legend>IFC-toepassingen${filtersActive() ? " binnen je filters" : ""}</legend>
          <p class="small muted">${create ? "Kies welke toepassingen deze parameter gaan gebruiken." : "De wijziging geldt voor de aangevinkte toepassingen."}</p>
          <div class="combination-target-list">${rows.map(row => `<label class="combination-target"><input type="checkbox" name="application" value="${escapeHtml(row.id)}"${create ? "" : " checked"}><span><strong>${escapeHtml(row.entity)}</strong><small>${breakableIdentifier(rowParameter(row) || (row.implicitRevit ? "Zelfde naam als IFC" : "Parameter ontbreekt"))} · ${escapeHtml(types[row.type] || row.type)}</small></span></label>`).join("")}</div>
        </fieldset><p class="form-error" role="alert" hidden></p></div>
      <div class="dialog-actions">${!create && !group.isStandard ? '<button type="button" class="text-button" data-action="reset-combination">Standaard gebruiken</button>' : ""}<button type="button" class="button" data-action="cancel">Annuleren</button><button type="submit" class="button primary">Toepassen op selectie</button></div>
    </form>`);
  }

  function applyCombination(form, reset = false) {
    if (!form) return;
    try {
      const data = new FormData(form);
      const ids = data.getAll("application");
      const allowed = new Set(JSON.parse(form.dataset.allowed));
      if (ids.some(id => !allowed.has(id))) throw new Error("De selectie is gewijzigd. Open de regel opnieuw.");
      const emptyKind = !reset && ["implicit", "missing"].includes(form.dataset.parameterKind);
      let next = UDPSMappingRows.changeParameter(state.project, ids, reset || emptyKind ? null : String(data.get("parameter")).trim());
      if (emptyKind) {
        const selected = new Set(ids);
        next = { ...next, rows: next.rows.map(row => selected.has(row.id) ? { ...row, override: "", implicitRevit: form.dataset.parameterKind === "implicit" } : row) };
      }
      state.project = next;
      state.revised = true;
      state.editor = null;
      dialog.close();
      render();
      if (!focusCombinationForApplication(ids[0])) document.getElementById("search")?.focus();
      message(`${wordCount(ids.length, "toepassing bijgewerkt", "toepassingen bijgewerkt")}.`);
    } catch (failure) {
      const error = form.querySelector(".form-error");
      error.textContent = failure.message;
      error.hidden = false;
    }
  }

  function addCombinationApplication(id, entity = "") {
    const group = findCombination(id);
    if (!group) return;
    const row = group.allApplications[0] || group.representative;
    if (entity) linkRuleEntity(id, entity); else entityPicker(id);
  }

  function assignCombination(value) {
    const [id, entity] = JSON.parse(value);
    const group = findCombination(id);
    if (!group) return;
    if (group.familyApplications.some(row => row.entity === entity)) combinationDialog(id, { entity });
    else linkRuleEntity(id, entity);
  }

  function applicationDialog(id, create = false, targetEntity = "", combination = null) {
    const row = state.project.rows.find(item => item.id === id);
    if (!row) return;
    const protectedFields = UDPSRuleFields.origin(state.project, row).linked;
    if (create && protectedFields) return message("Deze IFC-entiteiten volgen de bron.");
    const entity = create ? targetEntity || entities.find(item => !state.project.rows.some(application => application.key === row.key && application.entity === item.code))?.code || row.entity : row.entity;
    const defaultSet = combination ? combination.propertySet : create && entity !== row.entity && row.propertySet === entityName(row.entity)?.propertySet
      ? entityName(entity)?.propertySet || "" : row.propertySet;
    const codes = [...new Set([...entities.map(item => item.code), ...availableEntities().map(item => item.code), ...(idsModule?.IDS_ENTITY_CODES || [])])];
    const selectedType = row.type;
    const parameter = combination ? combination.parameter : create ? state.project.standards[row.key] || "" : rowParameter(row);
    showDialog(`<form id="edit-application-fields" data-id="${escapeHtml(id)}" data-create="${create}"${combination ? ` data-combination-kind="${escapeHtml(combination.parameterKind)}"` : ""}>
      <h2 id="dialog-title">${create ? "IFC-entiteit toevoegen" : protectedFields ? "IFC-velden bekijken" : "IFC-velden bewerken"}</h2>
      <p class="dialog-subject">${escapeHtml(row.name)} · ${escapeHtml(entity)}</p>
      <div class="dialog-fields">
        <label class="field">IFC-entiteit<input${protectedFields ? " readonly" : ""} name="entity" list="ifc-entity-options" value="${escapeHtml(entity)}" required pattern="Ifc[A-Za-z0-9]+" maxlength="150"></label>
        <datalist id="ifc-entity-options">${codes.map(code => `<option value="${escapeHtml(code)}"></option>`).join("")}</datalist>
        <label class="field">Propertyset<input${protectedFields ? " readonly" : ""} name="set" value="${escapeHtml(defaultSet)}" required maxlength="500"></label>
        <label class="field">IFC eigenschap<input${protectedFields ? " readonly" : ""} name="property" value="${escapeHtml(row.name)}" required maxlength="500"></label>
        <label class="field">Datatype<select name="type" required${protectedFields ? " disabled" : ""}><option value="">Kies datatype</option>${selectedType && !Object.hasOwn(types, selectedType) ? `<option value="${escapeHtml(selectedType)}" selected>${escapeHtml(selectedType)} · uit projectbestand</option>` : ""}${Object.entries(types).map(([code, label]) => `<option value="${code}"${code === selectedType ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="field">Revit parameter (${escapeHtml(entity)})<input name="parameter" value="${escapeHtml(parameter)}" maxlength="500"${protectedFields ? " readonly" : ""}><small>Leeg gebruikt de standaard als die is ingesteld.</small></label>
        ${protectedFields ? '<p class="small muted">Deze IFC-velden en het datatype zijn door de bron bepaald. Wijzig de Revit parameter via de regel in het werkblad.</p>' : ""}<p class="form-error" role="alert" hidden></p>
      </div><div class="dialog-actions">${create ? "" : `<button type="button" class="text-button danger-text" data-action="remove-application" data-value="${escapeHtml(id)}">Verwijderen</button>`}<button type="button" class="button" data-action="cancel">${protectedFields ? "Sluiten" : "Annuleren"}</button>${protectedFields ? "" : `<button type="submit" class="button primary">${create ? "Toevoegen" : "Wijzigingen toepassen"}</button>`}</div>
    </form>`);
  }

  function applyApplicationFields(form) {
    const original = state.project.rows.find(row => row.id === form.dataset.id);
    if (!original) return;
    const data = new FormData(form);
    const entity = String(data.get("entity")).trim();
    const propertySet = String(data.get("set")).trim();
    const name = String(data.get("property")).trim();
    const type = String(data.get("type"));
    const parameter = String(data.get("parameter")).trim();
    const create = form.dataset.create === "true";
    const error = form.querySelector(".form-error");
    const fail = text => { error.textContent = text; error.hidden = false; };
    if (UDPSRuleFields.origin(state.project, original).linked) return fail("De IFC-velden en het datatype van deze regel volgen de bron.");
    if (!/^Ifc[A-Za-z0-9]+$/.test(entity) || !propertySet || !name || !type || [propertySet, name, type, parameter].some(value => /[\t\r\n]/.test(value))) return fail("Gebruik een geldige IFC-entiteit en velden zonder tabs of regeleinden.");
    if (state.project.rows.some(row => (create || row.id !== original.id) && row.entity === entity && row.propertySet === propertySet && row.name === name)) return fail(`Deze regel bevat ${entity} al.`);
    const row = create ? { ...original, id: `own-${crypto.randomUUID()}`, sourceIndex: undefined, override: null, implicitRevit: false, active: true } : original;
    const oldName = row.name;
    Object.assign(row, { entity, propertySet, name, type });
    if (row.label === oldName) row.label = name;
    if (parameter !== rowParameter(row) || create) {
      row.override = parameter && parameter !== (state.project.standards[row.key] || "") ? parameter : null;
      row.implicitRevit = false;
    }
    if (create && ["implicit", "missing"].includes(form.dataset.combinationKind) && !parameter) {
      row.override = "";
      row.implicitRevit = form.dataset.combinationKind === "implicit";
    }
    if (create) state.project.rows.push(row);
    state.ifcSelection.add(entity);
    state.collapsedSets.delete(propertySet);
    state.expanded.add(row.key);
    if (state.review) state.review.targets.add(exportTargetKey(row));
    state.editor = null;
    state.revised = true;
    dialog.close();
    render();
    focusParameterLocation(row.id, row.key);
    message(create ? `Toepassing op ${entity} toegevoegd.` : `IFC-velden voor ${entity} bijgewerkt.`);
  }

  function removeDialog(ids, subject = "") {
    const rows = state.project.rows.filter(row => ids.includes(row.id));
    if (!rows.length) return;
    showDialog(`<h2 id="dialog-title">${escapeHtml(subject || (rows.length === 1 ? "IFC-entiteit" : "Regel"))} verwijderen?</h2><p class="dialog-subject">${escapeHtml(rows[0].name)}</p><p>${wordCount(rows.length, "IFC-toepassing wordt", "IFC-toepassingen worden")} uit deze configuratie verwijderd.</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel" data-focus>Annuleren</button><button type="button" class="button danger-button" data-action="confirm-remove" data-value="${escapeHtml(JSON.stringify(ids))}">Verwijderen</button></div>`);
  }

  function removeApplications(ids) {
    lastRemoval = { entries: state.project.rows.map((row, index) => ({ row: structuredClone(row), index })).filter(entry => ids.includes(entry.row.id)), removedSourceIndices: [...state.project.removedSourceIndices || []] };
    state.project = UDPSProjectFiles.removeApplications(state.project, ids);
    state.editor = null;
    state.revised = true;
    dialog.close();
    render();
    document.getElementById(state.review ? "review-heading" : "search")?.focus();
    message(`${wordCount(lastRemoval.entries.length, "toepassing verwijderd", "toepassingen verwijderd")}.`, true);
  }

  function undoRemoval() {
    if (!lastRemoval) return;
    const restored = lastRemoval.entries[0]?.row;
    for (const { row, index } of lastRemoval.entries) {
      if (!state.project.rows.some(item => item.id === row.id)) state.project.rows.splice(Math.min(index, state.project.rows.length), 0, row);
      state.ifcSelection.add(row.entity);
    }
    const live = new Set(state.project.rows.map(row => row.sourceIndex));
    state.project.removedSourceIndices = (state.project.removedSourceIndices || []).filter(index => !live.has(index));
    lastRemoval = null;
    state.revised = true;
    render();
    message("Verwijdering ongedaan gemaakt.");
    if (restored) focusParameterLocation(restored.id, restored.key);
  }

  async function copyExport() {
    if (!activeRows().length || exportIssues().length) return;
    try { await navigator.clipboard.writeText(UDPSProjectFiles.exportText(state.project)); message("UDPS.txt gekopieerd."); }
    catch { message("Kopiëren is hier niet beschikbaar. Gebruik Download UDPS.txt."); }
  }

  function focusEntityFilter() {
    const actions = ["choose-columns", "toggle-entities", "all-entities"];
    return actions.some(action => focusControl(action));
  }

  function focusMapping(row) {
    state.panel = "";
    state.view = "mappings";
    state.review = null;
    state.ifcSelection = new Set([row.entity]);
    state.propertySet = "";
    state.search = "";
    state.sourceRuleFilter = "";
    rememberFilters();
    state.collapsedSets.delete(row.propertySet);
    state.expanded.add(row.key);
    state.editor = null;
    render();
    focusCombinationForApplication(row.id);
  }

  function startEdit(key, applications, rowId = "", inReview = false) {
    state.panel = "";
    const values = new Set(applications.map(rowParameter));
    if (rowId && !inReview) state.expanded.add(key);
    state.editor = {
      key,
      rowId,
      inReview,
      ids: applications.map(row => row.id),
      initial: values.size === 1 ? values.values().next().value : "",
      mixed: values.size > 1
    };
    render();
    const input = document.getElementById("inline-parameter");
    input?.focus({ preventScroll: true });
    input?.select();
    revealParameterEditor();
  }

  function revealParameterEditor() {
    if (document.activeElement?.id !== "inline-parameter") return;
    document.getElementById("edit-parameter")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function pendingParameterForm() {
    const form = document.getElementById("edit-parameter");
    return state.editor && form && form.elements.parameter.value.trim() !== state.editor.initial.trim() ? form : null;
  }

  function requestEditorDecision(next) {
    if (!pendingParameterForm()) return false;
    pendingEditorAction = next;
    const row = state.project.rows.find(item => state.editor.ids.includes(item.id));
    const scope = state.editor.ids.length === 1 ? row?.entity : wordCount(state.editor.ids.length, "toepassing", "toepassingen");
    showDialog(`<h2 id="dialog-title">Wijziging nog niet toegepast</h2>
      <p class="dialog-subject">${escapeHtml(row?.name || "Revit-parameter")} · ${escapeHtml(scope)}</p>
      <p>Pas je parameterinvoer toe of verwerp deze voordat je verdergaat.</p>
      <div class="dialog-actions switch-actions">
        <button type="button" class="button" data-action="cancel" data-focus>Verder bewerken</button>
        <button type="button" class="text-button" data-action="discard-edit">Verwerpen en doorgaan</button>
        <button type="button" class="button primary" data-action="apply-edit">Toepassen en doorgaan</button>
      </div>`);
    return true;
  }

  function resolvePendingEdit(apply) {
    const next = pendingEditorAction;
    if (!next) return;
    const form = document.getElementById("edit-parameter");
    pendingEditorAction = null;
    afterDialogClose = () => {
      if (apply) {
        if (!form?.isConnected || !applyInlineEdit(form)) return;
      } else finishEdit();
      next();
    };
    dialog.close();
  }

  function changeSearch(value) {
    state.search = value;
    cancelTableEditor();
    rememberFilters();
    renderMappingList();
    const search = document.getElementById("search");
    search.value = value;
    search.focus({ preventScroll: true });
  }

  function changePropertySet(value) {
    state.propertySet = value;
    cancelTableEditor();
    rememberFilters();
    document.getElementById("property-set").value = value;
    renderMappingList();
  }

  function finishEdit(messageText) {
    const edit = state.editor;
    state.editor = null;
    render();
    if (edit && !focusControl(edit.inReview ? "edit-review" : edit.rowId ? "edit-application" : "edit-group", edit.rowId || edit.key)) {
      document.getElementById(edit.inReview ? "review-heading" : "search")?.focus();
    }
    if (messageText) message(messageText);
  }

  function focusParameterLocation(rowId, key) {
    const inReview = Boolean(state.review);
    if (rowId && (inReview ? focusControl("edit-review", rowId) : focusCombinationForApplication(rowId))) return;
    if (!inReview && focusControl("edit-group", key)) return;
    document.getElementById(inReview ? "review-heading" : "search")?.focus();
  }

  function cancelTableEditor() {
    state.editor = null;
  }

  function applyInlineEdit(form) {
    const edit = state.editor;
    if (!edit) return;
    const parameter = new FormData(form).get("parameter").trim();
    if (!parameter) {
      message("Vul een Revit-parameter in.");
      document.getElementById("inline-parameter")?.focus();
      revealParameterEditor();
      return false;
    }
    const ids = new Set(edit.ids);
    const applications = state.project.rows.filter(row => ids.has(row.id));
    if (applications.length !== ids.size) {
      finishEdit("Selectie gewijzigd. Open de koppeling opnieuw.");
      return false;
    }
    applications.forEach(row => { row.override = parameter === (state.project.standards[row.key] || "") ? null : parameter; });
    state.revised = true;
    finishEdit(`${wordCount(applications.length, "toepassing gewijzigd", "toepassingen gewijzigd")}.`);
    return true;
  }

  function standardDialog(key, trigger, rowId = "", family = "") {
    const applications = state.project.rows.filter(row => row.key === key);
    const followers = applications.filter(row => row.override == null);
    const overrides = applications.length - followers.length;
    const standard = state.project.standards[key] || "";
    showDialog(`<form id="edit-standard" data-key="${escapeHtml(key)}" data-row-id="${escapeHtml(rowId || trigger?.dataset.rowId || "")}" data-family="${escapeHtml(family)}">
      <h2 id="dialog-title">Revit parameter (standaard)</h2>
      ${applications.length ? `<p class="dialog-subject">${escapeHtml(applications[0].name)}</p>` : ""}
      <div class="central-edit-scope">
        <strong>Geldt voor ${wordCount(followers.length, "toepassing", "toepassingen")}</strong>
        <p>${escapeHtml([...new Set(followers.map(row => row.entity))].join(", ")) || "Geen toepassing volgt deze standaard."}</p>
        ${overrides ? `<p>${wordCount(overrides, "eigen waarde blijft", "eigen waarden blijven")} behouden.</p>` : ""}
      </div>
      <div class="dialog-fields"><label class="field">Revit parameter (standaard)
        <input name="standard" value="${escapeHtml(standard)}" required maxlength="120">
      </label></div>
      ${buttonRow("Standaard toepassen")}
    </form>`);
  }

  function downloadFile(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  function saveProject() {
    try {
      studio.track();
      const blob = new Blob([UDPSProjectFiles.save(state.project)], { type: "application/json" });
      if (blob.size > maxProjectBytes) throw new Error("Het projectbestand wordt groter dan 32 MiB.");
      const name = state.project.name.replace(/\.json$/i, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").slice(0, 95).trim();
      downloadFile(blob, `${name || "UDPS-project"}.json`);
    } catch (failure) {
      const error = dialog.open && dialog.querySelector(".form-error");
      if (error) {
        error.textContent = failure.message;
        error.hidden = false;
      } else message(failure.message);
      return false;
    }
    rememberProject();
    state.revised = false;
    render();
    if (!dialog.open) root.querySelector('[data-action="save"]')?.focus({ preventScroll: true });
    message("Werkblad gedownload.");
    return true;
  }


  function updateEntitySelection() {
    state.editor = null;
    state.review = null;
    if (!availablePropertySets().includes(state.propertySet)) state.propertySet = "";
    rememberFilters();
    render();
  }

  function toggleApplications(key, action) {
    if (state.expanded.has(key)) state.expanded.delete(key);
    else state.expanded.add(key);
    cancelTableEditor();
    renderMappingList();
    focusControl(action, key);
  }

  function openReview(key, trigger) {
    const issues = exportIssues();
    if (!issues.length) return;
    state.panel = "";
    const returnScroll = state.view === "mappings" ? window.scrollY : 0;
    state.review = { targets: new Set(), returnScroll, returnMatrix: matrixPosition(), returnFocus: trigger?.id, batch: null };
    state.view = "mappings";
    state.editor = null;
    render();
    root.querySelector(".mapping-panel")?.scrollIntoView({ block: "start", behavior: "instant" });
    if (key) {
      const group = root.querySelector(`[data-review-property="${CSS.escape(key)}"]`);
      if (group) {
        group.scrollIntoView({ block: "start", behavior: "instant" });
        group.focus({ preventScroll: true });
        return;
      }
    }
    document.getElementById("review-heading")?.focus({ preventScroll: true });
  }

  function closeReview() {
    const review = state.review;
    state.review = null;
    state.editor = null;
    render(review?.returnMatrix ?? null);
    window.scrollTo({ top: review?.returnScroll || 0, behavior: "instant" });
    const trigger = document.getElementById(review?.returnFocus || "");
    (trigger || root.querySelector('[data-action="review"]') || document.getElementById("search"))?.focus({ preventScroll: true });
  }

  function selectConflict(input) {
    const target = input.dataset.reviewSelect;
    const candidates = batchCandidates(reviewEntries(exportIssues()));
    const option = candidates.get(target);
    if (!option) return;
    const batch = state.review.batch ??= { signature: option.signature, selected: new Set(), keep: "" };
    if (batch.signature !== option.signature) return;
    if (input.checked) batch.selected.add(target);
    else batch.selected.delete(target);
    const draft = document.getElementById("inline-parameter")?.value;
    renderMappingList();
    const editor = document.getElementById("inline-parameter");
    if (editor && draft !== undefined) editor.value = draft;
    root.querySelector(`[data-review-select="${CSS.escape(target)}"]`)?.focus({ preventScroll: true });
  }

  function chooseKeeper(value) {
    state.review.batch.keep = value;
    const candidates = batchCandidates(reviewEntries(exportIssues()));
    document.getElementById("review-batch").innerHTML = reviewBatchControls(candidates);
    document.getElementById("review-keeper")?.focus({ preventScroll: true });
  }

  function resolveBatch() {
    const batch = state.review?.batch;
    if (!batch?.keep || batch.selected.size < 2) return;
    const candidates = batchCandidates(reviewEntries(exportIssues()));
    const selected = [...batch.selected].map(target => candidates.get(target));
    if (!selected.every(conflict => conflict?.signature === batch.signature &&
      conflict.choices.some(choice => choice.id === batch.keep))) return;
    for (const conflict of selected) {
      for (const choice of conflict.choices) choice.row.active = choice.id === batch.keep;
    }
    state.review.batch = null;
    state.editor = null;
    state.revised = true;
    render();
    document.getElementById("review-heading")?.focus({ preventScroll: true });
    message(`${wordCount(selected.length, "conflict opgelost", "conflicten opgelost")}.`);
  }

  function toggleExport(input) {
    const group = mappingGroups().find(entry => entry.key === input.dataset.exportGroup);
    if (!group) return;
    const applicationId = input.dataset.exportApplication;
    const applications = applicationId ? group.applications.filter(row => row.id === applicationId) : group.applications;
    setExportActive(input, applications);
  }

  function setExportActive(input, applications) {
    const changed = applications.filter(row => Boolean(row.active) !== input.checked);
    if (!changed.length) return;
    for (const row of changed) row.active = input.checked;
    const draft = document.getElementById("inline-parameter")?.value;
    state.revised = true;
    render();
    const editor = document.getElementById("inline-parameter");
    if (editor && draft !== undefined) editor.value = draft;
    if (!editor) state.editor = null;
    const focusTarget = document.getElementById(input.id) || document.getElementById("search");
    focusTarget?.focus();
    const scope = wordCount(changed.length, "toepassing", "toepassingen");
    message(`${scope} ${input.checked ? "ingeschakeld" : "uitgeschakeld"} voor export.`);
  }

  const actions = {
    ...studio.actions,
    ...productionSources.actions,
    start: () => navigate("start"),
    resume: () => state.project ? navigate("mappings") : openProject(state.saved.project, state.saved),
    new: () => studio.newDialog(),
    "new-empty": emptyProjectDialog,
    ...idsInterface.actions,
    ...libraryInterface.actions,
    open: openDialog,
    examples: examplesDialog,
    example(value) {
      switchProject(value === "small" ? demoProject() : largeProject());
    },
    cancel: () => dialog.close(),
    "discard-edit": () => resolvePendingEdit(false),
    "apply-edit": () => resolvePendingEdit(true),
    "discard-and-open": finishSwitch,
    "save-and-open"() { if (saveProject()) finishSwitch(); },
    mappings: () => navigate("mappings"),
    sources: openSources,
    export: () => openWorkspacePanel("export"),
    "close-panel": closeWorkspacePanel,
    "ids-alone"() {
      state.source = "ids";
      state.selection.clear();
      if (state.project) openWorkspacePanel("sources");
      else navigate("sources");
    },
    "toggle-entities"() {
      state.entitiesExpanded = !state.entitiesExpanded;
      root.querySelector('[data-action="toggle-entities"]').setAttribute("aria-expanded", state.entitiesExpanded);
    },
    entity(value) {
      if (state.ifcSelection.has(value)) state.ifcSelection.delete(value);
      else state.ifcSelection.add(value);
      updateEntitySelection();
      focusControl("entity", value);
    },
    "all-entities"() {
      state.ifcSelection = new Set(availableEntities().map(entity => entity.code));
      updateEntitySelection();
      root.querySelector('[data-action="all-entities"]')?.focus();
    },
    "choose-columns": columnsDialog,
    "select-columns"(value) {
      for (const input of dialog.querySelectorAll('#choose-columns input[name="entity"]')) input.checked = value === "all";
    },
    expand: key => toggleApplications(key, "expand"),
    "show-applications": key => toggleApplications(key, "show-applications"),
    "collapse-set"(name) {
      if (state.collapsedSets.has(name)) state.collapsedSets.delete(name);
      else state.collapsedSets.add(name);
      cancelTableEditor();
      renderMappingList();
      focusControl("collapse-set", name);
    },
    "edit-group"(key) {
      const group = mappingGroups().find(entry => entry.key === key);
      if (group) startEdit(key, group.applications);
    },
    "edit-application"(id) {
      const row = state.project.rows.find(entry => entry.id === id);
      if (row) startEdit(row.key, [row], row.id);
    },
    "edit-review"(id) {
      const row = state.project.rows.find(entry => entry.id === id);
      if (row) startEdit(row.key, [row], row.id, true);
    },
    "cancel-edit"() { finishEdit(); },
    standard: standardDialog,
    "reset-override"(id) {
      const row = state.project.rows.find(item => item.id === id);
      if (!row) return;
      row.override = null;
      state.revised = true;
      state.editor = null;
      render();
      focusParameterLocation(row.id, row.key);
      message(`Standaard gebruikt voor ${row.entity}.`);
    },
    review: openReview,
    "close-review": closeReview,
    "resolve-batch": resolveBatch,
    "clear-filters"() {
      state.ifcSelection = new Set(availableEntities().map(entity => entity.code));
      state.propertySet = "";
      state.search = "";
      state.sourceRuleFilter = "";
      state.collapsedSets.clear();
      updateEntitySelection();
      document.getElementById("search")?.focus({ preventScroll: true });
    },
    "source-kind"(kind) {
      state.source = kind;
      state.selection.clear();
      render();
      focusControl("source-kind", kind);
    },
    "add-property": addRuleDialog,
    "own-rule": addDialog,
    "rule-from-source"() { sourceInspection = false; dialog.close(); openWorkspacePanel("sources"); },
    "dialog-back": dialogBack,
    "pick-new-rule-entity": () => entityPicker(),
    "select-rule-entity": chooseRuleEntity,
    "rule-source": ruleSourceDialog,
    "inspect-source"(value) {
      const item = JSON.parse(value);
      sourceInspection = true;
      if (item.action === "ids-source") idsInterface.actions["ids-source"](item.value);
      if (item.action === "library-source") libraryInterface.actions["library-source"](item.value);
    },
    "source-rules": sourceRules,
    "remove-source": removeSourceDialog,
    "confirm-remove-source": removeSource,
    "undo-source-removal": undoSourceRemoval,
    "return-source-rule"(id) { navigate("mappings"); manageCombination(id); },
    "manage-combination": id => manageCombination(id),
    "combination-standard": combinationStandardDialog,
    "edit-combination": id => combinationDialog(id),
    "new-combination": id => combinationDialog(id, { create: true }),
    "reset-combination": () => applyCombination(dialog.querySelector("#edit-combination"), true),
    "assign-combination": assignCombination,
    "add-combination-application": id => addCombinationApplication(id),
    "remove-combination"(id) { const group = findCombination(id); if (group) removeDialog(group.allApplications.map(row => row.id), "Regel"); },
    "expand-combination"(id) {
      if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
      renderMappingList();
      focusControl("expand-combination", id);
    },
    "manage-property": manageProperty,
    "edit-fields": id => applicationDialog(id),
    "add-application"(key) { const row = state.project.rows.find(item => item.key === key); if (row) applicationDialog(row.id, true); },
    "link-application"(value) { const [key, entity] = JSON.parse(value); const row = state.project.rows.find(item => item.key === key); if (row) applicationDialog(row.id, true, entity); },
    "remove-application": id => removeDialog([id]),
    "remove-property": key => removeDialog(state.project.rows.filter(row => row.key === key).map(row => row.id)),
    "confirm-remove": value => removeApplications(JSON.parse(value)),
    "undo-remove": undoRemoval,
    "copy-txt": () => { void copyExport(); },
    save: saveProject,
    "download-txt"() {
      if (!activeRows().length || exportIssues().length) return;
      downloadFile(new Blob(["\uFEFF", UDPSProjectFiles.exportText(state.project)], { type: "text/plain;charset=utf-8" }), "UDPS.txt");
    }
  };

  document.addEventListener("click", event => {
    const control = event.target.closest('button[data-action], tr[data-action="studio-open"]');
    if (!control || control.disabled) return;
    const run = () => actions[control.dataset.action]?.(control.dataset.value, control);
    if (!dialog.contains(control) && control.dataset.action !== "cancel-edit" && requestEditorDecision(run)) return;
    run();
  });
  dialog.addEventListener("input", event => {
    if (event.target.id !== "entity-search" || !entityPickerState) return;
    entityPickerState.query = event.target.value;
    dialog.querySelector("#entity-picker-list").innerHTML = entityPickerList();
  });
  dialog.addEventListener("change", event => {
    if (event.target.id !== "entity-version" || !entityPickerState) return;
    entityPickerState.version = event.target.value;
    dialog.querySelector("#entity-picker-list").innerHTML = entityPickerList();
  });
  dialog.addEventListener("close", () => {
    dialogTrail = [];
    dialogRoute = "";
    sourceInspection = false;
    pendingProject = null;
    const next = afterDialogClose;
    afterDialogClose = null;
    if (next) {
      next();
      return;
    }
    if (pendingEditorAction) {
      pendingEditorAction = null;
      document.getElementById("inline-parameter")?.focus({ preventScroll: true });
      revealParameterEditor();
      return;
    }
    if (dialogTrigger?.isConnected) dialogTrigger.focus();
    else if (dialogTrigger?.dataset.action === "choose-columns" && state.view === "mappings") focusEntityFilter();
  });
  window.addEventListener("beforeunload", event => {
    if (!state.revised && !pendingParameterForm()) return;
    event.preventDefault();
    event.returnValue = true;
  });
  matrixViewport.addEventListener("change", () => {
    if (state.view !== "mappings" || state.review) return;
    const focused = document.activeElement;
    const insideWorkspace = root.contains(focused);
    const previousEditor = document.getElementById("inline-parameter");
    render();
    const editor = document.getElementById("inline-parameter");
    if (previousEditor && editor) editor.value = previousEditor.value;
    if (!insideWorkspace) return;
    const control = focused.id && document.getElementById(focused.id);
    if (control) control.focus();
    else if (["choose-columns", "toggle-entities", "all-entities"].includes(focused.dataset.action)) focusEntityFilter();
    else if (!focused.dataset.action || !focusControl(focused.dataset.action, focused.dataset.value)) {
      document.getElementById("search")?.focus();
    }
    revealParameterEditor();
  });
  window.addEventListener("resize", () => {
    fitMatrixViewport();
    if (document.activeElement?.id === "inline-parameter") window.requestAnimationFrame(revealParameterEditor);
  });
  root.addEventListener("input", event => {
    if (event.target.id !== "search") return;
    const value = event.target.value;
    if (requestEditorDecision(() => changeSearch(value))) {
      event.target.value = state.search;
      return;
    }
    changeSearch(value);
  });
  root.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (event.target.closest("#edit-parameter")) {
      event.preventDefault();
      finishEdit();
    } else if (state.panel) {
      event.preventDefault();
      if (!requestEditorDecision(closeWorkspacePanel)) closeWorkspacePanel();
    }
  });
  root.addEventListener("change", event => {
    const input = event.target;
    if (input.dataset.ruleType !== undefined) {
      const group = findCombination(input.dataset.ruleType);
      if (!group) return;
      try {
        state.project = UDPSRuleFields.changeType(state.project, group.applications.map(row => row.id), input.value, types);
        state.revised = true;
        render();
        document.getElementById(`datatype-${group.id}`)?.focus();
        message("Datatype voor de getoonde regel bijgewerkt.");
      } catch (failure) { render(); message(failure.message); }
      return;
    }
    if (input.dataset.combinationExport !== undefined) {
      const ids = new Set(JSON.parse(input.dataset.combinationExport));
      setExportActive(input, state.project.rows.filter(row => ids.has(row.id)));
      return;
    }
    if (input.id === "export-order") {
      state.project.sourceData ||= {};
      state.project.sourceData.exportOrder = input.value;
      state.revised = true;
      render();
      document.getElementById("export-order")?.focus();
      return;
    }
    if (input.dataset.reviewKeep !== undefined) {
      const row = state.project.rows.find(item => item.id === input.dataset.reviewKeep);
      if (!row) return;
      const value = document.getElementById("inline-parameter")?.value;
      state.project.rows.filter(item => exportTargetKey(item) === exportTargetKey(row)).forEach(item => { item.active = item.id === row.id; });
      state.revised = true;
      render();
      const field = document.getElementById("inline-parameter");
      if (field && value !== undefined) field.value = value;
      root.querySelector(`[data-review-keep="${CSS.escape(row.id)}"]`)?.focus();
      message(`Keuze voor ${row.entity} vastgelegd.`);
      return;
    }
    if (input.id === "property-set") {
      const value = input.value;
      if (requestEditorDecision(() => changePropertySet(value))) {
        input.value = state.propertySet;
        return;
      }
      changePropertySet(value);
      return;
    }
    if (input.dataset.exportGroup !== undefined) {
      toggleExport(input);
      return;
    }
    if (input.dataset.reviewSelect !== undefined) {
      selectConflict(input);
      return;
    }
    if (input.id === "review-keeper") {
      chooseKeeper(input.value);
      return;
    }
    if (input.dataset.reviewExport !== undefined) {
      const row = state.project.rows.find(application => application.id === input.dataset.reviewExport);
      if (row) setExportActive(input, [row]);
      return;
    }
    if (!input.dataset.choice) return;
    if (input.checked) state.selection.add(input.dataset.choice);
    else state.selection.delete(input.dataset.choice);
    document.getElementById("source-selection").textContent = `${state.selection.size} geselecteerd`;
    document.getElementById("source-add").disabled = !state.selection.size;
  });
  root.addEventListener("toggle", event => {
    if (event.target.matches(".export-text-preview")) state.exportPreviewOpen = event.target.open;
    if (event.target.matches(".parameter-info") && event.target.open) event.target.closest("#edit-parameter")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, true);
  document.addEventListener("submit", event => {
    const form = event.target;
    event.preventDefault();
    if (form.id === "open-project-file") void loadProjectFile(form);
    if (form.id === "choose-columns") {
      state.ifcSelection = new Set(new FormData(form).getAll("entity"));
      dialog.close();
      updateEntitySelection();
      focusEntityFilter();
    }
    if (studio.submit(form) || productionSources.handleSubmit(form)) return;
    if (form.id === "new-project") {
      const name = new FormData(form).get("project-name").trim();
      switchProject({ name: name || "Nieuwe IFC-configuratie", rows: [], standards: {} });
    }
    if (form.id === "add-property-form") addRowFromForm(form);
    if (form.id === "edit-application-fields") applyApplicationFields(form);
    if (form.id === "edit-combination") applyCombination(form);
    if (form.id === "edit-combination-standards") {
      const keys = JSON.parse(form.dataset.keys);
      const value = new FormData(form).get("standard").trim();
      if (!value || /[\t\r\n]/.test(value) || keys.some(key => !Object.hasOwn(state.project.standards, key))) return;
      keys.forEach(key => { state.project.standards[key] = value; });
      state.revised = true;
      dialog.close();
      render();
      if (!focusStandardFamily(form.dataset.family, keys)) focusParameterLocation(form.dataset.rowId, "");
      message("Standaardparameters bijgewerkt.");
    }
    if (form.id === "edit-parameter") applyInlineEdit(form);
    if (form.id === "edit-standard") {
      const key = form.dataset.key;
      const value = new FormData(form).get("standard").trim();
      if (!value) return;
      state.project.standards[key] = value;
      state.revised = true;
      state.editor = null;
      dialog.close();
      render();
      if (!focusStandardFamily(form.dataset.family, [key])) focusParameterLocation(form.dataset.rowId, key);
      message("Standaardparameter bijgewerkt.");
    }
  });

  render();
  void studio.init().then(() => render());
  document.fonts?.ready.then(() => {
    if (state.view !== "mappings" || state.review || state.editor || !root.querySelector(".matrix-scroll")) return;
    const focused = document.activeElement;
    let focusSelector = focused?.matches(".matrix-scroll") ? ".matrix-scroll" : "";
    if (focused?.closest(".matrix-table, #toolbar-status")) {
      if (focused.id) {
        focusSelector = `#${CSS.escape(focused.id)}`;
      } else if (focused.dataset.exportGroup !== undefined) {
        const application = focused.dataset.exportApplication;
        focusSelector = `[data-export-group="${CSS.escape(focused.dataset.exportGroup)}"]` +
          (application === undefined ? ":not([data-export-application])" : `[data-export-application="${CSS.escape(application)}"]`);
      } else if (focused.dataset.action) {
        focusSelector = `[data-action="${CSS.escape(focused.dataset.action)}"]` +
          (focused.dataset.value === undefined ? "" : `[data-value="${CSS.escape(focused.dataset.value)}"]`);
      }
    }
    renderMappingList();
    if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
  });
})();
