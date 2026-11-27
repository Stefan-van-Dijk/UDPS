const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const fields = vm.runInNewContext(`${readFileSync(path.join(__dirname, "../../web/test/rule-fields.js"), "utf8")}\nUDPSRuleFields;`);
const files = vm.runInNewContext(`${readFileSync(path.join(__dirname, "../../web/test/project-files.js"), "utf8")}\nUDPSProjectFiles;`);
const plain = value => JSON.parse(JSON.stringify(value));
const row = (id = "own", extra = {}) => ({
  id, key: "width", entity: "IfcDoor", propertySet: "Pset_Test", name: "Width", label: "Breedte",
  type: "Length", source: "Voorbeeldconfiguratie", override: null, implicitRevit: false, active: true, ...extra
});
const project = (rows = [row()], extra = {}) => ({ name: "Test", rows, standards: { width: "BASE" }, ...extra });
const libraryUri = "urn:udps:library:qa:1";
const propertyUri = `${libraryUri}:class:door:property:Pset_Test:Width`;
const library = { id: "qa", version: "1", name: "Team QA", fileName: "team.json", uri: libraryUri, library: { format: "udps-library", schema: 1, id: "qa", name: "Team QA", version: "1", classes: [] } };
const docA = "sha256:" + "a".repeat(64);
const docB = "sha256:" + "b".repeat(64);
const idsSource = (id = docA, fileName = "eisen.ids") => ({ schema: 1, id, fileName, xml: "<ids/>", selectedRequirementIds: ["spec:0/requirement:0"] });
const refs = (...ids) => JSON.stringify(ids.map(documentId => ({ documentId, specificationId: "spec:0", requirementId: "spec:0/requirement:0" })));
function rawFile(extra = {}, metadata = {}) {
  const base = { Revit_parameter: "LOCAL", IFC_parameter: "Width", "Y/N": "x", Export_tabblad: "Pset_Test", Data_type: "Length", IfcDoor: "x", ...extra };
  return { version: 1, source: "Oud eigen project", headers: Object.keys(base), rows: [base], ...metadata };
}
const open = data => files.open(JSON.stringify(data), "eigen-project.json");

test("direct own rows and ordinary source labels remain editable", () => {
  for (const source of [undefined, "", "Eigen eigenschap", "Voorbeeldconfiguratie", "Eigen propertyset", "Meegeleverd UDPS-voorbeeldproject", "eigen-project.json", "Een bronachtige naam"]) {
    const current = row("own", { source });
    assert.equal(fields.origin(project([current]), current).linked, false);
    assert.equal(fields.origin(project([current]), current).kind, "own");
  }
});

test("imported own JSON stays own even with a source index and saved uniform metadata", () => {
  const data = open(rawFile({ Uniform_id: "old-width", Uniform_name: "Breedte", Uniform_datatype: "Length", Uniform_revit: "BASE", Source_name: "Eigenschapnaam" }));
  assert.equal(data.rows[0].sourceIndex, 0);
  assert.equal(data.rows[0].source, "Eigenschapnaam");
  assert.equal(fields.origin(data, data.rows[0]).linked, false);
});

test("sourceIndex and unrelated saved sources never manufacture a connection", () => {
  for (const sourceIndex of [0, -1, 100, "0", undefined]) {
    const current = row("own", { sourceIndex });
    const data = project([current], { sourceData: { rows: [], idsImports: [idsSource()], libraryImports: [library] } });
    assert.equal(fields.origin(data, current).linked, false);
  }
});

test("raw Source_uri proves a generic source connection without fabricating navigation", () => {
  const data = open(rawFile({ Source_uri: "https://example.test/property/width" }));
  const result = fields.origin(data, data.rows[0]);
  assert.equal(result.linked, true);
  assert.equal(result.kind, "source");
  assert.equal(result.sourceUri, "https://example.test/property/width");
  assert.equal(result.available, false);
  assert.equal(result.navigation, undefined);
});

test("runtime Source_dictionary and its name identify an external source", () => {
  const current = row("source", { Source_dictionary: "https://example.test/dictionary/1", Source_property_dictionary_name: "Brondataset" });
  const result = fields.origin(project([current]), current);
  assert.equal(result.kind, "source");
  assert.equal(result.label, "Brondataset");
  assert.equal(result.sourceUri, current.Source_dictionary);
});

test("known library source resolves its real id, version, label and navigation", () => {
  const data = open(rawFile({ Mapping_origin: "library", Source_uri: propertyUri, Source_dictionary: libraryUri, Source_version: "1" }, { libraryImports: [library] }));
  const result = fields.origin(data, data.rows[0]);
  assert.equal(result.kind, "library");
  assert.equal(result.sourceId, "qa");
  assert.equal(result.sourceVersion, "1");
  assert.equal(result.sourceUri, libraryUri);
  assert.equal(result.propertyUri, propertyUri);
  assert.equal(result.label, "Bibliotheek · Team QA · 1");
  assert.deepEqual(plain(result.navigation), { action: "library-source", value: '["qa","1"]' });
});

