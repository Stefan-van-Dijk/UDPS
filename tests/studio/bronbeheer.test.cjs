const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = path.join(__dirname, "../../web/test");
const app = readFileSync(path.join(dist, "app.js"), "utf8");
const helpers = ["project-files.js", "rule-fields.js", "mapping-rows.js"]
  .map(file => readFileSync(path.join(dist, file), "utf8")).join("\n");
const exampleXml = readFileSync(path.join(dist, "examples/voorbeeld.ids"), "utf8");
const exampleLibrary = JSON.parse(readFileSync(path.join(dist, "examples/voorbeeldbibliotheek.json"), "utf8"));
const plain = value => JSON.parse(JSON.stringify(value));

function appFunctions(first, next) {
  const start = app.indexOf(`  function ${first}(`);
  const end = app.indexOf(`  function ${next}(`, start + 1);
  assert.ok(start >= 0 && end > start, `Actual app functions ${first}..${next} must exist`);
  return app.slice(start, end);
}

// Execute the app's actual inventory/delete/undo functions. Only UI effects are
// stubbed; provenance, grouping, deletion markers and JSON persistence are real.
const sourceManagement = appFunctions("sourceKey", "sourceRecordMarkup") +
  appFunctions("removeSource", "issueGroups");

function harness(input) {
  const effects = { closed: 0, rendered: 0, focused: [], notices: [], error: { hidden: true, textContent: "" } };
  const context = {
    input: structuredClone(input), structuredClone,
    dialog: {
      close() { effects.closed++; },
      querySelector(selector) { assert.equal(selector, ".form-error"); return effects.error; }
    },
    document: { getElementById(id) { return { focus() { effects.focused.push(id); } }; } },
    render() { effects.rendered++; },
    message(text, undo = false, action) { effects.notices.push({ text, undo, action }); }
  };
  const api = vm.runInNewContext(`${helpers}
    const state = { project: UDPSProjectFiles.open(JSON.stringify(input), "legacy.json"), revised: false };
    let lastSourceRemoval = null;
    ${sourceManagement}
    ({
      records: sourceRecords, remove: removeSource, undo: undoSourceRemoval,
      project: () => state.project, save: () => UDPSProjectFiles.save(state.project),
      removeApplications: ids => { state.project = UDPSProjectFiles.removeApplications(state.project, ids); }
    });`, context);
  return { ...api, effects };
}

function idsSource(name) {
  const xml = `${exampleXml}\n<!-- ${name} -->`;
  return { schema: 1, id: `sha256:${createHash("sha256").update(xml).digest("hex")}`,
    fileName: `${name}.ids`, xml, selectedRequirementIds: [], customEvidence: { keep: name } };
}

function librarySource(version) {
  const library = { ...structuredClone(exampleLibrary), version };
  const uri = `urn:udps:library:${encodeURIComponent(library.id)}:${encodeURIComponent(version)}`;
  return { id: library.id, version, name: library.name, uri, fileName: `library-${version}.json`, library,
    customEvidence: { keep: version } };
}

function rawFile(row, sources) {
  return { version: 1, source: "Legacy project", mode: "I/T", skipEmpty: true,
    headers: row ? Object.keys(row) : ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "IfcDoor"],
    rows: row ? [row] : [], ...sources, customProjectMetadata: { keep: [1, 2] } };
}

function sourceRow(fields, entity = "") {
  return { Revit_parameter: "BASE", IFC_parameter: "FireRating", "Y/N": "x",
    Export_tabblad: "Pset_DoorCommon", Data_type: "Text", IfcDoor: entity, ...fields };
}

function idsFields(source) {
  return { Mapping_origin: "ids", IDS_requirements: JSON.stringify([
    { documentId: source.id, specificationId: "spec:0", requirementId: "spec:0/requirement:0" }
  ]) };
}

test("a passive raw IDS reference prevents source deletion and survives JSON saving", () => {
  const source = idsSource("retained");
  const input = rawFile(sourceRow(idsFields(source)), { idsImports: [source] });
  const app = harness(input);
  const before = app.save();
  const record = app.records().find(record => record.sourceId === source.id);
  assert.equal(app.project().rows.length, 0);
  assert.equal(record.used.length, 0);
  assert.equal(record.retained, 1);

  app.remove(record.key);

  assert.equal(app.save(), before, "A direct removal call must also protect retained raw provenance");
  assert.equal(app.effects.closed, 0);
  assert.equal(app.effects.rendered, 0);
  assert.deepEqual(JSON.parse(app.save()).idsImports[0], source);
  assert.equal(JSON.parse(app.save()).rows[0].IDS_requirements, input.rows[0].IDS_requirements);
});

test("a passive raw library reference protects its exact stored library version", () => {
  const source = librarySource("1.0");
  const row = sourceRow({ Mapping_origin: "library", Source_dictionary: source.uri, Source_version: source.version,
    Source_uri: `${source.uri}:class:door:property:Pset_DoorCommon:FireRating` });
  const app = harness(rawFile(row, { libraryImports: [source] }));
  const before = app.save();
  const record = app.records().find(record => record.sourceId === source.id && record.sourceVersion === source.version);
  assert.equal(record.used.length, 0);
  assert.equal(record.retained, 1);

  app.remove(record.key);

  assert.equal(app.save(), before);
  assert.equal(app.effects.closed, 0);
  assert.deepEqual(JSON.parse(app.save()).libraryImports[0], source);
});

test("an explicitly removed source row no longer prevents deleting the unused source", () => {
  const source = idsSource("removed");
  const app = harness(rawFile(sourceRow(idsFields(source), "x"), { idsImports: [source] }));
  app.removeApplications(app.project().rows.map(row => row.id));
  assert.deepEqual(plain(app.project().removedSourceIndices), [0]);
  const record = app.records().find(record => record.sourceId === source.id);
  assert.equal(record.used.length, 0);
  assert.equal(record.retained, 0);

  app.remove(record.key);

  const saved = JSON.parse(app.save());
  assert.deepEqual(saved.idsImports, []);
  assert.deepEqual(saved.rows, [], "Explicit deletion must remove the old raw reference as well");
  assert.equal(app.effects.closed, 1);
});

for (const kind of ["ids", "library"]) {
  test(`ordinary unused ${kind} source deletion and undo preserve the full collection and record order`, () => {
    const sources = kind === "ids" ? [idsSource("first"), idsSource("middle"), idsSource("last")]
      : [librarySource("1.0"), librarySource("2.0"), librarySource("3.0")];
    const field = kind === "ids" ? "idsImports" : "libraryImports";
    const app = harness(rawFile(null, { [field]: sources }));
    const before = app.save();
    const record = app.records().find(record => record.sourceId === sources[1].id &&
      (kind === "ids" || record.sourceVersion === sources[1].version));
    assert.equal(record.used.length, 0);
    assert.equal(record.retained, 0);

    app.remove(record.key);
    assert.deepEqual(plain(app.project().sourceData[field]), [sources[0], sources[2]]);
    assert.equal(app.effects.notices.at(-1).action, "undo-source-removal");

    app.undo();
    assert.equal(app.save(), before);
    assert.deepEqual(plain(app.project().sourceData[field]), sources);
    assert.equal(app.effects.focused.at(-1), "sources-title");

    app.undo();
    assert.equal(app.save(), before, "Repeating undo cannot duplicate a restored source");
  });
}
