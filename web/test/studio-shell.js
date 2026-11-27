/* Local workspaces. Published company versions are explicit immutable snapshots. */
function UDPSStudioShell(api) {
  "use strict";
  const { state, dialog, escapeHtml: esc, icon, buttonRow, message } = api;
  const showDialog = markup => api.showDialog(markup, { replace:true, resetTrail:true });
  const model = UDPSStudioWorkspace;
  const storage = UDPSStudioStorage.create({ namespace: window.UDPS_STUDIO_STORAGE_NAMESPACE || "udps-studio-klikmodel-v2" });
  let workspace = model.create(), ready = false, warning = "", currentId = null, timer, lastCapture = "";
  let tab = "books", updatePlan = null, writeFailed = false, storageBlocked = false, restoring = false;
  let saveTicket=0, committedTicket=0;
  window.addEventListener("beforeunload", event => {
    if (saveTicket <= committedTicket && !restoring) return;
    event.preventDefault(); event.returnValue="";
  });
  const entry = () => workspace.books.find(book => book.id === currentId);
  const latest = () => model.latest(workspace);
  const versionLabel = version => version ? `v${version}` : "Zonder bedrijfsbasis";
  const errorLine = () => '<p class="form-error" role="alert" hidden></p>';
  const input = (name, label, value = "", extra = "") => `<label class="field">${label}<input name="${name}" value="${esc(value)}" required maxlength="72" ${extra}></label>`;
  function fail(error) {
    const control = dialog.open && dialog.querySelector(".form-error");
    if (control) { control.textContent = error.message; control.hidden = false; }
    else message(error.message);
  }
  function persist() {
    if (storageBlocked || restoring) return;
    clearTimeout(timer);
    const ticket=++saveTicket;
    timer = setTimeout(() => {
      void storage.save(workspace).then(result => {
        committedTicket=Math.max(committedTicket,ticket);
        const old = warning;
        warning = result.warning || "";
        if (writeFailed) { writeFailed = false; message("Werkruimte weer in deze browser bewaard."); }
        if (warning && old !== warning) message(warning);
      }).catch(error => { warning = error.message; writeFailed = true; message(error.message); });
    }, 180);
  }
  function contextFor(book) {
    return { schema: 1, bookId: book.id, basisVersion: book.basisVersion || null,
      baseProject: book.baseProject ? structuredClone(book.baseProject) : null };
  }
  function projectOpened(project, saved) {
    const context = project.studioContext;
    const checked = model.addBook(model.create(), project, {
      id: context?.bookId,
      basisVersion: context?.basisVersion || null, baseProject: context?.baseProject || null, filters: saved?.filters || project.studioViewFilters || {}
    });
    let book = context?.bookId && workspace.books.find(item => item.id === context.bookId);
    if (!book) book = model.addBook(workspace, checked.project, {
      id: checked.id,
      basisVersion: checked.basisVersion, baseProject: checked.baseProject,
      filters: checked.filters
    });
    if (context) {
      book.basisVersion = checked.basisVersion;
      book.baseProject = checked.baseProject;
    }
    currentId = book.id;
    project.studioContext = contextFor(book);
    lastCapture = "";
  }
  function track() {
    if (!ready || !state.project) return;
    let book = entry();
    if (!book) { projectOpened(state.project); book = entry(); }
    const copy = structuredClone(state.project);
    delete copy.studioContext;
    const filters = api.currentFilters();
    const capture = JSON.stringify([copy, filters, state.revised]);
    if (capture === lastCapture) return;
    model.upsertBook(workspace, book.id, copy, filters);
    book = entry();
    book.dirty = Boolean(state.revised);
    state.project.studioContext = contextFor(book);
    lastCapture = capture;
    persist();
  }
  function openBook(id, route) {
    track();
    if (id === currentId && state.project) {
      if (route === "sources") api.openSources(); else api.navigate("mappings");
      return;
    }
    const book = workspace.books.find(item => item.id === id);
    if (!book) return;
    const project = structuredClone(book.project);
    project.studioContext = contextFor(book);
    project.studioViewFilters = book.filters;
    project.needsSave = Boolean(book.dirty);
    if (route === "sources") project.studioNextView = "sources";
    api.switchProject(project);
  }
  function startPage() {
    if (!ready) return '<section class="studio-home"><h1 data-heading tabindex="-1">UDPS Studio</h1><p role="status">Werkbladen laden…</p></section>';
    const base = latest();
    const books = [...workspace.books].sort((a,b) => (b.edited || "").localeCompare(a.edited || ""));
    return `<section class="studio-home" aria-labelledby="studio-home-title">
      <header class="studio-home-heading"><h1 id="studio-home-title" data-heading tabindex="-1">UDPS <span>Studio</span>${window.UDPS_STUDIO_MODE === "test" ? '<small class="studio-test-mark">Test</small>' : ""}</h1>
      <div class="buttons"><button class="button" type="button" data-action="studio-backup">${icon("download")}Werkruimte bewaren</button><button class="button" type="button" data-action="open">${icon("folder")}Openen</button></div></header>
      <div class="studio-home-tabs" role="tablist" aria-label="Werkruimte"><button type="button" role="tab" aria-selected="${tab === "books"}" data-action="studio-tab" data-value="books">Werkbladen</button><button type="button" role="tab" aria-selected="${tab === "sources"}" data-action="studio-tab" data-value="sources">Bronnen</button></div>
      ${warning ? `<p class="studio-storage-warning" role="status">${esc(warning)}</p>` : ""}
      ${tab === "sources" ? sourceHome(books) : `<section class="studio-standard-strip"><div><span class="studio-overline">Bedrijfsstandaard</span><h2>${base ? `${esc(workspace.company.name)} <span class="studio-version">${esc(versionLabel(base.version))}</span>` : "Nog geen bedrijfsbasis"}</h2></div><div class="buttons">${workspace.company.concept ? '<button class="button" type="button" data-action="studio-concept">Concept</button>' : ""}<button class="button" type="button" data-action="studio-basis">${base ? "Bekijk basis" : "Basis instellen"}</button><button class="button primary" type="button" data-action="new">${icon("plus")}Nieuw project</button></div></section>
      <div class="studio-section-line"><h2>Projectwerkbladen</h2><button class="text-button" type="button" data-action="examples">Voorbeelden</button></div>
      ${books.length ? `<div class="studio-project-scroll"><table class="studio-project-table"><thead><tr><th>Werkblad</th><th>Bedrijfsbasis</th><th>Projectwijzigingen</th><th>Bewerkt</th></tr></thead><tbody>${books.map(book => {
        const amount = model.changes(book).length;
        return `<tr data-action="studio-open" data-value="${esc(book.id)}"><td><button type="button" class="studio-project-name" data-action="studio-open" data-value="${esc(book.id)}">${icon("file")}<span>${esc(book.name)}</span>${icon("chevron-right")}</button></td><td><span class="studio-version">${esc(versionLabel(book.basisVersion))}</span>${base && book.basisVersion && book.basisVersion !== base.version ? `<span class="studio-update">Update v${esc(base.version)}</span>` : ""}</td><td>${book.basisVersion ? amount : "—"}</td><td>${book.dirty ? '<span class="studio-dirty">JSON niet bewaard</span>' : ""}<time>${esc(date(book.edited))}</time></td></tr>`;
      }).join("")}</tbody></table></div>` : '<div class="studio-empty"><p>Je eerste projectwerkblad</p><button type="button" class="button" data-action="new">Nieuw project</button><button type="button" class="text-button" data-action="open">Bestaand werkblad openen</button></div>'}`}
      <footer class="studio-home-footer">Lokaal in deze browser<button class="text-button" type="button" data-action="studio-restore">Werkruimte openen</button></footer>
    </section>`;
  }
  function date(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return "Vandaag";
    return new Intl.DateTimeFormat("nl-NL", {day:"numeric",month:"short",year:"numeric"}).format(new Date(value));
  }
  function sourceHome(books) {
    const sources = books.flatMap(book => [
      ...(book.project.sourceData?.idsImports || []).map(source => ({ book, source, name:source.fileName, kind:"IDS" })),
      ...(book.project.sourceData?.libraryImports || []).map(source => ({ book, source, name:source.name || source.id, kind:"Bibliotheek" }))
    ]);
    return `<div class="studio-section-line"><h2>Bronbestanden</h2><button class="button" type="button" data-action="sources">Bronnen beheren</button></div>
      ${sources.length ? `<div class="studio-source-list">${sources.map(item => `<div><span class="studio-source-icon">${icon(item.kind === "IDS" ? "file" : "library")}</span><div><strong>${esc(item.name)}</strong><small>${item.kind}${item.source.version ? ` · ${esc(item.source.version)}` : ""}</small></div><button class="text-button" type="button" data-action="studio-source-book" data-value="${esc(item.book.id)}">${esc(item.book.name)}${icon("chevron-right")}</button></div>`).join("")}</div>` : '<div class="studio-empty"><p>Nog geen bronbestanden</p><button class="button" type="button" data-action="sources">Bron toevoegen</button></div>'}`;
  }
  function contextActions() {
    const book = entry();
    if (!book) return "";
    return `<button class="button studio-context" type="button" data-action="studio-context">${icon("library")}${book.basisVersion ? `Basis v${esc(book.basisVersion)}` : "Bedrijfsbasis"}${latest() && book.basisVersion && latest().version !== book.basisVersion ? '<span class="studio-update-dot" aria-label="Update beschikbaar"></span>' : ""}</button>${book.basisVersion ? `<button class="button studio-context" type="button" data-action="studio-changes">Projectwijzigingen <span class="studio-count">${model.changes(book).length}</span></button>` : ""}`;
  }
  function newDialog() {
    const base = latest();
    showDialog(`<form id="studio-new"><h2 id="dialog-title">Nieuw project</h2><div class="dialog-fields">${input("name","Naam","",'placeholder="Bijv. Project 2027-014"')}
      <label class="field">Start met<select name="basis"><option value="${base ? "base" : "empty"}">${base ? `Bedrijfsbasis v${esc(base.version)}` : "Leeg werkblad"}</option>${base ? '<option value="empty">Leeg werkblad</option>' : ""}<option value="ids">IDS-bestand</option></select></label>${errorLine()}</div>${buttonRow("Aanmaken")}</form>`);
  }
  function basisDialog() {
    const base = latest();
    if (!base) return setupDialog();
    showDialog(`<section><h2 id="dialog-title">${esc(workspace.company.name)} · v${esc(base.version)}</h2><p class="dialog-subject">${modelCount(base.project)} regels · ${esc(date(base.publishedAt))}</p>${ruleTable(base.project.rows,base.project)}<div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button><button type="button" class="button" data-action="studio-setup">Nieuwe basisversie</button><button type="button" class="button primary" data-action="new">Nieuw project</button></div></section>`);
  }
  function modelCount(project) { return UDPSMappingRows.build(project).length; }
  function ruleTable(rows, project) {
    const unique = new Map(rows.map(row => [JSON.stringify([row.propertySet,row.name,UDPSProjectFiles.parameterOf(project,row)]),row]));
    return `<div class="studio-detail-scroll"><table class="studio-detail-table"><thead><tr><th>IFC eigenschap</th><th>Revit parameter</th></tr></thead><tbody>${[...unique.values()].map(row => `<tr><td><small>${esc(row.propertySet)}</small>${esc(row.name)}</td><td>${esc(UDPSProjectFiles.parameterOf(project,row)) || "Nog te kiezen"}</td></tr>`).join("") || '<tr><td colspan="2">Geen regels</td></tr>'}</tbody></table></div>`;
  }
  function setupDialog() {
    track();
    if (!workspace.books.length) return showDialog(`<h2 id="dialog-title">Bedrijfsbasis instellen</h2><p>Open eerst een bestaand werkblad of maak een nieuw werkblad.</p><div class="dialog-actions"><button class="button" type="button" data-action="cancel">Sluiten</button><button class="button primary" type="button" data-action="open">Werkblad openen</button></div>`);
    showDialog(`<form id="studio-publish-basis"><h2 id="dialog-title">${latest() ? "Nieuwe basisversie" : "Bedrijfsbasis instellen"}</h2><div class="dialog-fields">${input("company","Naam bedrijfsstandaard",workspace.company.name)}<label class="field">Werkblad<select name="book">${workspace.books.map(book => `<option value="${esc(book.id)}" ${book.id === currentId ? "selected" : ""}>${esc(book.name)}</option>`).join("")}</select></label>${input("version","Versie","")}
      <p class="studio-critical-note">Het volledige werkblad wordt de nieuwe basis. Bestaande projecten worden niet automatisch bijgewerkt.</p>${errorLine()}</div>${buttonRow("Publiceren")}</form>`);
  }
  function contextDialog() {
    track(); const book=entry(); if (!book) return;
    showDialog(`<section><h2 id="dialog-title">Bedrijfsbasis</h2><p class="dialog-subject">${esc(book.name)}</p><div class="studio-version-pair"><div><small>Dit project</small><strong>${esc(versionLabel(book.basisVersion))}</strong></div><div><small>Gepubliceerd</small><strong>${esc(versionLabel(latest()?.version))}</strong></div></div>${errorLine()}<div class="dialog-actions"><button class="button" type="button" data-action="cancel">Sluiten</button><button class="button" type="button" data-action="studio-basis">Basis bekijken</button>${latest() && book.basisVersion !== latest().version ? '<button class="button primary" type="button" data-action="studio-update">Update bekijken</button>' : ""}</div></section>`);
  }
  function changeRows(changes, selectable=false) {
    const kinds={added:"Toegevoegd",removed:"Verwijderd",changed:"Gewijzigd"};
    return `<div class="studio-detail-scroll"><table class="studio-detail-table"><thead><tr>${selectable ? '<th class="studio-check-col">Kies</th>' : ""}<th>Regel</th><th>Wijziging</th><th>Revit parameter</th></tr></thead><tbody>${changes.map(change => {
      const row=change.after || change.before;
      return `<tr>${selectable ? `<td><input type="checkbox" name="change" value="${esc(change.id)}" aria-label="${esc(row.name)} voorstellen"></td>` : ""}<td><small>${esc(row.propertySet)} · ${esc(row.entity)}</small>${esc(row.name)}</td><td>${kinds[change.kind] || "Gewijzigd"}${change.fields?.length ? `<small>${esc(change.fields.map(field=>({active:"Exportselectie",type:"Datatype",parameter:"Revit parameter",standard:"Standaard",name:"IFC eigenschap",propertySet:"Propertyset",inherits:"Koppeling met standaard",implicitRevit:"IFC-naam gebruiken",classification:"Classificatie",label:"Regelnaam"}[field] || "Regelgegevens")).join(", "))}</small>` : ""}</td><td>${esc(row.parameter ?? "") || "—"}</td></tr>`;
    }).join("") || '<tr><td colspan="4">Geen regelwijzigingen</td></tr>'}</tbody></table></div>`;
  }
  function changesDialog() {
    track(); const book=entry(); if (!book) return;
    const changes=model.changes(book);
    showDialog(`<form id="studio-propose"><h2 id="dialog-title">Projectwijzigingen</h2><p class="dialog-subject">${esc(book.name)} · ${esc(versionLabel(book.basisVersion))}</p>${changeRows(changes,true)}${errorLine()}<div class="dialog-actions"><button class="button" type="button" data-action="cancel">Sluiten</button>${changes.length ? '<button class="button primary" type="submit">Bedrijfsregels voorstellen</button>' : ""}</div></form>`);
  }
  function updateDialog() {
    track(); const book=entry(); if (!book) return;
    try {
      updatePlan=model.previewUpdate(workspace,book.id);
      const blocking=updatePlan.conflicts.filter(conflict=>!conflict.resolvable);
      showDialog(`<form id="studio-update"><h2 id="dialog-title">Bedrijfsbasis bijwerken</h2><p class="dialog-subject">${esc(versionLabel(book.basisVersion))} → ${esc(versionLabel(latest()?.version))}</p>${changeRows(updatePlan.changes || [])}
        ${updatePlan.conflicts.length ? `<p class="studio-critical-note">${updatePlan.conflicts.length} ${blocking.length ? "bronconflicten. Stem de bronbestanden eerst af; overnemen is geblokkeerd." : "overlappende wijzigingen. De eigen projectwaarden blijven behouden."}</p>` : '<p class="studio-critical-note">Eigen projectwijzigingen blijven behouden.</p>'}${errorLine()}<div class="dialog-actions"><button class="button" type="button" data-action="studio-context">Terug</button><button class="button primary" type="submit" ${blocking.length ? "disabled" : ""}>${updatePlan.conflicts.length ? "Overnemen met projectwaarden" : "Overnemen"}</button></div></form>`);
    } catch(error) { fail(error); }
  }
  function conceptDialog() {
    const concept=workspace.company.concept;
    if (!concept) return;
    showDialog(`<form id="studio-publish-concept"><h2 id="dialog-title">Bedrijfsregels publiceren</h2><p class="dialog-subject">${concept.changeIds.length} geselecteerde ${concept.changeIds.length === 1 ? "toepassing" : "toepassingen"}</p>${changeRows(concept.changes || model.changes(workspace.books.find(book => book.id === concept.fromBookId)).filter(change => concept.changeIds.includes(change.id)))}<div class="dialog-fields">${input("version","Nieuwe versie","")}<p class="studio-critical-note">Bestaande projecten worden niet automatisch bijgewerkt.</p>${errorLine()}</div><div class="dialog-actions"><button class="text-button" type="button" data-action="studio-discard-concept">Concept verwerpen</button><button class="button" type="button" data-action="${currentId === concept.fromBookId ? "studio-changes" : "cancel"}">${currentId === concept.fromBookId ? "Terug" : "Sluiten"}</button><button class="button primary" type="submit">Publiceren</button></div></form>`);
  }
  function submit(form) {
    if (!["studio-new","studio-publish-basis","studio-update","studio-propose","studio-publish-concept","studio-restore"].includes(form.id)) return false;
    try {
      const fields=new FormData(form);
      if (form.id === "studio-new") {
        const name=String(fields.get("name") || "").trim();
        if (!name) throw Error("Vul een projectnaam in.");
        if (fields.get("basis") === "ids") { dialog.close(); api.startIds(name); return true; }
        const book=fields.get("basis") === "base" ? model.newFromBase(workspace,name) : model.addBook(workspace,{name,rows:[],standards:{}});
        book.dirty=true; persist(); openBook(book.id);
      } else if (form.id === "studio-publish-basis") {
        const book=workspace.books.find(book=>book.id===fields.get("book"));
        if (!book) throw Error("Kies een werkblad.");
        const companyName=String(fields.get("company") || "").trim();
        if (!companyName) throw Error("Vul een naam in.");
        model.publish(workspace,book.project,String(fields.get("version") || ""));
        workspace.company.name=companyName;
        persist(); dialog.close(); api.render(); message("Bedrijfsbasis gepubliceerd in deze werkruimte.");
      } else if (form.id === "studio-update") {
        const book=model.applyUpdate(workspace,currentId,{keepProject:Boolean(updatePlan?.conflicts.length)});
        book.dirty=true;
        const project=structuredClone(book.project);
        project.studioContext=contextFor(book);
        project.studioViewFilters=book.filters;
        project.needsSave=true;
        persist(); dialog.close(); api.openProject(project); message("Bedrijfsbasis bijgewerkt.");
      } else if (form.id === "studio-propose") {
        const ids=fields.getAll("change"); if (!ids.length) throw Error("Selecteer de regels die je wilt voorstellen.");
        const concept=model.prepareConcept(workspace,currentId,ids);
        if (concept.conflicts?.length) throw Error("De geselecteerde bronwijzigingen vragen eerst afstemming met de bedrijfsbasis.");
        workspace.company.concept={project:concept.project,changes:concept.changes,fromBookId:currentId,changeIds:ids}; persist(); conceptDialog();
      } else if (form.id === "studio-publish-concept") {
        model.publish(workspace,workspace.company.concept.project,String(fields.get("version") || ""));
        workspace.company.concept=null; persist(); dialog.close(); api.render(); message("Nieuwe bedrijfsbasis gepubliceerd. Projecten behouden hun eigen basisversie.");
      } else if (form.id === "studio-restore") {
        void restore(form); return true;
      }
    } catch(error) { fail(error); }
    return true;
  }
  async function restore(form) {
    const file=form.elements.file.files[0]; if (!file || restoring) return;
    restoring=true;
    clearTimeout(timer);
    for (const button of form.querySelectorAll("button")) button.disabled=true;
    let completed=false;
    try {
      if(file.size>32*1024*1024) throw Error("Het bestand is groter dan 32 MiB.");
      const parsed=model.hydrate(await file.text());
      if(!form.isConnected || !dialog.open || form.elements.file.files[0]!==file) return;
      clearTimeout(timer);
      const ticket=++saveTicket;
      await storage.save(parsed);
      committedTicket=Math.max(committedTicket,ticket);
      completed=true;
      storageBlocked=false; workspace=parsed; state.project=null; state.revised=false; currentId=null; lastCapture="";
      dialog.close(); api.navigate("start"); message("Werkruimte geopend.");
    } catch(error) { fail(error); }
    finally {
      restoring=false;
      for (const button of form.querySelectorAll("button")) button.disabled=false;
      if (!completed && !storageBlocked) persist();
    }
  }
  dialog.addEventListener("cancel", event => { if (restoring) event.preventDefault(); });
  const actions={
    "studio-open":openBook,
    "studio-tab"(value) { tab=value; api.render(null); },
    "studio-source-book"(id) { openBook(id, "sources"); },
    "studio-basis":basisDialog, "studio-setup":setupDialog,
    "studio-context":contextDialog, "studio-changes":changesDialog,
    "studio-update":updateDialog, "studio-concept":conceptDialog,
    "studio-discard-concept"() { workspace.company.concept=null;persist();dialog.close();message("Concept verworpen."); },
    "studio-backup"() {
      track();
      const blob=new Blob([JSON.stringify(workspace)],{type:"application/json"});
      if (blob.size > 32*1024*1024) { message("De werkruimte is groter dan 32 MiB. Bewaar de werkbladen afzonderlijk als JSON."); return; }
      api.downloadFile(blob,"UDPS-werkruimte.json");message("Werkruimte gedownload.");
    },
    "studio-restore"() { showDialog(`<form id="studio-restore"><h2 id="dialog-title">Werkruimte openen</h2><div class="dialog-fields"><label class="field">UDPS-werkruimte<input type="file" name="file" accept=".json" required></label><p class="studio-critical-note">Dit vervangt de lokale werkruimte. Bewaar eerst een back-up.</p>${errorLine()}</div>${buttonRow("Werkruimte openen")}</form>`); }
  };
  async function init() {
    try {
      const result=await storage.load(); warning=result.warning || "";
      if(result.workspace) workspace=model.hydrate(result.workspace);
      if (!result.workspace && !workspace.books.length) {
        let saved = state.saved;
        if (!saved && window.UDPS_STUDIO_MODE !== "test") {
          try {
            const previous = JSON.parse(window.localStorage.getItem("udps-werkstroom-klikmodel-v1"));
            if (previous?.version === 2 || previous?.version === 3) saved=previous;
          } catch { /* Previous klikmodel storage is optional and remains untouched. */ }
        }
        if (saved?.project) model.addBook(workspace,saved.project,{filters:saved.filters});
      }
    } catch(error) { storageBlocked=true; warning=`${error.message} De bewaarde gegevens blijven behouden. Bewaar nieuw werk als JSON.`; }
    ready=true;
  }
  return {init,track,projectOpened,startPage,contextActions,newDialog,actions,submit};
}
