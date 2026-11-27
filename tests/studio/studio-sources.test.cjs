const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../web/test");
const adapter = vm.runInNewContext(fs.readFileSync(path.join(root, "project-files.js"), "utf8") + "\nUDPSProjectFiles;");
const script = new vm.Script(fs.readFileSync(path.join(root, "studio-sources.js"), "utf8") + "\nUDPSStudioSources;", {
  filename: path.join(root, "studio-sources.js"), importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
});
const factory = script.runInNewContext({
  document: { currentScript: { src: pathToFileURL(path.join(root, "studio-sources.js")).href } },
  URL, TextEncoder, structuredClone, Blob, FormData, UDPSProjectFiles: adapter
});
const plain = value => JSON.parse(JSON.stringify(value));
let domainPromise;
async function domain() {
  if (!domainPromise) domainPromise = (async () => {
    const names = ["bsdd", "products", "property-loader", "mapping", "libraries", "view", "sources", "uniform", "core"];
    const modules = await Promise.all(names.map(name => import(pathToFileURL(path.join(root, "production", name + ".js")).href + "?v=1.12.1")));
    const loaded = Object.fromEntries(names.map((name, i) => [name, modules[i]]));
    return { ...loaded, catalog: loaded.sources.validateCatalog(JSON.parse(fs.readFileSync(path.join(root, "production/catalog.json")))), snapshot: JSON.parse(fs.readFileSync(path.join(root, "production/relations.json"))) };
  })();
  return domainPromise;
}
function workbook(rows = []) {
  return adapter.open(JSON.stringify({
    version: 1, source: "Studio test", headers: ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "IfcDoor", "IfcWindow", "Custom_note"], rows,
    libraryImports: [{ id: "own", version: "1", library: { license: "retain" } }], companyBasis: { version: "2.4", immutable: true }, extension: { untouched: [1, 2] }
  }), "test.json");
}
function rawRow(values = {}) { return { Revit_parameter: "OWN", IFC_parameter: "Own", "Y/N": "x", Export_tabblad: "Pset_Own", Data_type: "MassDensity", IfcWindow: "x", Custom_note: "Keep", ...values }; }
function harness(project = workbook(), load = domain) {
  let current = project, form;
  const listeners = {}, nodes = new Map(), renders = [], dialogOptions = [], commits = [], notices = [], downloads = [];
  const dialog = {
    open: false,
    addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
    querySelector(selector) { return nodes.get(selector.slice(1)) || null; },
    close() { this.open = false; if (form) form.isConnected = false; for (const listener of listeners.close || []) listener({}); }
  };
  function showDialog(markup, options) {
    if (form) form.isConnected = false;
    nodes.clear(); dialog.open = true; renders.push(markup); dialogOptions.push(options);
    for (const match of markup.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], { id: match[1], innerHTML: "", textContent: "" });
    const id = markup.match(/<form id="([^"]+)"/)[1], error = { textContent: "", hidden: true }, submit = { disabled: false };
    form = { id, isConnected: true, error, elements: { revit: { value: "" } }, querySelector(selector) { return selector === ".form-error" ? error : selector === '[type="submit"]' ? submit : null; } };
    nodes.set(id, form);
  }
  const api = factory({ getProject: () => current, dialog, showDialog, escapeHtml: value => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"), loadDomain: load,
    complete(raw, mode) { commits.push({ raw, mode }); current = adapter.open(JSON.stringify(raw), "added.json"); dialog.close(); },
    message: value => notices.push(value), downloadFile: (...args) => downloads.push(args) });
  return { api, dialog, renders, dialogOptions, commits, notices, downloads, restore: showDialog, get form() { return form; }, get project() { return current; }, set project(value) { current = value; }, emit(type, target) { for (const listener of listeners[type] || []) listener({ target }); } };
}
async function entryFixture() {
  const d = await domain(), detail = Object.values(d.snapshot.details).find(item => item.name === "Binnendeur");
  const related = d.snapshot.relations[d.bsdd.relationshipKey(d.sources.ILS, "IfcDoor")];
  const selection = { source: related.source, entity: related.entity, version: related.version, classes: related.items, class: related.items.find(item => item.uri === detail.uri), ifcTargets: related.ifcTargets };
  const result = await d["property-loader"].collectProperties([selection], async () => detail);
  assert.ok(result.entries.length > 1);
  return { d, detail, selection, entries: result.entries };
}
const settled = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test("production helpers and whole catalog snapshots match their pinned provenance hashes", async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "production/provenance.json")));
  assert.equal(manifest.revision, "9a05876a33ab8d37543a393a8843f7c623c4ffc8");
  for (const file of manifest.files) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "production", file.file))).digest("hex"), file.sha256, file.file);
  const d = await domain();
  assert.equal(d.snapshot.registry.length, 442);
  assert.ok(d.mapping.availableEntities(d.catalog).length > 200);
  assert.equal(d.products.searchProducts(d.snapshot.products[d.sources.ILS].items, "deur", "Class").some(item => item.name === "Deur"), true);
});

