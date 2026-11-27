"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const scripts = ["../../web/test/project-files.js", "../../web/test/mapping-rows.js", "../../web/test/studio-workspace.js"];
const { model, files, mapping } = vm.runInNewContext(scripts.map(file => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n") +
  "\n({model:globalThis.UDPSStudioWorkspace,files:UDPSProjectFiles,mapping:UDPSMappingRows});", { structuredClone });
const plain = value => JSON.parse(JSON.stringify(value));
const copy = value => structuredClone(value);
const row = (id, entity, extra = {}) => ({ id, key: "width", entity, propertySet: "Pset_Test", name: "Width", label: "Breedte", type: "Length", active: true, override: null, implicitRevit: false, source: "Eigen regel", ...extra });
const project = (name = "Basis") => ({ name, standards: { width: "BASE" }, rows: [row("door", "IfcDoor"), row("window", "IfcWindow")] });
const parameter = (book, id) => files.parameterOf(book, book.rows.find(row => row.id === id));
function setup(base = project()) {
  const workspace = model.create();
  model.publish(workspace, base, "1");
  const book = model.newFromBase(workspace, "Project A");
  return { workspace, book, base };
}
function update(workspace, base, mutate) {
  const company = copy(base);
  mutate(company);
  model.publish(workspace, company, "2");
  return company;
}
function imported() {
  return files.open(JSON.stringify({ version: 1, source: "Bronbasis", mode: "I/T", skipEmpty: true,
    headers: ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "Uniform_id", "Uniform_revit", "Uniform_datatype", "Source_uri", "Custom_note", "IfcDoor", "IfcWindow"],
    rows: [{ Revit_parameter: "BASE", IFC_parameter: "Width", "Y/N": "x", Export_tabblad: "Pset_Test", Data_type: "Length", Uniform_id: "width", Uniform_revit: "BASE", Uniform_datatype: "Length", Source_uri: "https://example.test/width", Custom_note: "preserve", IfcDoor: "x", IfcWindow: "x" }],
    idsImports: [{ id: "ids-a", xml: "original source", selectedRequirementIds: [] }], extraMetadata: { preserve: true }
  }), "basis.json");
}
function roundtrip(input, book) {
  return files.open(files.save({ ...input, studioContext: { schema: 1, bookId: book.id, basisVersion: book.basisVersion, baseProject: book.baseProject } }), "saved.json");
}
function sourceAddition(input, id, sourceUri) {
  const index = input.sourceData.rows.length;
  input.sourceData.rows.push({ Revit_parameter: id, IFC_parameter: id, "Y/N": "x", Export_tabblad: "Pset_Added", Data_type: "Text", Uniform_id: id, Uniform_revit: id, Uniform_datatype: "Text", Source_uri: sourceUri, Custom_note: id, IfcDoor: "x", IfcWindow: "" });
  input.sourceData.headers = [...new Set([...input.sourceData.headers, ...Object.keys(input.sourceData.rows[index])])];
  input.standards[id] = id;
  input.rows.push(row(id, "IfcDoor", { key: id, name: id, label: id, propertySet: "Pset_Added", type: "Text", sourceIndex: index }));
}

test("create exposes a real empty workspace and newFromBase creates an empty named workbook before publication", () => {
  const workspace = model.create();
  assert.deepEqual(plain(workspace), { schema: 1, company: { name: "Bedrijfsstandaard", versions: [], latest: null, concept: null }, books: [] });
  assert.equal(model.latest(workspace), null);
  const book = model.newFromBase(workspace, "Leeg project");
  assert.equal(book.name, "Leeg project");
  assert.equal(book.basisVersion, null);
  assert.equal(book.baseProject, null);
  assert.deepEqual(plain(book.project.rows), []);
  assert.equal(workspace.books[0], book);
});

test("addBook clones project, base, filters and opaque metadata without references to caller data", () => {
  const workspace = model.create(), input = project("Eigen werkblad"), base = project(), filters = { entities: ["IfcDoor"], search: "Width" };
  input.extra = { nested: ["keep"] };
  const book = model.addBook(workspace, input, { id: "a", basisVersion: "external-1", baseProject: base, filters });
  input.rows[0].type = "Text"; input.extra.nested.push("changed"); base.standards.width = "CHANGED"; filters.entities.push("IfcWindow");
  assert.equal(book.project.rows[0].type, "Length");
  assert.deepEqual(plain(book.project.extra), { nested: ["keep"] });
  assert.equal(book.baseProject.standards.width, "BASE");
  assert.deepEqual(plain(book.filters.entities), ["IfcDoor"]);
  assert(Object.isFrozen(book.baseProject.rows[0]));
  assert.deepEqual(plain(model.addBook(workspace, project(), { filters: null }).filters), {});
});

