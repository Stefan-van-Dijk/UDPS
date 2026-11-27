function UDPSLibraryInterface({ dialog, showDialog, getProject, complete, sourceMode = () => false, escapeHtml: esc }) {
  let module;
  let draft;
  let generation = 0;
  const load = async () => { module ||= await import("./library-files.mjs?v=29"); return module; };
  const count = (amount, one, many) => `${amount} ${amount === 1 ? one : many}`;
  const sourceRoute = source => `library-source:${source.id}:${source.version}`;
  const showError = (form, failure) => { const error = form.querySelector(".form-error"); if (error) { error.textContent = failure.message; error.hidden = false; } };

  function preparedDraft(prepared, { manager, saved = false, options = {} }) {
    draft = { prepared, manager, saved, selected: new Set(manager ? [] : prepared.properties.map(property => property.id)) };
    render(options);
  }

  function openFile() {
    generation++;
    const manager = sourceMode();
    showDialog(`<form id="library-file-form" data-dialog-route="library-file:${manager ? "source" : "rules"}" data-source-mode="${manager}"><h2 id="dialog-title">Bibliotheekbestand laden</h2><div class="dialog-fields"><label class="field">UDPS-bibliotheek (.json)<input type="file" name="library-file" accept=".json,application/json" required></label><p class="small muted">Kies een eigen UDPS-bibliotheek. De bron en versie blijven bij het werkblad bewaard.</p><p class="form-error" role="alert" hidden></p></div><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button><button type="submit" class="button primary">Inlezen</button></div></form>`);
  }

  async function read(form) {
    const file = form.elements["library-file"].files[0];
    if (!file) return;
    const ticket = ++generation;
    const project = getProject();
    const manager = form.dataset.sourceMode === "true";
    const current = () => ticket === generation && form.isConnected && dialog.open &&
      form.elements["library-file"].files[0] === file && getProject() === project && sourceMode() === manager;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Inlezen…";
    try {
      await load();
      if (!current()) return;
      const prepared = await module.prepareLibraryFile(file);
      if (!current()) return;
      preparedDraft(prepared, { manager });
    } catch (error) { if (current()) showError(form, error); }
    finally { if (current()) { button.disabled = false; button.textContent = "Inlezen"; } }
  }

  function renderSource(options = {}) {
    const { library, properties, source } = draft.prepared;
    const entities = new Set(properties.flatMap(property => property.entities));
    showDialog(`<form id="library-source-form" data-dialog-route="${esc(sourceRoute(source))}"><h2 id="dialog-title">Bibliotheekbron bekijken</h2>
      <p class="dialog-subject">${esc(library.name)} · ${esc(library.version)}</p>
      <div class="ids-counts"><span>${count(library.classes.length, "klasse", "klassen")}</span><span>${count(properties.length, "IFC-eigenschap", "IFC-eigenschappen")}</span><span>${count(entities.size, "IFC-entiteit", "IFC-entiteiten")}</span></div>
      <p class="small muted">Bestand: ${esc(source.fileName)} · Bibliotheek-id: ${esc(library.id)}</p>
      <details class="ids-source-info"><summary>Klassen en definities</summary><ul>${library.classes.map(item => `<li><strong>${esc(item.name)}</strong><p>${esc(item.code)} · ${esc(item.ifcEntities.join(", "))} · ${count(item.properties.length, "IFC-eigenschap", "IFC-eigenschappen")}</p></li>`).join("")}</ul></details>
      <details class="ids-source-info"><summary>Bibliotheekmetadata en broninhoud</summary><pre class="ids-source-xml">${esc(JSON.stringify(source.library, null, 2))}</pre></details>
      <p class="ids-retention">${draft.saved ? "Deze bron is bij het werkblad bewaard." : getProject() ? "Bewaren voegt alleen de bron aan het huidige werkblad toe." : "Deze bron is nog niet bewaard."} Regels kies je via Regel toevoegen.</p>
      ${!draft.saved && !getProject() ? '<p class="small muted">Open een werkblad om deze bron te bewaren.</p>' : ""}
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button>${!draft.saved && getProject() ? '<button type="submit" class="button primary">Alleen bron bewaren</button>' : ""}</div>
    </form>`, options);
    dialog.classList.add("ids-dialog");
  }

  function render(options = {}) {
    if (draft.manager) { renderSource(options); return; }
    const { library, properties } = draft.prepared;
    showDialog(`<form id="library-import-form" data-dialog-route="library-import:${esc(library.id)}:${esc(library.version)}"><h2 id="dialog-title">Regels uit bibliotheek</h2><p class="dialog-subject">${esc(library.name)} · ${esc(library.version)}</p><div class="ids-proposals">${properties.map(property => `<div class="ids-proposal"><label><input type="checkbox" data-library-choice="${esc(property.id)}"${draft.selected.has(property.id) ? " checked" : ""}><span><strong>${esc(property.label || property.code)}</strong><small>${esc(property.propertySet)} · ${esc(property.code)} · ${esc(property.entities.join(", "))}</small></span></label></div>`).join("")}</div><p class="ids-retention">${draft.selected.size} regels geselecteerd. Bestaande Revit-koppelingen blijven behouden; ontbrekende namen kun je in het werkblad invullen.</p><p class="form-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" class="text-button" data-action="library-source-only">Alleen bron bewaren</button><button type="button" class="button" data-action="cancel">Annuleren</button><button type="submit" class="button primary"${draft.selected.size ? "" : " disabled"}>Regels toevoegen · ${draft.selected.size}</button></div></form>`, options);
    dialog.classList.add("ids-dialog");
  }

  function apply(sourceOnly = false) {
    const form = dialog.querySelector(draft?.manager ? "#library-source-form" : "#library-import-form");
    if (!form || !draft || draft.manager && draft.saved) return;
    try {
      const project = getProject();
      const manager = draft.manager || sourceMode();
      if (manager && !project) throw new Error("Open eerst een werkblad om de bron te bewaren.");
      const raw = module.createLibraryProject(draft.prepared, { baseData: project ? JSON.parse(UDPSProjectFiles.save(project)) : undefined, selectedIds: sourceOnly || manager ? [] : [...draft.selected] });
      complete(raw, project ? "add" : "new");
    } catch (error) { showError(form, error); }
  }

  async function openSaved(value) {
    const [id, version] = JSON.parse(value);
    const project = getProject();
    const source = project?.sourceData?.libraryImports?.find(item => item.id === id && item.version === version);
    if (!source) return;
    const ticket = ++generation;
    const manager = sourceMode();
    let loading;
    const current = () => ticket === generation && loading?.isConnected && dialog.open && getProject() === project && sourceMode() === manager;
    showDialog(`<section data-library-loading data-dialog-route="${esc(sourceRoute(source))}"><h2 id="dialog-title">Bibliotheek openen</h2><p>Bron lezen…</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button></div></section>`);
    loading = dialog.querySelector("[data-library-loading]");
    try {
      await load();
      if (!current()) return;
      const prepared = await module.prepareLibraryFile(new File([JSON.stringify(source.library)], source.fileName || "bibliotheek.json", { type: "application/json" }));
      if (!current()) return;
      preparedDraft(prepared, { manager, saved: true, options: { replace: true } });
    } catch (error) { if (current()) showDialog(`<section data-dialog-route="${esc(sourceRoute(source))}"><h2 id="dialog-title">Bibliotheek</h2><p class="form-error">${esc(error.message)}</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`, { replace: true }); }
  }

  async function example() {
    const ticket = ++generation;
    const project = getProject();
    const manager = sourceMode();
    const route = `library-example:${manager ? "source" : "rules"}`;
    let loading;
    const current = () => ticket === generation && loading?.isConnected && dialog.open && getProject() === project && sourceMode() === manager;
    showDialog(`<section data-library-loading data-dialog-route="${route}"><h2 id="dialog-title">Voorbeeldbibliotheek openen</h2><p>Bron lezen…</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button></div></section>`);
    loading = dialog.querySelector("[data-library-loading]");
    try {
      await load();
      if (!current()) return;
      const response = await fetch("examples/voorbeeldbibliotheek.json");
      if (!current()) return;
      if (!response.ok) throw new Error("De voorbeeldbibliotheek kon niet worden geladen.");
      const bytes = await response.arrayBuffer();
      if (!current()) return;
      const prepared = await module.prepareLibraryFile(new File([bytes], "voorbeeldbibliotheek.json", { type: "application/json" }));
      if (!current()) return;
      preparedDraft(prepared, { manager, options: { replace: true } });
    } catch (error) { if (current()) showDialog(`<section data-dialog-route="${route}"><h2 id="dialog-title">Voorbeeldbibliotheek</h2><p class="form-error">${esc(error.message)}</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`, { replace: true }); }
  }

  dialog.addEventListener("change", event => {
    const id = event.target.dataset.libraryChoice;
    if (!id || !draft || draft.manager || sourceMode()) return;
    const position = dialog.querySelector(".ids-proposals")?.scrollTop || 0;
    if (event.target.checked) draft.selected.add(id); else draft.selected.delete(id);
    render();
    dialog.querySelector(".ids-proposals").scrollTop = position;
    dialog.querySelector(`[data-library-choice="${CSS.escape(id)}"]`)?.focus();
  });
  document.addEventListener("submit", event => {
    if (event.target.id === "library-file-form") { event.preventDefault(); void read(event.target); }
    if (event.target.id === "library-import-form") { event.preventDefault(); apply(); }
    if (event.target.id === "library-source-form") { event.preventDefault(); apply(true); }
  });
  dialog.addEventListener("udps:dialog-back", () => {
    generation++;
    queueMicrotask(() => {
      const submit = dialog.querySelector('#library-file-form [type="submit"]');
      if (submit) { submit.disabled = false; submit.textContent = "Inlezen"; }
    });
  });
  dialog.addEventListener("close", () => { generation++; });
  return { actions: { "library-open": openFile, "library-source-only": () => apply(true), "library-source": value => { void openSaved(value); }, "library-example": () => { void example(); } } };
}