test("planning uses real source relationships and preserves project metadata, source constraints and pending state", async () => {
  const { entries, detail } = await entryFixture(), h = harness(workbook([rawRow()]));
  const before = adapter.save(h.project), plan = await h.api.planImport([entries[0]], "");
  assert.equal(plan.result.added, 1);
  assert.equal(plan.raw.rows[0].Custom_note, "Keep");
  assert.deepEqual(plain(plan.raw.companyBasis), { version: "2.4", immutable: true });
  assert.deepEqual(plain(plan.raw.libraryImports), plain(h.project.sourceData.libraryImports));
  const added = plan.raw.rows.at(-1);
  assert.equal(added.Source_uri, entries[0].item.uri);
  assert.equal(added.Source_class_uri, detail.uri);
  assert.equal(added.Source_dictionary, entries[0].selection.source);
  assert.equal(added.Source_version, entries[0].selection.version);
  assert.equal(added.Mapping_pending, "x");
  assert.equal(JSON.parse(added.Source_contexts)[0].classUri, detail.uri);
  assert.ok(added.Source_property_constraints);
  assert.equal(adapter.save(h.project), before);
  assert.equal(h.commits.length, 0);
  const restored = adapter.open(adapter.save(adapter.open(JSON.stringify(plan.raw), "added.json")), "saved.json");
  assert.equal(restored.sourceData.companyBasis.version, "2.4");
  assert.equal(restored.rows.find(row => row.sourceIndex === plan.raw.rows.length - 1).source, added.Source_name);
});

test("a forged or mismatched source class is rejected before changing the project", async () => {
  const { entries } = await entryFixture(), h = harness(workbook([rawRow()])), before = adapter.save(h.project);
  const wrong = { ...entries[0], item: { ...entries[0].item, classUri: "https://example.test/other-class" } };
  await assert.rejects(h.api.planImport([wrong]), /Ongeldige bronrelatie/);
  assert.equal(adapter.save(h.project), before);
  assert.equal(h.commits.length, 0);
  await assert.rejects(h.api.planImport([]), /Selecteer eigenschappen/);
});

test("conflict after an earlier proposed addition rejects the complete selection atomically", async () => {
  const { entries } = await entryFixture();
  const h = harness(workbook([rawRow({ IFC_parameter: entries[1].item.code, Export_tabblad: entries[1].item.propertySet, IfcDoor: "x", IfcWindow: "" })]));
  const before = adapter.save(h.project);
  await assert.rejects(h.api.planImport(entries.slice(0, 2), "NEW"), /andere broneigenschap/);
  assert.equal(adapter.save(h.project), before);
});

test("reselecting an imported source preserves its existing Revit name and identity", async () => {
  const { entries } = await entryFixture(), h = harness();
  const first = await h.api.planImport([entries[0]], "EXISTING");
  h.project = adapter.open(JSON.stringify(first.raw), "first.json");
  const second = await h.api.planImport([entries[0]], "REPLACEMENT");
  assert.equal(second.result.added, 0);
  assert.equal(second.result.skipped, 1);
  assert.equal(second.raw.rows.length, 1);
  assert.equal(second.raw.rows[0].Revit_parameter, "EXISTING");
  assert.equal(second.raw.rows[0].Source_uri, entries[0].item.uri);
});