test("upsertBook replaces only its own project and preserves the recorded base and filters", () => {
  const { workspace, book } = setup();
  const second = model.newFromBase(workspace, "Project B"), base = book.baseProject;
  const next = copy(book.project); next.name = "Nieuwe naam"; next.rows[0].active = false;
  const result = model.upsertBook(workspace, book.id, next, { entities: ["IfcWindow"] });
  assert.equal(result, book);
  assert.equal(book.name, "Nieuwe naam");
  assert.equal(book.baseProject, base);
  assert.equal(second.project.rows[0].active, true);
  next.rows[0].active = true;
  assert.equal(book.project.rows[0].active, false);
  model.upsertBook(workspace, book.id, book.project);
  assert.deepEqual(plain(book.filters), { entities: ["IfcWindow"] });
});

test("publish stores independent immutable snapshots and rejects duplicate or empty versions atomically", () => {
  const workspace = model.create(), input = project();
  const result = model.publish(workspace, input, "v1");
  input.rows[0].name = "Changed";
  assert.equal(result.project.rows[0].name, "Width");
  assert(Object.isFrozen(result.project.rows[0]));
  assert(Object.isFrozen(workspace.company.versions[0].project.standards));
  assert.notEqual(result, workspace.company.versions[0]);
  const first = model.latest(workspace), second = model.latest(workspace);
  assert.notEqual(first, second);
  assert.notEqual(first.project, second.project);
  const before = plain(workspace);
  for (const version of ["", " ", "v1", "bad\nversion"]) assert.throws(() => model.publish(workspace, project(), version));
  assert.deepEqual(plain(workspace), before);
});

test("project and company snapshots omit owned file context while preserving unknown provenance", () => {
  const workspace = model.create(), input = imported();
  input.studioContext = { schema: 1, bookId: "old", baseProject: project(), basisVersion: "old" };
  input.sourceData.studioContext = copy(input.studioContext);
  const book = model.addBook(workspace, input);
  const snapshot = model.publish(workspace, input, "1");
  for (const value of [book.project, snapshot.project]) {
    assert.equal(value.studioContext, undefined);
    assert.equal(value.sourceData.studioContext, undefined);
    assert.equal(value.sourceData.rows[0].Custom_note, "preserve");
    assert.deepEqual(plain(value.sourceData.extraMetadata), { preserve: true });
    assert.equal(value.sourceData.idsImports[0].xml, "original source");
  }
});

test("validate/hydrate roundtrip workspaces, filters, concepts and frozen basis snapshots", () => {
  const { workspace, book } = setup(imported());
  workspace.company.concept = { project: copy(book.project), fromBookId: book.id, changeIds: [book.project.rows[0].id] };
  const hydrated = model.hydrate("\uFEFF" + JSON.stringify(workspace));
  assert.deepEqual(plain(hydrated), plain(workspace));
  assert.notEqual(hydrated.books[0].project, workspace.books[0].project);
  assert(Object.isFrozen(hydrated.company.versions[0].project.rows[0]));
  assert(Object.isFrozen(hydrated.books[0].baseProject));
  hydrated.books[0].project.rows[0].active = false;
  assert.equal(workspace.books[0].project.rows[0].active, true);
  assert.throws(() => model.hydrate("{bad-json"), /geldige JSON/);
});