test("library identity can be proven by its exact generated property URI without a dictionary field", () => {
  const current = row("library", { Source_uri: propertyUri });
  const result = fields.origin(project([current], { libraryImports: [library] }), current);
  assert.equal(result.kind, "library");
  assert.equal(result.sourceId, library.id);
  assert.equal(result.available, true);
});

test("missing or mismatched library versions stay protected without pointing to another version", () => {
  for (const imports of [[], [library]]) {
    const current = row("library", { Mapping_origin: "library", Source_dictionary: libraryUri, Source_version: "2" });
    const result = fields.origin(project([current], { sourceData: { libraryImports: imports } }), current);
    assert.equal(result.linked, true);
    assert.equal(result.kind, "library");
    assert.equal(result.sourceVersion, "2");
    assert.equal(result.sourceId, undefined);
    assert.equal(result.available, false);
    assert.equal(result.navigation, undefined);
  }
});

test("an ambiguous saved library identity does not create a navigation target", () => {
  const current = row("library", { Source_dictionary: libraryUri });
  const result = fields.origin(project([current], { libraryImports: [library, { ...library, name: "Ander label" }] }), current);
  assert.equal(result.kind, "library");
  assert.equal(result.available, false);
  assert.equal(result.sourceId, undefined);
  assert.equal(result.navigation, undefined);
});

test("IDS origin resolves every referenced document and deduplicates repeated requirements", () => {
  const data = open(rawFile({ Mapping_origin: "ids", IDS_requirements: refs(docA, docB, docA) }, { idsImports: [idsSource(), idsSource(docB, "aanvullend.ids")] }));
  const result = fields.origin(data, data.rows[0]);
  assert.equal(result.linked, true);
  assert.equal(result.kind, "ids");
  assert.equal(result.origins.length, 2);
  assert.deepEqual(Array.from(result.origins, value => value.sourceId), [docA, docB]);
  assert.deepEqual(Array.from(result.origins, value => plain(value.navigation)), [
    { action: "ids-source", value: docA }, { action: "ids-source", value: docB }
  ]);
  assert.equal(result.sourceId, undefined, "The multi-source summary must not pretend to have one document identity");
});

test("an IDS reference without its source remains protected and retains the known document id", () => {
  const current = row("ids", { IDS_requirements: refs(docA) });
  const result = fields.origin(project([current]), current);
  assert.equal(result.kind, "ids");
  assert.equal(result.sourceId, docA);
  assert.equal(result.available, false);
  assert.equal(result.navigation, undefined);
});

test("corrupt and partially unreadable IDS references never become an own rule", () => {
  for (const value of ["{bad-json", "{}", '[{"documentId":""}]', [{ arbitrary: true }]]) {
    const current = row("ids", { IDS_requirements: value });
    const result = fields.origin(project([current]), current);
    assert.equal(result.linked, true);
    assert.equal(result.kind, "ids");
    assert.equal(result.available, false);
  }
  const current = row("partial", { IDS_requirements: '[{"documentId":"' + docA + '"},{"unknown":"preserve"}]' });
  const result = fields.origin(project([current], { idsImports: [idsSource()] }), current);
  assert.equal(result.origins.length, 2);
  assert(result.origins.some(item => !item.available));
});

test("empty provenance fields or an empty requirement list are not a source connection", () => {
  const data = open(rawFile({ Source_uri: "", Source_dictionary: "  ", Mapping_origin: "", IDS_requirements: "[]" }));
  assert.equal(fields.origin(data, data.rows[0]).linked, false);
});

test("explicit origin markers protect rows even when detailed source context is unavailable", () => {
  for (const [marker, kind] of [["ids", "ids"], ["library", "library"], ["bsdd", "source"], ["unrecognized-origin", "source"]]) {
    const current = row("linked", { Mapping_origin: marker });
    const result = fields.origin(project([current]), current);
    assert.equal(result.linked, true);
    assert.equal(result.kind, kind);
    assert.equal(result.available, false);
  }
});

test("raw and runtime evidence combine without a redundant missing-origin placeholder", () => {
  const current = row("ids", { sourceIndex: 0, Mapping_origin: "ids", IDS_requirements: refs(docB) });
  const data = project([current], { sourceData: { rows: [{ IDS_requirements: refs(docA) }], idsImports: [idsSource(), idsSource(docB, "b.ids")] } });
  const result = fields.origin(data, current);
  assert.deepEqual(Array.from(result.origins, value => value.sourceId), [docB, docA]);
  delete current.IDS_requirements;
  assert.equal(fields.origin(data, current).origins.length, 1);
  assert.equal(fields.origin(data, current).sourceId, docA);
});