test("library export uses real projectLibrary, includes inactive mappings and canonical Electric types", async () => {
  const h = harness(workbook([
    rawRow({ IFC_parameter: "Current", Data_type: "ElectricCurrent" }),
    rawRow({ IFC_parameter: "Voltage", Data_type: "ElectricVoltage", "Y/N": "" }),
    rawRow({ IFC_parameter: "Density", Data_type: "MassDensity" })
  ]));
  const before = adapter.save(h.project), library = await h.api.libraryOf({ name: "Mijn bibliotheek", version: "2.0", id: "mijn-bibliotheek" });
  assert.equal(library.format, "udps-library");
  assert.equal(library.schema, 1);
  assert.deepEqual(library.classes.flatMap(item => item.properties).map(item => item.dataType), ["ElectricCurrent", "ElectricVoltage", "MassDensity"]);
  assert.equal(JSON.stringify(library).includes("Revit_parameter"), false);
  assert.equal(adapter.save(h.project), before);
});

test("library export refuses incompatible datatypes without changing the original workbook", async () => {
  const h = harness(workbook([rawRow({ Data_type: "Length" }), rawRow({ Data_type: "Real" })]));
  const before = adapter.save(h.project);
  await assert.rejects(h.api.libraryOf({ name: "Mijn", version: "1", id: "mijn" }), /Conflicterende datatypes/);
  assert.equal(adapter.save(h.project), before);
});

test("a project switch during dependency loading cannot plan into the replacement workbook", async () => {
  const { entries } = await entryFixture();
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const h = harness(workbook(), () => delayed), pending = h.api.planImport([entries[0]]);
  h.project = workbook([rawRow()]);
  release(await domain());
  await assert.rejects(pending, /werkblad is gewijzigd/);
  assert.equal(h.project.rows.length, 1);
  assert.equal(h.commits.length, 0);
});

test("closing the source dialog ignores late asynchronous startup results", async () => {
  let release;
  const h = harness(workbook(), () => new Promise(resolve => { release = resolve; }));
  const opening = h.api.actions["bsdd-open"]();
  assert.equal(h.form.id, "studio-bsdd-loading");
  h.dialog.close();
  release(await domain());
  await opening;
  assert.equal(h.renders.length, 1);
  assert.equal(h.dialog.open, false);
  assert.equal(h.commits.length, 0);
});

test("source refresh failure stays visible and a deliberate retry can recover", async () => {
  const d = await domain(); let attempts = 0;
  const modified = { ...d, bsdd: { ...d.bsdd, async dictionaries() { if (!attempts++) throw Error("CORS: bron niet bereikbaar"); return d.snapshot.registry; } } };
  const h = harness(workbook(), async () => modified);
  await h.api.actions["bsdd-open"]();
  await h.api.actions["bsdd-registry"]();
  assert.match(h.form.error.textContent, /CORS/);
  assert.equal(h.commits.length, 0);
  await h.api.actions["bsdd-registry"]();
  assert.match(h.renders.at(-1), /Bronlijst uit bSDD geladen/);
});