test("corrupted schemas, publication references, duplicate identities and invalid runtime rows are rejected", () => {
  const { workspace } = setup(imported());
  const corruptions = [
    value => { value.schema = 2; }, value => { value.company.latest = "missing"; },
    value => { value.company.versions.push(copy(value.company.versions[0])); },
    value => { value.books.push(copy(value.books[0])); }, value => { value.books[0].name = "Other"; },
    value => { value.books[0].baseProject = null; }, value => { value.books[0].project.rows[0].active = "x"; },
    value => { value.books[0].project.rows.push(copy(value.books[0].project.rows[0])); },
    value => { value.books[0].project.rows[0].sourceIndex = 99; },
    value => { value.books[0].project.standards["broken"] = 7; },
    value => { value.books[0].project.extra = Infinity; }, value => { value.books[0].project.extra = [undefined]; },
    value => { value.company.concept = { project: project(), fromBookId: "missing", changeIds: [] }; }
  ];
  for (const corrupt of corruptions) { const value = plain(workspace); corrupt(value); assert.throws(() => model.validate(value)); }
  for (const projectName of ["", " ", null, "bad\nname"]) assert.throws(() => model.newFromBase(workspace, projectName));
  assert.throws(() => model.addBook(workspace, project(), { basisVersion: "missing" }), /vastgelegde inhoud/);
});

test("changes returns stable row deltas with before/after values and all relevant fields", () => {
  const { workspace, book } = setup();
  const next = copy(book.project);
  Object.assign(next.rows[0], { override: "LOCAL", active: false, type: "Real", propertySet: "Pset_New", name: "NewWidth", entity: "IfcPlate" });
  next.rows.splice(1, 1);
  next.rows.push(row("added", "IfcWall", { key: "new", name: "New", type: "Text" })); next.standards.new = "NEW";
  model.upsertBook(workspace, book.id, next);
  const differences = model.changes(book);
  assert.deepEqual(Array.from(differences, item => [item.id, item.kind]), [["door", "changed"], ["window", "removed"], ["added", "added"]]);
  for (const field of ["parameter", "active", "type", "propertySet", "name", "entity"]) assert(differences[0].fields.includes(field));
  assert.equal(differences[0].before.parameter, "BASE");
  assert.equal(differences[0].after.parameter, "LOCAL");
  differences[0].after.type = "Corrupt returned delta";
  assert.equal(book.project.rows[0].type, "Real");
});

test("JSON reopening can change storage keys, source addresses and fallback names without a false row delta", () => {
  const { workspace, book } = setup();
  const opened = roundtrip(book.project, book);
  assert.notEqual(opened.rows[0].key, book.project.rows[0].key);
  assert.equal(opened.rows[0].id, book.project.rows[0].id);
  model.upsertBook(workspace, book.id, opened);
  assert.equal(model.changes(book).length, 0);
});

test("actual makeRow-style demos with omitted implicit/classification fields have no phantom file-roundtrip changes", () => {
  const demo = project("Demo");
  for (const row of demo.rows) { delete row.implicitRevit; delete row.classification; }
  const { workspace, book } = setup(demo);
  const opened = roundtrip(book.project, book);
  assert.equal(opened.rows[0].classification, "");
  assert.equal(opened.rows[0].implicitRevit, false);
  assert(opened.sourceData && !demo.sourceData);
  model.upsertBook(workspace, book.id, opened);
  assert.equal(model.changes(book).length, 0);
  const company = roundtrip(demo, book);
  sourceAddition(company, "company-source", "https://example.test/company-source");
  model.publish(workspace, company, "2");
  assert.equal(model.previewUpdate(workspace, book.id).conflicts.length, 0);
  model.applyUpdate(workspace, book.id);
  assert.equal(roundtrip(book.project, book).rows.length, 3);
});

test("three-way update applies company changes to untouched fields while retaining project checkboxes and metadata", () => {
  const { workspace, book, base } = setup();
  book.project.rows[0].active = false;
  book.project.note = { keep: true };
  update(workspace, base, company => { company.standards.width = "NEW"; company.rows[1].type = "Real"; });
  const preview = model.previewUpdate(workspace, book.id);
  assert.equal(preview.conflicts.length, 0);
  assert.equal(preview.fromVersion, "1"); assert.equal(preview.toVersion, "2");
  assert.equal(parameter(preview.nextProject, "door"), "NEW");
  assert.equal(preview.nextProject.rows[0].active, false);
  assert.equal(preview.nextProject.rows.find(row => row.id === "window").type, "Real");
  assert.deepEqual(plain(preview.nextProject.note), { keep: true });
  model.applyUpdate(workspace, book.id);
  assert.equal(book.basisVersion, "2");
  assert.equal(book.project.standards.width, "NEW");
  assert.equal(book.project.rows[0].override, null);
  assert.equal(model.changes(book).filter(change => change.fields.includes("active")).length, 1);
});