test("only the exact direct demo source labels count; imported filenames do not", () => {
  for (const [source, kind] of [["IFC 4.3", "library"], ["Voorbeeld-IDS", "ids"]]) {
    const current = row("demo", { source });
    const result = fields.origin(project([current]), current);
    assert.equal(result.linked, true);
    assert.equal(result.kind, kind);
    assert.equal(result.demo, true);
    assert.equal(result.sourceId, undefined);
    const imported = { ...current, sourceIndex: 0 };
    assert.equal(fields.origin(project([imported], { sourceData: { rows: [{}] } }), imported).linked, false);
  }
});

test("one row can retain library and IDS provenance independently", () => {
  const current = row("both", { Mapping_origin: "library", Source_dictionary: libraryUri, IDS_requirements: refs(docA) });
  const data = project([current], { sourceData: { libraryImports: [library], idsImports: [idsSource()] } });
  const result = fields.origin(data, current);
  assert.deepEqual(Array.from(result.origins, value => value.kind), ["ids", "library"]);
  assert(result.origins.every(value => value.navigation));
});

test("combined own/source rows protect the whole type cell and identify the protected subset", () => {
  const a = row("own", { type: "Length" });
  const b = row("ids", { type: "Real", IDS_requirements: refs(docA) });
  const data = project([a, b], { sourceData: { idsImports: [idsSource()] } });
  const result = fields.info(data, [a, b]);
  assert.equal(result.linked, true);
  assert.equal(result.editable, false);
  assert.equal(result.mixedTypes, true);
  assert.deepEqual(Array.from(result.types), ["Length", "Real"]);
  assert.deepEqual(Array.from(result.protectedIds), ["ids"]);
  assert.deepEqual(Array.from(result.origins, value => value.kind), ["own", "ids"]);
});

test("info deduplicates source records and preserves distinct missing datatype state", () => {
  const rows = [row("a", { type: "", IDS_requirements: refs(docA) }), row("b", { IDS_requirements: refs(docA) })];
  const result = fields.info(project(rows, { idsImports: [idsSource()] }), rows);
  assert.equal(result.origins.length, 1);
  assert.deepEqual(Array.from(result.types), ["", "Length"]);
  assert.equal(result.mixedTypes, true);
  assert.equal(fields.info(project([]), []).editable, false);
});

test("different unknown origin markers retain their distinct labels without fabricated identities", () => {
  const rows = [row("a", { Mapping_origin: "unknown-a" }), row("b", { Mapping_origin: "unknown-b" })];
  const result = fields.info(project(rows), rows);
  assert.deepEqual(Array.from(result.origins, value => value.label), ["Bron · unknown-a", "Bron · unknown-b"]);
  assert(result.origins.every(value => value.linked && !value.sourceId && !value.navigation));
});

test("own type changes clone only selected rows and preserve all unrelated data opaquely", () => {
  const a = row("a", { active: false, implicitRevit: true, override: "LOCAL", sourceIndex: 0, classification: "A", custom: { preserve: true } });
  const b = row("b", { type: "Text" });
  const sourceData = { rows: [{ Custom_note: "unchanged" }], idsImports: [idsSource()], extra: { retain: true } };
  const data = project([a, b], { sourceData, removedSourceIndices: [3], arbitraryMetadata: { extra: "keep" } });
  const before = plain(data);
  const next = fields.changeType(data, ["a"], "Real", ["Length", "Real"]);
  assert.notEqual(next, data);
  assert.notEqual(next.rows, data.rows);
  assert.notEqual(next.rows[0], a);
  assert.equal(next.rows[1], b);
  assert.equal(next.sourceData, sourceData);
  assert.equal(next.standards, data.standards);
  assert.equal(next.removedSourceIndices, data.removedSourceIndices);
  assert.equal(next.arbitraryMetadata, data.arbitraryMetadata);
  assert.equal(next.rows[0].custom, a.custom);
  assert.deepEqual(plain(next.rows[0]), { ...plain(a), type: "Real" });
  assert.deepEqual(plain(data), before);
});

test("allowed type codes work through arrays, Sets and code-to-label dictionaries", () => {
  const data = project();
  for (const allowed of [["Length", "Real"], new Set(["Length", "Real"]), { Length: "Lengte", Real: "Getal" }]) {
    assert.equal(fields.changeType(data, new Set(["own"]), "Real", allowed).rows[0].type, "Real");
  }
  for (const type of ["Getal", "Unknown", " Real", "Real ", "", null, 12]) {
    assert.throws(() => fields.changeType(data, ["own"], type, { Real: "Getal" }), /ondersteund UDPS-datatype/);
  }
  assert.throws(() => fields.changeType(data, ["own"], "Real", "Real"), /ondersteund/);
});