async function selectOne(h) {
  const { detail } = await entryFixture();
  await h.api.actions["bsdd-open"]();
  await h.api.actions["bsdd-route"]("ifc");
  await h.api.actions["bsdd-choose"](detail.uri);
  assert.equal(h.form.id, "studio-bsdd-properties");
  h.emit("change", { dataset: { bsddProperty: "0" }, checked: true });
  h.form.elements.revit.value = "BRIDGE_REVIT";
  assert.equal(h.api.handleSubmit(h.form), true);
  await settled();
  assert.equal(h.form.id, "studio-bsdd-preview");
}
test("dialog workflow previews before committing an actual source mapping", async () => {
  const h = harness();
  await selectOne(h);
  assert.equal(h.commits.length, 0);
  h.api.handleSubmit(h.form);
  await settled();
  assert.equal(h.commits.length, 1);
  assert.equal(h.commits[0].mode, "add");
  assert.equal(h.commits[0].raw.rows[0].Revit_parameter, "BRIDGE_REVIT");
  assert.ok(h.commits[0].raw.rows[0].Source_class_uri);
});
test("a changed workbook invalidates the visible import preview instead of replacing its data", async () => {
  const h = harness();
  await selectOne(h);
  h.project.name = "Changed while reviewing";
  h.api.handleSubmit(h.form);
  await settled();
  assert.match(h.form.error.textContent, /werkblad is gewijzigd/);
  assert.equal(h.commits.length, 0);
  assert.equal(h.project.rows.length, 0);
});
test("source routes replace generic dialog history and an external back invalidates restored source markup", async () => {
  const h = harness(), { d } = await entryFixture();
  await selectOne(h);
  h.api.actions["bsdd-properties"]();
  const oldMarkup = h.renders.at(-1);
  h.api.actions["bsdd-back"]();
  const other = Object.values(d.snapshot.details).find(item => item.name === "Deur");
  await h.api.actions["bsdd-choose"](other.uri);
  assert.equal(h.form.id, "studio-bsdd-properties");
  assert.ok(h.dialogOptions.every(options => options?.replace === true));
  h.emit("udps:dialog-back", {});
  h.restore(oldMarkup, { replace: true, fromBack: true });
  assert.equal(h.api.handleSubmit(h.form), true);
  assert.match(h.form.error.textContent, /bronselectie is niet meer actief/);
  h.api.actions["bsdd-select-all"]();
  await settled();
  assert.equal(h.commits.length, 0);
});

function archive(files) {
  let offset = 0;
  const locals = [], centrals = [];
  for (const [name, content] of Object.entries(files)) {
    const n = Buffer.from(name), payload = Buffer.from(content), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(payload.length, 22); local.writeUInt16LE(n.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(payload.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, n, payload); centrals.push(central, n); offset += local.length + n.length + payload.length;
  }
  const end = Buffer.alloc(22), directory = Buffer.concat(centrals);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...locals, directory, end]); return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}
let DOMParser;
try { ({ DOMParser } = require("@xmldom/xmldom")); } catch { /* Available after the production repository's npm ci; not a browser dependency. */ }
test("Excel bridge reads a real ILS_Gevel table and the adapter normalizes IfcWindowsw", { skip: !DOMParser }, async t => {
  const previous = global.DOMParser; global.DOMParser = DOMParser; t.after(() => { global.DOMParser = previous; });
  const headers = ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "IfcWindowsw"], values = ["Breedte", "Width", "x", "Pset_Test", "Length", "x"];
  const buffer = archive({
    "xl/tables/table1.xml": `<table name="ILS_Gevel" ref="A1:F2"><tableColumns>${headers.map((name, i) => `<tableColumn id="${i + 1}" name="${name}"/>`).join("")}</tableColumns></table>`,
    "xl/worksheets/_rels/sheet1.xml.rels": '<Relationships><Relationship Target="../tables/table1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="2">${values.map((value, i) => `<c r="${String.fromCharCode(65 + i)}2" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row></sheetData></worksheet>`,
    "xl/vbaProject.bin": "Unused macro payload"
  });
  const h = harness(), raw = await h.api.readExcel({ name: "fixture.xlsm", size: buffer.byteLength, async arrayBuffer() { return buffer; } });
  assert.equal(raw.rows[0].Revit_parameter, "Breedte");
  assert.equal(adapter.open(JSON.stringify(raw), "fixture.xlsm").rows[0].entity, "IfcWindow");
  assert.equal(h.commits.length, 0);
});
test("Excel refuses oversized and wrong-format input before reading bytes", async () => {
  const h = harness(); let reads = 0;
  for (const file of [{ name: "too-big.xlsx", size: 20 * 1024 * 1024 + 1 }, { name: "old.xls", size: 100 }]) {
    await assert.rejects(h.api.readExcel({ ...file, async arrayBuffer() { reads++; return new ArrayBuffer(0); } }), /20 MiB/);
  }
  assert.equal(reads, 0);
});
test("library export form keeps the native form id available for submit routing", () => {
  const h = harness();
  h.api.actions["library-export"]();
  const markup = h.renders.at(-1);
  assert.equal(h.form.id, "studio-library-export");
  assert.doesNotMatch(markup, /<(?:input|select|textarea)\b[^>]*\bname=["']id["']/i,
    "a field named id overrides HTMLFormElement.id and prevents the real submit route");
  assert.match(markup, /name="library-id"/);
});