test("overlapping parameter changes require explicit keepProject and retain the new central standard", () => {
  const { workspace, book, base } = setup();
  book.project = mapping.changeParameter(book.project, ["door"], "LOCAL");
  update(workspace, base, company => { company.standards.width = "COMPANY"; });
  const before = plain(book), preview = model.previewUpdate(workspace, book.id);
  assert(preview.conflicts.some(conflict => conflict.id === "door" && conflict.field === "parameter" && conflict.resolvable));
  assert.throws(() => model.applyUpdate(workspace, book.id), /Bevestig expliciet/);
  assert.deepEqual(plain(book), before);
  model.applyUpdate(workspace, book.id, { keepProject: true });
  assert.equal(parameter(book.project, "door"), "LOCAL");
  assert.equal(parameter(book.project, "window"), "COMPANY");
  assert.equal(book.project.standards.width, "COMPANY");
  assert.equal(book.project.rows.find(row => row.id === "door").override, "LOCAL");
});

test("identical edits do not conflict and differing central standards retain project values after confirmation", () => {
  let state = setup();
  state.book.project = mapping.changeParameter(state.book.project, ["door"], "SAME");
  update(state.workspace, state.base, company => { company.rows[0].override = "SAME"; });
  assert.equal(model.previewUpdate(state.workspace, state.book.id).conflicts.length, 0);
  model.applyUpdate(state.workspace, state.book.id);
  assert.equal(model.changes(state.book).length, 0);
  state = setup(); state.book.project.standards.width = "PROJECT_STD";
  update(state.workspace, state.base, company => { company.standards.width = "COMPANY_STD"; });
  assert(model.previewUpdate(state.workspace, state.book.id).conflicts.some(conflict => conflict.field === "standard"));
  model.applyUpdate(state.workspace, state.book.id, { keepProject: true });
  assert.equal(state.book.project.standards.width, "PROJECT_STD");
  assert(state.book.project.rows.every(row => row.override === null));
});

test("a local parameter binding survives a temporarily equal company version and a later changed standard", () => {
  const base = project(); base.standards.width = "A";
  const { workspace, book } = setup(base);
  book.project = mapping.changeParameter(book.project, ["door"], "B");
  const companyB = copy(base); companyB.standards.width = "B";
  model.publish(workspace, companyB, "2");
  model.applyUpdate(workspace, book.id);
  assert.equal(book.project.rows.find(row => row.id === "door").override, "B");
  assert.equal(book.baseProject.rows.find(row => row.id === "door").override, null);
  const companyC = copy(companyB); companyC.standards.width = "C";
  model.publish(workspace, companyC, "3");
  const preview = model.previewUpdate(workspace, book.id);
  assert(preview.conflicts.some(conflict => conflict.id === "door" && conflict.field === "parameter"));
  assert.equal(parameter(preview.nextProject, "door"), "B");
  assert.throws(() => model.applyUpdate(workspace, book.id), /Bevestig expliciet/);
  model.applyUpdate(workspace, book.id, { keepProject: true });
  assert.equal(parameter(book.project, "door"), "B");
  assert.equal(parameter(book.project, "window"), "C");
  assert.equal(book.project.standards.width, "C");
});

test("independent row field edits merge without widening the selected application", () => {
  const { workspace, book, base } = setup();
  book.project.rows[0].type = "Real";
  update(workspace, base, company => { company.rows[0].override = "COMPANY_LOCAL"; company.rows[1].active = false; });
  assert.equal(model.previewUpdate(workspace, book.id).conflicts.length, 0);
  model.applyUpdate(workspace, book.id);
  assert.equal(book.project.rows.find(row => row.id === "door").type, "Real");
  assert.equal(parameter(book.project, "door"), "COMPANY_LOCAL");
  assert.equal(book.project.rows.find(row => row.id === "window").type, "Length");
  assert.equal(book.project.rows.find(row => row.id === "window").active, false);
});

