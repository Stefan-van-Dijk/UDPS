function UDPSIdsInterface({ dialog, showDialog, getProject, complete, onModule, sourceMode = () => false, escapeHtml: esc,
  prepareOptions = {}, loadModule = () => import("./ids-project.mjs?v=studio-ids-2") }) {
  let module;
  let draft;
  let draftSequence = 0;
  const drafts = new Map();
  let readGeneration = 0;
  let readController;
  const load = async () => { module ||= await loadModule(); onModule?.(module); return module; };
  const proposals = () => module.proposalsFor(draft.prepared, draft.decisions);
  const count = (amount, one, many) => `${amount} ${amount === 1 ? one : many}`;
  const showError = (form, error) => { const target = form.querySelector(".form-error"); if (target) { target.textContent = error.message || String(error); target.hidden = false; } };

  function cancelRead() {
    readGeneration++;
    readController?.abort();
    readController = undefined;
  }

  function beginRead() {
    cancelRead();
    readController = new AbortController();
    return { generation: readGeneration, controller: readController };
  }

  function processingOptions(controller, current, container) {
    return { ...prepareOptions, signal: controller.signal, onProgress(progress) {
      if (!current()) return;
      const label = container?.querySelector("[data-ids-progress]");
      if (label) { label.textContent = progress.message; label.hidden = false; }
      prepareOptions.onProgress?.(progress);
    } };
  }

  const mappingsAllowed = () => module.idsMappingsAllowed(draft.prepared);

  function preparedDraft(prepared, { mode, manager, saved = false, decisions = {}, selectedIds, seedName, comparison, options = {} }) {
    draft = { key: String(++draftSequence), prepared, mode, manager, saved, comparison, linkPrevious: false, owner: getProject(),
      name: seedName || prepared.document.title || prepared.document.fileName.replace(/\.ids$/i, ""), decisions,
      selected: new Set(manager || !module.idsMappingsAllowed(prepared) ? [] : selectedIds || prepared.proposals.filter(item => item.direct).map(item => item.id)) };
    drafts.set(draft.key, draft);
    render(options);
  }

  function newDialog() {
    cancelRead();
    showDialog(`<section data-dialog-route="ids-new"><h2 id="dialog-title">Nieuw werkblad</h2><div class="new-project-choices">
      <button type="button" class="project-choice" data-action="ids-new"><strong>Vanuit IDS</strong><span>Maak regels op basis van IDS-eisen</span><span aria-hidden="true">→</span></button>
      <button type="button" class="project-choice" data-action="new-empty"><strong>Leeg werkblad</strong><span>Stel zelf je regels samen</span><span aria-hidden="true">→</span></button>
      </div><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button></div></section>`);
  }

  function fileDialog(mode = "new", seedName = "", previousId = "") {
    cancelRead();
    const manager = sourceMode();
    showDialog(`<form id="ids-file-form" data-dialog-route="ids-file:${mode}:${manager ? "source" : "rules"}${previousId ? ":" + esc(previousId) : ""}" data-mode="${mode}" data-source-mode="${manager}" data-workbook-name="${esc(seedName)}" data-previous-id="${esc(previousId)}"><h2 id="dialog-title">${previousId ? "Nieuwe IDS-versie vergelijken" : manager ? "IDS-bron laden" : mode === "new" ? "Werkblad vanuit IDS" : "Regels uit IDS"}</h2>
      <div class="dialog-fields"><label class="field">IDS-bestand<input name="ids-file" type="file" accept=".ids,.xml,application/xml,text/xml" required></label>
      <p class="small muted">Het bestand wordt lokaal gelezen. De oorspronkelijke IDS blijft bij het werkblad bewaard.</p><p class="small muted" data-ids-progress role="status" hidden></p><p class="form-error" role="alert" hidden></p></div>
      <div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button><button type="submit" class="button primary">Inlezen</button></div></form>`);
  }

  async function readFile(form) {
    const file = form.elements["ids-file"].files[0];
    if (!file) return;
    const { generation, controller } = beginRead();
    const project = getProject();
    const manager = form.dataset.sourceMode === "true";
    const current = () => !controller.signal.aborted && generation === readGeneration && form.isConnected && dialog.open &&
      form.elements["ids-file"].files[0] === file && getProject() === project && sourceMode() === manager;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Inlezen…";
    try {
      await load();
      if (!current()) return;
      const prepared = await module.prepareIdsFile(file, processingOptions(controller, current, form));
      if (!current()) return;
      let comparison;
      const previousId = form.dataset.previousId;
      if (previousId) {
        const sources = project?.sourceData?.idsImports;
        const source = sources?.find(item => item.id === previousId);
        if (!source) throw new Error("De gekozen vorige IDS-bron ontbreekt. Open de bron opnieuw.");
        const options = processingOptions(controller, current, form);
        const previous = await module.prepareSavedIdsSource(source, sources, options);
        if (!current()) return;
        options.onProgress({ stage: "comparing", message: "IDS-eisen en eerdere keuzes vergelijken…" });
        const report = await module.comparePreparedIdsSources(previous, prepared, source.decisions || {}, { signal: controller.signal, rows: JSON.parse(UDPSProjectFiles.save(project)).rows });
        if (!current()) return;
        comparison = { report, previousId, fileName: source.fileName };
      }
      preparedDraft(prepared, { mode: form.dataset.mode, manager, seedName: form.dataset.workbookName, comparison, selectedIds: comparison ? [] : undefined });
    } catch (error) { if (current()) showError(form, error); }
    finally {
      if (readController === controller) readController = undefined;
      if (current()) { submit.disabled = false; submit.textContent = "Inlezen"; }
    }
  }

  function auditMarkup() {
    const report = draft.prepared.audit;
    const status = report?.status || "unavailable";
    const labels = { valid: "XSD gecontroleerd", invalid: "Afwijking van XSD", unavailable: "XSD-controle niet beschikbaar", unsupported: "XSD-controle niet beschikbaar voor dit IDS-formaat" };
    const issues = report?.issues || [];
    return `<section class="ids-source-info" aria-label="Lokale IDS-controle"><strong${status === "valid" ? "" : ' class="review-warning"'}>${esc(labels[status] || labels.unavailable)}</strong>
      <p class="small muted">Dit is geen volledige IDS-inhoudsaudit of IFC-modelcontrole.</p>
      ${!mappingsAllowed() ? '<p class="small muted">Regels toevoegen is geblokkeerd; alleen de volledige bron bewaren blijft mogelijk.</p>' : ""}
      ${issues.length ? `<details><summary>Controledetails · ${issues.length}</summary><ul>${issues.map(issue => `<li>${issue.line ? `Regel ${esc(issue.line)}: ` : ""}${esc(issue.message || "Onbekend controleresultaat")}</li>`).join("")}</ul></details>` : ""}
    </section>`;
  }

  function comparisonMarkup() {
    const comparison = draft.comparison;
    if (!comparison) return "";
    const { report, previousId, fileName } = comparison;
    const labels = { unchanged: "Ongewijzigd", modified: "Gewijzigd", added: "Nieuw", removed: "Vervallen", ambiguous: "Niet eenduidig" };
    const groups = new Map(report.ambiguityGroups.map(item => [item.id, item]));
    const pending = report.changes.filter(item => item.status !== "unchanged" || item.kind === "property" && !item.canReuse);
    const unchanged = report.changes.filter(item => item.status === "unchanged" && (item.kind !== "property" || item.canReuse));
    const renderChanges = items => items.map(item => {
      const group = groups.get(item.ambiguityGroupId);
      const rows = item.impactedRows || group?.impactedRows || [];
      const canReview = item.currentId && item.kind === "property" && mappingsAllowed();
      return `<li><strong>${esc(labels[item.status])} · ${esc(item.label)}</strong><p>${esc(item.reason)}${group ? ` Eerdere kandidaten: ${group.previousIds.length}.` : ""}${rows.length ? ` Betrokken werkbladregels: ${esc(rows.map(index => index + 1).join(", "))}.` : ""}</p>${canReview ? `<button type="button" class="text-button" data-action="ids-review" data-value="${esc(item.currentId)}">Eis beoordelen</button>` : ""}</li>`;
    }).join("");
    const reusable = Object.keys(report.decisions).length;
    const same = previousId === draft.prepared.document.id;
    return `<section class="ids-source-info" aria-label="IDS-bronversies vergelijken"><strong>Vergelijking met ${esc(fileName)}</strong>
      <div class="ids-counts">${Object.entries(labels).map(([key, label]) => `<span>${esc(label)}: ${report.counts[key]}</span>`).join("")}</div>
      <p class="small muted">Dit overzicht verandert geen werkbladregels. Vervallen eisen verwijderen geen regels; beoordeel de gevolgen zelf.</p>
      <details${pending.length ? " open" : ""}><summary>Te beoordelen · ${pending.length}</summary>${pending.length ? `<ul>${renderChanges(pending)}</ul>` : '<p class="small muted">Geen gewijzigde of onduidelijke eisen gevonden.</p>'}</details>
      ${unchanged.length ? `<details><summary>Ongewijzigde eisen · ${unchanged.length}</summary><ul>${renderChanges(unchanged)}</ul></details>` : ""}
      ${report.warnings.length ? `<details><summary>Vergelijkingsopmerkingen · ${report.warnings.length}</summary><ul>${report.warnings.map(text => `<li>${esc(text)}</li>`).join("")}</ul></details>` : ""}
      ${reusable && mappingsAllowed() ? `<p><button type="button" class="button" data-action="ids-reuse">${draft.reused ? "Ongewijzigde keuzes overgenomen" : `Ongewijzigde keuzes overnemen · ${reusable}`}</button></p><p class="small muted">Alleen aantoonbaar ongewijzigde keuzes worden overgenomen. Huidige keuzes blijven behouden; er worden geen regels geselecteerd.</p>` : ""}
      ${same ? '<p class="small muted">Dit is dezelfde XML-bron. Een bron kan niet zijn eigen vorige versie zijn.</p>' : `<label class="ids-ack"><input type="checkbox" name="ids-link-previous"${draft.linkPrevious ? " checked" : ""}><span>Bij bewaren ${esc(fileName)} als vorige bronversie vastleggen.</span></label>`}
    </section>`;
  }

  function compareSavedSource() {
    if (!draft?.saved || draft.owner !== getProject() || sourceMode() !== draft.manager) return;
    fileDialog("add", "", draft.prepared.document.id);
  }

  function reuseDecisions() {
    if (!draft?.comparison || !mappingsAllowed() || draft.owner !== getProject() || sourceMode() !== draft.manager) return;
    rememberName();
    draft.decisions = { ...draft.comparison.report.decisions, ...draft.decisions };
    draft.reused = true;
    render({ replace: true });
  }

  function renderSource(options = {}) {
    const document = draft.prepared.document;
    const specifications = document.specifications;
    const requirements = specifications.reduce((amount, item) => amount + item.requirements.length, 0);
    const versions = [...new Set(specifications.flatMap(item => item.ifcVersions))];
    showDialog(`<form id="ids-source-form" data-ids-draft="${draft.key}" data-dialog-route="ids-source:${esc(document.id)}"><h2 id="dialog-title">IDS-bron bekijken</h2>
      <p class="dialog-subject">${esc(document.title)}</p>
      <div class="ids-counts"><span>${count(specifications.length, "specificatie", "specificaties")}</span><span>${count(requirements, "eis", "eisen")}</span>${versions.length ? `<span>${esc(versions.join(", "))}</span>` : ""}</div>
      <p class="small muted">Bestand: ${esc(document.fileName)}${document.sourceEncoding ? ` · ${esc(document.sourceEncoding)}` : ""}</p>
      ${auditMarkup()}
      ${draft.saved ? '<p><button type="button" class="button" data-action="ids-compare">Nieuwe versie vergelijken</button></p>' : ""}
      ${comparisonMarkup()}
      <details class="ids-source-info"><summary>Specificaties en eisen</summary><ul>${specifications.map(item => `<li><strong>${esc(item.name)}</strong>${item.description ? `<p>${esc(item.description)}</p>` : ""}<p>${count(item.requirements.length, "eis", "eisen")}${item.ifcVersions.length ? ` · ${esc(item.ifcVersions.join(", "))}` : ""}</p></li>`).join("")}</ul></details>
      ${document.warnings.length ? `<details class="ids-source-info"><summary>Leesrapport · ${count(document.warnings.length, "opmerking", "opmerkingen")}</summary><ul>${document.warnings.map(text => `<li>${esc(text)}</li>`).join("")}</ul></details>` : ""}
      <details class="ids-source-info"><summary>Oorspronkelijke IDS-XML</summary><pre class="ids-source-xml">${esc(document.xml)}</pre></details>
      <p class="ids-retention">${draft.saved ? "Deze bron is bij het werkblad bewaard." : getProject() ? "Bewaren voegt alleen de bron aan het huidige werkblad toe." : "Deze bron is nog niet bewaard."} Regels kies je via Regel toevoegen.</p>
      ${!draft.saved && !getProject() ? '<p class="small muted">Open een werkblad om deze bron te bewaren.</p>' : ""}
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button>${!draft.saved && getProject() ? '<button type="submit" class="button primary">Alleen bron bewaren</button>' : ""}</div>
    </form>`, options);
    dialog.classList.add("ids-dialog");
  }

  function render(options = {}) {
    if (draft.manager) { renderSource(options); return; }
    const items = proposals();
    for (const id of draft.selected) if (!items.some(item => item.id === id && item.eligible)) draft.selected.delete(id);
    const properties = items.filter(item => item.kind === "property");
    const selected = items.filter(item => draft.selected.has(item.id));
    const entities = new Set(selected.flatMap(item => item.entities));
    const unselected = items.length - selected.length;
    const review = properties.filter(item => !item.direct);
    const pending = properties.filter(item => !item.eligible);
    const sources = items.filter(item => item.kind !== "property");
    showDialog(`<form id="ids-project-form" class="ids-project-form" data-ids-draft="${draft.key}" data-dialog-route="ids-project:${draft.mode}"><h2 id="dialog-title">${draft.mode === "new" ? "Werkblad voorbereiden" : "Regels uit IDS"}</h2>
      <p class="dialog-subject">${esc(draft.prepared.document.fileName)}</p>
      ${draft.mode === "new" ? `<label class="field">Naam van werkblad<input name="ids-project-name" value="${esc(draft.name)}" required maxlength="120"></label>` : ""}
      <div class="ids-counts"><span>${count(draft.prepared.counts.specifications, "specificatie", "specificaties")}</span><span>${count(properties.length, "eigenschapseis", "eigenschapseisen")}</span><span>${count(entities.size, "geselecteerde IFC-entiteit", "geselecteerde IFC-entiteiten")}</span></div>
      ${auditMarkup()}
      ${draft.saved ? '<p><button type="button" class="button" data-action="ids-compare">Nieuwe versie vergelijken</button></p>' : ""}
      ${comparisonMarkup()}
      ${mappingsAllowed() && pending.length ? `<div class="ids-attention"><strong>${count(pending.length, "eigenschapseis vraagt beoordeling", "eigenschapseisen vragen beoordeling")}</strong><p>Voorwaarden, waarden en handmatige keuzes blijven aan de IDS-bron gekoppeld.</p></div>` : ""}
      <details class="ids-property-list" open><summary>Regels kiezen · ${selected.length} geselecteerd</summary>
        <div class="ids-proposals">${properties.map(item => `<div class="ids-proposal"><label><input type="checkbox" data-ids-select="${esc(item.id)}"${draft.selected.has(item.id) ? " checked" : ""}${!item.eligible ? " disabled" : ""}><span><strong>${esc(item.property || "Eigenschapsnaam bepalen")}</strong><small>${esc(item.propertySet || "Propertyset bepalen")} · ${esc(item.entities.join(", ") || "IFC-doel bepalen")}</small>${!item.eligible && mappingsAllowed() ? `<small class="review-warning">${esc(item.reasons[0] || "Beoordeling nodig")}</small>` : ""}</span></label>${!item.direct && mappingsAllowed() ? `<button type="button" class="text-button" data-action="ids-review" data-value="${esc(item.id)}">${item.eligible ? "Keuze bekijken" : "Beoordelen"}</button>` : ""}</div>`).join("") || '<p class="small muted">Geen regels direct beschikbaar. Bewaar de IDS als bron.</p>'}</div>
      </details>
      ${sources.length ? `<details class="ids-source-info"><summary>${sources.length} andere eisen · broninformatie</summary><ul>${sources.map(item => `<li><strong>${esc(item.specificationName)}</strong> · ${esc(item.kind)}<p>${esc(item.reasons[0])}</p></li>`).join("")}</ul></details>` : ""}
      ${draft.prepared.document.warnings.length ? `<details class="ids-source-info"><summary>Leesrapport · ${count(draft.prepared.document.warnings.length, "opmerking", "opmerkingen")}</summary><ul>${draft.prepared.document.warnings.map(text => `<li>${esc(text)}</li>`).join("")}</ul></details>` : ""}
      <p class="ids-retention">${unselected ? count(unselected, "niet-geselecteerde eis blijft alleen als bron bewaard.", "niet-geselecteerde eisen blijven alleen als bron bewaard.") : "Alle eisen zijn geselecteerd."} De exportconfiguratie voert geen IFC-modeltoets uit.</p>
      <p class="form-error" role="alert" hidden></p>
      <div class="dialog-actions"><button type="button" class="text-button" data-action="ids-source-only">Alleen bron bewaren</button><button type="button" class="button" data-action="cancel">Annuleren</button><button type="submit" class="button primary"${selected.length ? "" : " disabled"}>${draft.mode === "new" ? "Werkblad maken" : "Regels toevoegen"} · ${count(selected.length, "regel", "regels")}</button></div>
    </form>`, options);
    dialog.classList.add("ids-dialog");
  }

  function reviewRequirement(id) {
    if (!draft || draft.owner !== getProject() || sourceMode() !== draft.manager || (draft.manager && !draft.comparison) || !mappingsAllowed()) return;
    const item = proposals().find(item => item.id === id);
    if (!item) return;
    rememberName();
    const choice = draft.decisions[id] || {};
    const source = draft.prepared.document.specifications.find(spec => spec.id === item.specificationId);
    showDialog(`<form id="ids-requirement-form" data-ids-draft="${draft.key}" data-dialog-route="ids-requirement:${esc(id)}" data-id="${esc(id)}" data-original-entities="${esc(JSON.stringify(item.entities))}" data-conditional="${item.conditions.conditional}"><h2 id="dialog-title">IDS-eis beoordelen</h2><p class="dialog-subject">${esc(item.specificationName)}</p>
      <details class="ids-source-info"><summary>Oorspronkelijke eis en voorwaarden</summary><pre class="ids-source-xml">${esc([source?.applicabilityXml || "", item.xml || ""].join("\n"))}</pre></details>
      <div class="dialog-fields"><label class="field">IFC-entiteiten<input name="entities" value="${esc(item.entities.join(", "))}" placeholder="Bijv. IfcDoor, IfcWindow" required></label>
      <label class="field">Propertyset<input name="propertySet" value="${esc(item.propertySet)}" required maxlength="500"></label>
      <label class="field">IFC eigenschap<input name="property" value="${esc(item.property)}" required maxlength="500"></label>
      <label class="field">Datatype<select name="dataType" required><option value="">Kies datatype</option>${module.IDS_DATA_TYPES.map(type => `<option value="${type}"${item.dataType === type ? " selected" : ""}>${type}</option>`).join("")}</select></label>
      <label class="ids-ack" data-scope-ack${item.conditions.conditional ? "" : " hidden"}><input type="checkbox" name="acknowledgeScope"${choice.acknowledgeScope ? " checked" : ""}><span>Deze exportdefinitie geldt voor de gekozen IFC-entiteiten. De aanvullende IDS-toepassingsvoorwaarden worden afzonderlijk gecontroleerd.</span></label>
      ${item.values.constrained ? `<label class="ids-ack"><input type="checkbox" name="acknowledgeValues"${choice.acknowledgeValues ? " checked" : ""}><span>IDS-waarden en waardebeperkingen afzonderlijk controleren; deze koppeling vult of controleert ze niet.</span></label>` : ""}
      ${item.cardinality === "optional" ? `<label class="ids-ack"><input type="checkbox" name="includeOptional"${choice.includeOptional ? " checked" : ""}><span>Deze optionele eigenschap bewust opnemen.</span></label>` : ""}
      <p class="form-error" role="alert" hidden></p></div><div class="dialog-actions"><button type="submit" class="button primary">Keuze vastleggen</button></div></form>`);
  }

  function rememberName() {
    const input = dialog.querySelector('[name="ids-project-name"]');
    if (input) draft.name = input.value;
    const link = dialog.querySelector('[name="ids-link-previous"]');
    if (link) draft.linkPrevious = link.checked;
  }

  function saveRequirement(form) {
    if (!draft || draft.owner !== getProject() || sourceMode() !== draft.manager || (draft.manager && !draft.comparison) || !mappingsAllowed()) return;
    const data = new FormData(form), id = form.dataset.id;
    const choice = { ...draft.decisions[id], entities: String(data.get("entities")).split(/[,;\s]+/).filter(Boolean), propertySet: String(data.get("propertySet")).trim(), property: String(data.get("property")).trim(), dataType: String(data.get("dataType")) };
    for (const field of ["acknowledgeScope", "acknowledgeValues", "includeOptional"]) if (form.elements[field]) choice[field] = form.elements[field].checked;
    const next = { ...draft.decisions, [id]: choice };
    try {
      const item = module.proposalsFor(draft.prepared, next).find(item => item.id === id);
      if (!item.eligible) throw new Error(item.reasons.join(" "));
      draft.decisions = next;
      if (!draft.manager) draft.selected.add(id);
      render({ replace: true });
    } catch (error) { showError(form, error); }
  }

  function create(sourceOnly = false) {
    if (!draft) return;
    rememberName();
    const form = dialog.querySelector(draft.manager ? "#ids-source-form" : "#ids-project-form");
    if (!form || draft.manager && draft.saved) return;
    try {
      const project = getProject();
      const manager = draft.manager || sourceMode();
      if (project !== draft.owner || sourceMode() !== draft.manager) throw new Error("Het werkblad is gewijzigd. Open de IDS opnieuw voordat je deze toevoegt.");
      if (manager && !project) throw new Error("Open eerst een werkblad om de bron te bewaren.");
      if (!sourceOnly && !manager && !mappingsAllowed()) throw new Error("De XSD-controle is niet geslaagd. Bewaar deze IDS alleen als bron.");
      const mode = manager ? "add" : draft.mode;
      const baseData = mode === "add" && project ? JSON.parse(UDPSProjectFiles.save(project)) : undefined;
      const raw = module.createIdsProject(draft.prepared, { name: mode === "new" ? draft.name.trim() || draft.prepared.document.title : undefined, selectedIds: sourceOnly || manager ? [] : draft.selected, decisions: draft.decisions, baseData,
        previousDocumentId: draft.comparison && draft.linkPrevious ? draft.comparison.previousId : undefined });
      complete(raw, mode);
    } catch (error) { if (form) showError(form, error); }
  }

  async function savedSource(id) {
    const project = getProject();
    const source = project?.sourceData?.idsImports?.find(item => item.id === id);
    if (!source) return;
    const { generation, controller } = beginRead();
    const manager = sourceMode();
    let loading;
    const current = () => !controller.signal.aborted && generation === readGeneration && loading?.isConnected && dialog.open && getProject() === project && sourceMode() === manager;
    showDialog(`<section data-ids-loading data-dialog-route="ids-source:${esc(id)}"><h2 id="dialog-title">IDS-bron openen</h2><p>Broninformatie lezen…</p><p class="small muted" data-ids-progress role="status" hidden></p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button></div></section>`);
    loading = dialog.querySelector("[data-ids-loading]");
    try {
      await load();
      if (!current()) return;
      const prepared = await module.prepareSavedIdsSource(source, project.sourceData.idsImports, processingOptions(controller, current, loading));
      if (!current()) return;
      preparedDraft(prepared, { mode: "add", manager, saved: true, decisions: source.decisions || {}, selectedIds: source.selectedRequirementIds, options: { replace: true } });
    } catch (error) { if (current()) showDialog(`<section data-dialog-route="ids-source:${esc(id)}"><h2 id="dialog-title">IDS-bron</h2><p class="form-error">${esc(error.message)}</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`, { replace: true }); }
  }

  async function example() {
    const { generation, controller } = beginRead();
    const project = getProject();
    const manager = sourceMode();
    const route = `ids-example:${manager ? "source" : "rules"}`;
    let loading;
    const current = () => !controller.signal.aborted && generation === readGeneration && loading?.isConnected && dialog.open && getProject() === project && sourceMode() === manager;
    showDialog(`<section data-ids-loading data-dialog-route="${route}"><h2 id="dialog-title">Voorbeeld-IDS openen</h2><p>Broninformatie lezen…</p><p class="small muted" data-ids-progress role="status" hidden></p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Annuleren</button></div></section>`);
    loading = dialog.querySelector("[data-ids-loading]");
    try {
      await load();
      if (!current()) return;
      const response = await fetch("examples/voorbeeld.ids", { signal: controller.signal });
      if (!current()) return;
      if (!response.ok) throw new Error("De voorbeeld-IDS kon niet worden geladen.");
      const bytes = await response.arrayBuffer();
      if (!current()) return;
      const prepared = await module.prepareIdsFile(new File([bytes], "voorbeeld.ids", { type: "application/xml" }), processingOptions(controller, current, loading));
      if (!current()) return;
      preparedDraft(prepared, { mode: project ? "add" : "new", manager, options: { replace: true } });
    } catch (error) { if (current()) showDialog(`<section data-dialog-route="${route}"><h2 id="dialog-title">Voorbeeld-IDS</h2><p class="form-error">${esc(error.message)}</p><div class="dialog-actions"><button type="button" class="button" data-action="cancel">Sluiten</button></div></section>`, { replace: true }); }
  }

  dialog.addEventListener("change", event => {
    if (event.target.name === "ids-file" && event.target.form?.id === "ids-file-form") {
      cancelRead();
      const form = event.target.form;
      const submit = form.querySelector('[type="submit"]');
      if (submit) { submit.disabled = false; submit.textContent = "Inlezen"; }
      for (const selector of [".form-error", "[data-ids-progress]"]) {
        const label = form.querySelector(selector);
        if (label) { label.hidden = true; label.textContent = ""; }
      }
      return;
    }
    const id = event.target.dataset.idsSelect;
    if (!id || !draft || draft.manager || sourceMode() || !mappingsAllowed()) return;
    rememberName();
    if (event.target.checked) draft.selected.add(id); else draft.selected.delete(id);
    const scrollTop = dialog.querySelector(".ids-proposals")?.scrollTop || 0;
    const openDetails = [...dialog.querySelectorAll("details")].map(item => item.open);
    render();
    [...dialog.querySelectorAll("details")].forEach((item, index) => { item.open = openDetails[index] ?? item.open; });
    if (dialog.querySelector(".ids-proposals")) dialog.querySelector(".ids-proposals").scrollTop = scrollTop;
    dialog.querySelector(`[data-ids-select="${CSS.escape(id)}"]`)?.focus();
  });
  dialog.addEventListener("input", event => {
    const form = event.target.closest("#ids-requirement-form");
    if (!form || event.target.name !== "entities") return;
    const original = JSON.parse(form.dataset.originalEntities).sort();
    const current = [...new Set(event.target.value.split(/[,;\s]+/).filter(Boolean))].sort();
    form.querySelector("[data-scope-ack]").hidden = form.dataset.conditional !== "true" && JSON.stringify(original) === JSON.stringify(current);
  });
  document.addEventListener("submit", event => {
    const form = event.target;
    if (form.id === "ids-file-form") { event.preventDefault(); void readFile(form); }
    if (form.id === "ids-project-form") { event.preventDefault(); create(); }
    if (form.id === "ids-source-form") { event.preventDefault(); create(true); }
    if (form.id === "ids-requirement-form") { event.preventDefault(); saveRequirement(form); }
  });
  dialog.addEventListener("udps:dialog-back", () => {
    cancelRead();
    queueMicrotask(() => {
      const restored = drafts.get(dialog.querySelector("[data-ids-draft]")?.dataset.idsDraft);
      if (restored && restored.owner === getProject() && restored.manager === sourceMode()) draft = restored;
      const submit = dialog.querySelector('#ids-file-form [type="submit"]');
      if (submit) { submit.disabled = false; submit.textContent = "Inlezen"; }
    });
  });
  dialog.addEventListener("close", () => { cancelRead(); draft = undefined; drafts.clear(); dialog.classList.remove("ids-dialog"); });
  return { newDialog, startNew: name => fileDialog("new", typeof name === "string" ? name.trim() : ""), actions: { "ids-new": () => fileDialog("new"), "ids-add": () => fileDialog(getProject() ? "add" : "new"), "ids-review": reviewRequirement, "ids-back": () => render({ replace: true }), "ids-source-only": () => create(true), "ids-source": id => { void savedSource(id); }, "ids-compare": compareSavedSource, "ids-reuse": reuseDecisions, "ids-example": () => { void example(); } } };
}