test("a mixed selection is rejected atomically while an independent own selection still works", () => {
  const data = project([row("own"), row("linked", { Source_uri: "https://example.test/property/1" })]);
  const before = plain(data);
  assert.throws(() => fields.changeType(data, ["own", "linked"], "Real", ["Real"]), /brongebonden/);
  assert.deepEqual(plain(data), before);
  const ownOnly = fields.changeType(data, ["own"], "Real", ["Real"]);
  assert.equal(ownOnly.rows[0].type, "Real");
  assert.equal(ownOnly.rows[1], data.rows[1]);
});

test("every protected origin blocks a type edit even if the row is inactive or implicit", () => {
  for (const provenance of [{ Source_dictionary: libraryUri }, { Mapping_origin: "ids" }, { IDS_requirements: "invalid" }, { source: "IFC 4.3" }, { Mapping_origin: "unrecognized" }]) {
    const current = row("linked", { active: false, implicitRevit: true, override: "", ...provenance });
    assert.throws(() => fields.changeType(project([current]), ["linked"], "Real", ["Real"]), /brongebonden/);
  }
});

test("selection validation rejects missing, ambiguous or invalid ids without changes", () => {
  const data = project();
  const before = plain(data);
  for (const ids of [[], "own", null, ["missing"], ["own", "missing"], [1], [""]]) {
    assert.throws(() => fields.changeType(data, ids, "Real", ["Real"]), /eenduidige bestaande toepassingen/);
  }
  const ambiguous = project([row("same"), row("same")]);
  assert.throws(() => fields.changeType(ambiguous, ["same"], "Real", ["Real"]), /eenduidige/);
  assert.deepEqual(plain(data), before);
});

test("an imported own type change survives adapter save/open with local state and explicit standard intact", () => {
  const raw = rawFile({ Uniform_id: "own-width", Uniform_revit: "", Uniform_datatype: "Length", Custom_note: "retain", Classification: "A", Mapping_pending: "x", Revit_parameter: "" });
  const data = open(raw);
  const current = data.rows[0];
  const next = fields.changeType(data, [current.id], "Real", { Length: "Lengte", Real: "Getal" });
  const saved = JSON.parse(files.save(next));
  assert.equal(saved.rows[0].Data_type, "Real");
  assert.equal(saved.rows[0].Custom_note, "retain");
  assert.equal(saved.rows[0].Uniform_id, "own-width");
  assert.equal(saved.rows[0].Uniform_revit, "");
  assert.equal(saved.rows[0].Mapping_pending, "x");
  const restored = files.open(JSON.stringify(saved), "saved.json");
  assert.equal(restored.rows[0].type, "Real");
  assert.equal(fields.origin(restored, restored.rows[0]).linked, false);
  assert.equal(restored.standards[restored.rows[0].key], "");
});

test("source metadata and every linked field survive an independent own edit and adapter roundtrip", () => {
  const raw = rawFile({ Mapping_origin: "library", Source_uri: propertyUri, Source_dictionary: libraryUri, Source_version: "1", Source_contexts: '[{"opaque":true}]', IDS_requirements: refs(docA) }, { libraryImports: [library], idsImports: [idsSource()] });
  const data = open(raw);
  data.rows.push(row("new-own", { key: "new-own", type: "Text" }));
  const next = fields.changeType(data, ["new-own"], "Real", ["Real"]);
  const saved = JSON.parse(files.save(next));
  assert.deepEqual(saved.libraryImports, raw.libraryImports);
  assert.deepEqual(saved.idsImports, raw.idsImports);
  const linked = saved.rows.find(item => item.Source_uri === propertyUri);
  for (const key of ["Mapping_origin", "Source_uri", "Source_dictionary", "Source_version", "Source_contexts", "IDS_requirements"]) assert.equal(linked[key], raw.rows[0][key]);
  const restored = files.open(JSON.stringify(saved), "saved.json");
  assert.equal(fields.origin(restored, restored.rows.find(item => item.sourceIndex === 0)).linked, true);
});

test("missing raw context does not erase explicit runtime provenance or invent a false source", () => {
  const linked = row("linked", { sourceIndex: 100, Source_uri: "https://example.test/property/1" });
  const own = row("own", { sourceIndex: 100, source: "project.json" });
  const data = project([linked, own], { sourceData: { rows: [] } });
  assert.equal(fields.origin(data, linked).linked, true);
  assert.equal(fields.origin(data, own).linked, false);
  assert.equal(fields.changeType(data, ["own"], "Real", ["Real"]).rows[1].type, "Real");
});