test("local and company deletions are retained without raw source rows resurrecting on export", () => {
  const base = imported(), { workspace, book } = setup(base), id = book.project.rows[0].id;
  book.project = files.removeApplications(book.project, [id]);
  update(workspace, base, company => { company.rows[1].type = "Real"; });
  assert.equal(model.previewUpdate(workspace, book.id).conflicts.length, 0);
  model.applyUpdate(workspace, book.id);
  assert(!book.project.rows.some(row => row.id === id));
  const restored = roundtrip(book.project, book);
  assert.equal(restored.rows.length, 1);
  assert.equal(restored.rows[0].entity, "IfcWindow");
  const second = setup(imported());
  update(second.workspace, second.base, company => { company.rows = []; company.removedSourceIndices = [0]; });
  model.applyUpdate(second.workspace, second.book.id);
  assert.equal(second.book.project.rows.length, 0);
  assert.equal(roundtrip(second.book.project, second.book).rows.length, 0);
});

test("delete-versus-edit conflicts preserve the project choice only after explicit confirmation", () => {
  let state = setup();
  state.book.project.rows = state.book.project.rows.filter(row => row.id !== "door");
  update(state.workspace, state.base, company => { company.rows[0].type = "Real"; });
  assert(model.previewUpdate(state.workspace, state.book.id).conflicts.some(conflict => conflict.field === "presence"));
  model.applyUpdate(state.workspace, state.book.id, { keepProject: true });
  assert(!state.book.project.rows.some(row => row.id === "door"));
  state = setup(); state.book.project.rows[0].override = "LOCAL";
  update(state.workspace, state.base, company => { company.rows = company.rows.filter(row => row.id !== "door"); });
  model.applyUpdate(state.workspace, state.book.id, { keepProject: true });
  assert.equal(parameter(state.book.project, "door"), "LOCAL");
});

test("independent additions from company and project both survive with independent standards", () => {
  const { workspace, book, base } = setup();
  book.project.rows.push(row("own", "IfcWall", { key: "own", name: "Own" })); book.project.standards.own = "OWN";
  update(workspace, base, company => { company.rows.push(row("company", "IfcPlate", { key: "company", name: "Company" })); company.standards.company = "COMPANY"; });
  model.applyUpdate(workspace, book.id);
  assert.deepEqual(new Set(Array.from(book.project.rows, row => row.id)), new Set(["door", "window", "own", "company"]));
  assert.equal(parameter(book.project, "own"), "OWN"); assert.equal(parameter(book.project, "company"), "COMPANY");
});

test("empty defaults, explicit overrides and implicit IFC-name semantics survive updates and JSON", () => {
  const base = project(); base.standards.width = "";
  base.rows[0].implicitRevit = true; base.rows[0].override = "";
  base.rows[1].override = "WINDOW";
  const { workspace, book } = setup(base);
  update(workspace, base, company => { company.rows[1].type = "Text"; });
  model.applyUpdate(workspace, book.id);
  assert.equal(book.project.standards.width, "");
  assert.equal(book.project.rows.find(row => row.id === "door").implicitRevit, true);
  assert.equal(book.project.rows.find(row => row.id === "door").override, "");
  assert.equal(parameter(book.project, "window"), "WINDOW");
  const restored = roundtrip(book.project, book);
  assert.equal(restored.rows.find(row => row.id === "door").implicitRevit, true);
  assert.equal(restored.standards[restored.rows[0].key], "");
});

test("company source additions retain exact raw context while own application edits survive", () => {
  const base = imported(), { workspace, book } = setup(base);
  const localId = book.project.rows[0].id;
  book.project.rows[0].override = "LOCAL";
  update(workspace, base, company => { sourceAddition(company, "new-source", "https://example.test/new-source"); company.sourceData.libraryImports = [{ id: "new", version: "1", library: { original: true } }]; });
  const preview = model.previewUpdate(workspace, book.id);
  assert.equal(preview.conflicts.length, 0);
  model.applyUpdate(workspace, book.id);
  assert.equal(parameter(book.project, localId), "LOCAL");
  assert.equal(book.project.rows.find(row => row.id === "new-source").sourceIndex, 1);
  assert.equal(book.project.sourceData.rows[1].Source_uri, "https://example.test/new-source");
  assert.equal(book.project.sourceData.idsImports[0].xml, "original source");
  assert.equal(roundtrip(book.project, book).rows.length, 3);
});

test("local export sorting survives a company provenance extension without becoming a source conflict", () => {
  const base = imported(), { workspace, book } = setup(base);
  book.project.sourceData.exportOrder = "entity";
  update(workspace, base, company => { sourceAddition(company, "new-source", "https://example.test/new-source"); });
  assert.equal(model.previewUpdate(workspace, book.id).conflicts.length, 0);
  model.applyUpdate(workspace, book.id);
  assert.equal(book.project.sourceData.exportOrder, "entity");
  assert.equal(book.project.sourceData.rows[1].Source_uri, "https://example.test/new-source");
});

test("divergent source provenance is a blocking conflict even when keepProject is requested", () => {
  const base = imported(), { workspace, book } = setup(base);
  book.project.sourceData.idsImports[0].xml = "PROJECT SOURCE";
  update(workspace, base, company => { company.sourceData.idsImports[0].xml = "COMPANY SOURCE"; });
  const before = plain(book), preview = model.previewUpdate(workspace, book.id);
  assert.equal(preview.nextProject, null);
  assert(preview.conflicts.some(conflict => conflict.field === "sourceData" && conflict.resolvable === false));
  assert.throws(() => model.applyUpdate(workspace, book.id, { keepProject: true }), /broncontext/);
  assert.deepEqual(plain(book), before);
});

test("materialized mapping fields, filenames and Studio ids do not create a false provenance conflict", () => {
  const base = imported(), { workspace, book } = setup(base);
  const id = book.project.rows[0].id;
  book.project.rows[0].override = "LOCAL";
  model.upsertBook(workspace, book.id, roundtrip(book.project, book));
  const company = copy(base); company.rows[1].type = "Real";
  const companyFile = roundtrip(company, book);
  model.publish(workspace, companyFile, "2");
  const preview = model.previewUpdate(workspace, book.id);
  assert(!preview.conflicts.some(conflict => conflict.field === "sourceData"));
  model.applyUpdate(workspace, book.id);
  assert.equal(parameter(book.project, id), "LOCAL");
  assert.equal(book.project.sourceData.rows[0].Custom_note, "preserve");
  assert.equal(book.project.rows.find(row => row.entity === "IfcWindow").type, "Real");
});

test("other opaque project metadata is preserved or surfaced as a resolvable field conflict", () => {
  const base = project(); base.extra = { original: true };
  const { workspace, book } = setup(base);
  book.project.extra = { local: true };
  update(workspace, base, company => { company.extra = { company: true }; });
  assert(model.previewUpdate(workspace, book.id).conflicts.some(conflict => conflict.scope === "project" && conflict.field === "extra"));
  model.applyUpdate(workspace, book.id, { keepProject: true });
  assert.deepEqual(plain(book.project.extra), { local: true });
});

test("unused central standards merge as real metadata and row order survives materialization", () => {
  const base = project(); base.standards.unused = "OLD";
  base.rows.splice(1, 0, row("height", "IfcDoor", { key: "height", name: "Height" })); base.standards.height = "HEIGHT";
  const { workspace, book } = setup(base);
  update(workspace, base, company => { company.standards.unused = "NEW"; });
  model.applyUpdate(workspace, book.id);
  assert.equal(book.project.standards.unused, "NEW");
  assert.deepEqual(Array.from(book.project.rows, row => row.id), ["door", "height", "window"]);
});

test("reopened split source rows do not conflict with a real company source extension", () => {
  const base = imported(), { workspace, book } = setup(base), id = book.project.rows[0].id;
  book.project.rows[0].override = "LOCAL";
  model.upsertBook(workspace, book.id, roundtrip(book.project, book));
  assert.equal(book.project.sourceData.rows.length, 2, "The real adapter splits the formerly shared source row");
  update(workspace, base, company => { sourceAddition(company, "company-source", "https://example.test/company-source"); });
  const preview = model.previewUpdate(workspace, book.id);
  assert.equal(preview.conflicts.length, 0);
  model.applyUpdate(workspace, book.id);
  assert.equal(parameter(book.project, id), "LOCAL");
  assert.equal(book.project.rows.find(row => row.id === "company-source").sourceIndex, 1);
  assert.equal(roundtrip(book.project, book).rows.length, 3);
});

test("prepareConcept promotes only selected row differences and retains newer unrelated company edits", () => {
  const { workspace, book, base } = setup();
  book.project.rows[0].override = "DOOR_LOCAL"; book.project.rows[1].override = "WINDOW_UNSELECTED";
  book.project.extra = { doNotPromote: true };
  update(workspace, base, company => { company.rows[1].type = "Real"; });
  const before = plain(workspace), result = model.prepareConcept(workspace, book.id, ["door"]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(parameter(result.project, "door"), "DOOR_LOCAL");
  assert.equal(parameter(result.project, "window"), "BASE");
  assert.equal(result.project.rows.find(row => row.id === "window").type, "Real");
  assert.equal(result.project.extra, undefined);
  assert.deepEqual(Array.from(result.changes, change => change.id), ["door"]);
  assert.deepEqual(plain(workspace), before);
});

test("partial central-standard promotion does not change unselected rows or their inherited defaults", () => {
  const { workspace, book } = setup();
  book.project.standards.width = "LOCAL_STD";
  const result = model.prepareConcept(workspace, book.id, ["door"]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(parameter(result.project, "door"), "LOCAL_STD");
  assert.equal(parameter(result.project, "window"), "BASE");
  assert.equal(result.project.standards.width, "BASE");
  assert.equal(result.project.rows.find(row => row.id === "window").override, null);
});

test("prepareConcept safely projects a selected source addition without exporting unselected raw rules", () => {
  const base = imported(), { workspace, book } = setup(base);
  sourceAddition(book.project, "chosen", "https://example.test/chosen");
  sourceAddition(book.project, "unselected", "https://example.test/unselected");
  const result = model.prepareConcept(workspace, book.id, ["chosen"]);
  assert.equal(result.conflicts.length, 0);
  assert(result.project.rows.some(row => row.id === "chosen"));
  assert(!result.project.rows.some(row => row.id === "unselected"));
  assert(result.project.removedSourceIndices.includes(2));
  const raw = JSON.parse(files.save(result.project));
  assert(raw.rows.some(row => row.Source_uri === "https://example.test/chosen"));
  assert(!raw.rows.some(row => row.Source_uri === "https://example.test/unselected"));
});

test("selective source concepts remain correct after the actual file adapter changes keys and indices", () => {
  const { workspace, book } = setup(imported());
  sourceAddition(book.project, "chosen", "https://example.test/chosen");
  sourceAddition(book.project, "unselected", "https://example.test/unselected");
  book.project.rows[0].override = "LOCAL_UNSELECTED";
  model.upsertBook(workspace, book.id, roundtrip(book.project, book));
  assert.equal(book.project.rows.find(row => row.id === "chosen").key, "udps:chosen");
  const result = model.prepareConcept(workspace, book.id, ["chosen"]);
  assert.equal(result.conflicts.length, 0);
  assert.equal(parameter(result.project, "udps-0-IfcDoor"), "BASE");
  assert(result.project.rows.some(row => row.id === "chosen"));
  assert(!result.project.rows.some(row => row.id === "unselected"));
  const raw = JSON.parse(files.save(result.project));
  assert(raw.rows.some(row => row.Source_uri === "https://example.test/chosen"));
  assert(!raw.rows.some(row => row.Source_uri === "https://example.test/unselected"));
});

test("selected deletions and first-publication whole projects produce independent concept snapshots", () => {
  const { workspace, book } = setup();
  book.project.rows = book.project.rows.filter(row => row.id !== "door");
  const result = model.prepareConcept(workspace, book.id, ["door"]);
  assert(!result.project.rows.some(row => row.id === "door"));
  const empty = model.create(), own = model.addBook(empty, project("Eerste basis"));
  const first = model.prepareConcept(empty, own.id);
  assert.deepEqual(plain(first.project), plain(own.project));
  assert.notEqual(first.project.rows[0], own.project.rows[0]);
  assert.equal(empty.company.concept, null);
});

test("concept conflicts are returned without mutating or publishing the workspace", () => {
  const { workspace, book, base } = setup();
  book.project.rows[0].override = "LOCAL";
  update(workspace, base, company => { company.rows[0].override = "COMPANY"; });
  const before = plain(workspace), result = model.prepareConcept(workspace, book.id, ["door"]);
  assert(result.conflicts.some(conflict => conflict.id === "door" && conflict.field === "parameter"));
  assert.deepEqual(plain(workspace), before);
  for (const selection of [[], ["missing"], "door"]) assert.throws(() => model.prepareConcept(workspace, book.id, selection));
  assert.throws(() => model.upsertBook(workspace, "missing", project()), /bestaat niet/);
});
