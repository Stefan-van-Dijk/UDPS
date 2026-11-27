const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../../web/test/mapping-rows.js"), "utf8");
const model = vm.runInNewContext(`${source}\nUDPSMappingRows;`);
const adapterSource = readFileSync(path.join(__dirname, "../../web/test/project-files.js"), "utf8");
const files = vm.runInNewContext(`${adapterSource}\nUDPSProjectFiles;`);
const plain = value => JSON.parse(JSON.stringify(value));
const ids = rows => Array.from(rows, row => row.id);
const rowId = (propertySet, name, kind, parameter) => JSON.stringify([propertySet, name, kind, parameter]);

function application(id, fields = {}) {
  return {
    id, key: "width", propertySet: "Pset_Test", name: "Width", entity: "IfcDoor", type: "Length",
    override: null, implicitRevit: false, active: true, ...fields
  };
}

function project(rows, standards = { width: "BASE" }) {
  return { rows, standards };
}

test("one exact property/parameter combination forms one row, with standard before local variants", () => {
  const rows = [
    application("window-local", { entity: "IfcWindow", override: "WINDOW_WIDTH" }),
    application("wall-base", { entity: "IfcWall" }),
    application("door-base")
  ];
  const groups = model.build(project(rows));
  assert.deepEqual(Array.from(groups, group => group.parameter), ["BASE", "WINDOW_WIDTH"]);
  assert.equal(groups[0].id, rowId("Pset_Test", "Width", "named", "BASE"));
  assert.equal(groups[0].familyId, JSON.stringify(["Pset_Test", "Width"]));
  assert.equal(groups[0].isStandard, true);
  assert.deepEqual(Array.from(groups[0].baseKeys), ["width"]);
  assert.deepEqual(ids(groups[0].applications), ["wall-base", "door-base"]);
  assert.equal(groups[1].isStandard, false);
  assert.deepEqual(ids(groups[1].applications), ["window-local"]);
  assert.equal(groups[1].familyApplications.length, 3);
});

test("a shared source key can span separate real propertysets and renamed IFC properties", () => {
  const rows = [
    application("a-width"),
    application("b-depth", { propertySet: "Pset_Local", name: "Depth" }),
    application("a-height", { name: "Height" }),
    application("a-width-window", { entity: "IfcWindow" })
  ];
  const groups = model.build(project(rows));
  assert.deepEqual(Array.from(groups, group => [group.propertySet, group.name]), [
    ["Pset_Test", "Width"], ["Pset_Test", "Height"], ["Pset_Local", "Depth"]
  ]);
  assert.equal(new Set(Array.from(groups, group => group.familyId)).size, 3);
  assert.deepEqual(ids(groups[0].applications), ["a-width", "a-width-window"]);
});

test("matching local combinations merge visually across keys while every actual central standard survives", () => {
  const a = application("a", { key: "source-a", override: "LOCAL", type: "Length", source: "A" });
  const b = application("b", { key: "source-b", entity: "IfcWindow", override: "LOCAL", type: "Real", source: "B" });
  const groups = model.build(project([a, b], { "source-a": "BASE_A", "source-b": "BASE_B" }));
  assert.deepEqual(Array.from(groups, group => [group.parameter, group.isStandard]), [
    ["BASE_A", true], ["BASE_B", true], ["LOCAL", false]
  ]);
  assert.deepEqual(Array.from(groups[0].baseKeys), ["source-a"]);
  assert.deepEqual(Array.from(groups[1].baseKeys), ["source-b"]);
  assert.equal(groups[0].applications.length, 0);
  assert.equal(groups[0].allApplications.length, 0);
  assert.equal(groups[0].sourceKeys.length, 0);
  assert.equal(groups[0].representative, a);
  assert.deepEqual(Array.from(groups[2].sourceKeys), ["source-a", "source-b"]);
  assert.deepEqual(ids(groups[2].allApplications), ["a", "b"]);
  assert.deepEqual(Array.from(groups[2].allApplications, row => row.type), ["Length", "Real"]);
  assert.deepEqual(Array.from(groups[2].allApplications, row => row.source), ["A", "B"]);
});

test("one combination may be a standard for one key and a local value for another", () => {
  const rows = [
    application("a-base", { key: "a" }),
    application("a-local", { key: "a", entity: "IfcWall", override: "OTHER" }),
    application("b-base", { key: "b", entity: "IfcWindow" })
  ];
  const groups = model.build(project(rows, { a: "BASE", b: "OTHER" }));
  assert.equal(groups.length, 2);
  assert.equal(groups[1].isStandard, true);
  assert.deepEqual(Array.from(groups[1].baseKeys), ["b"]);
  assert.deepEqual(Array.from(groups[1].sourceKeys), ["a", "b"]);
  assert.deepEqual(ids(groups[1].applications), ["a-local", "b-base"]);
});

test("an all-local family retains a context-only standard anchor with a real representative", () => {
  const local = application("local", { override: "LOCAL" });
  const groups = model.build(project([local]));
  assert.equal(groups.length, 2);
  assert.equal(groups[0].parameter, "BASE");
  assert.equal(groups[0].isStandard, true);
  assert.equal(groups[0].representative, local);
  assert.deepEqual(ids(groups[0].applications), []);
  assert.deepEqual(ids(groups[0].allApplications), []);
  assert.deepEqual(ids(groups[0].familyApplications), ["local"]);
});

test("implicit IFC-name mappings remain distinct from explicit missing mappings, including a mixed key", () => {
  const implicit = application("implicit", { implicitRevit: true });
  const missing = application("pending", { entity: "IfcWindow" });
  const groups = model.build(project([implicit, missing], { width: "" }));
  assert.equal(groups.length, 2);
  assert.deepEqual(Array.from(groups, group => [group.parameterKind, group.parameter, group.isStandard]), [
    ["implicit", "", true], ["missing", "", true]
  ]);
  assert.notEqual(groups[0].id, groups[1].id);
  assert.deepEqual(Array.from(groups[0].baseKeys), ["width"]);
  assert.deepEqual(Array.from(groups[1].baseKeys), ["width"]);
  assert.deepEqual(ids(groups[0].applications), ["implicit"]);
  assert.deepEqual(ids(groups[1].applications), ["pending"]);
});

test("an implicit empty baseline remains as context after its application gets a named local value", () => {
  const local = application("local", { override: "LOCAL", implicitRevit: true });
  const groups = model.build(project([local], { width: "" }));
  assert.deepEqual(Array.from(groups, group => [group.parameterKind, group.parameter]), [["implicit", ""], ["named", "LOCAL"]]);
  assert.equal(groups[0].applications.length, 0);
  assert.equal(groups[1].isStandard, false);
});

test("filtering preserves full family context and stable IDs without leaking hidden applications into actions", () => {
  const rows = [
    application("base"),
    application("local", { entity: "IfcWindow", override: "LOCAL" }),
    application("other-local", { entity: "IfcWall", override: "HIDDEN" }),
    application("other-family", { propertySet: "Pset_Other" })
  ];
  const data = project(rows);
  const full = model.build(data);
  const groups = model.build(data, { visibleIds: new Set(["local"]) });
  assert.deepEqual(Array.from(groups, group => group.parameter), ["BASE", "LOCAL"]);
  assert.deepEqual(ids(groups[0].applications), []);
  assert.deepEqual(ids(groups[0].allApplications), ["base"]);
  assert.deepEqual(ids(groups[1].applications), ["local"]);
  assert.deepEqual(ids(groups[1].familyApplications), ["base", "local", "other-local"]);
  assert.equal(groups[1].id, full.find(group => group.parameter === "LOCAL").id);
  assert.equal(model.build(data, { visibleIds: [] }).length, 0);
  assert.equal(model.build(data, { visibleIds: ["unknown"] }).length, 0);
});

test("duplicate entity applications, datatypes, activity and source identities are never discarded", () => {
  const a = application("duplicate-a", { key: "a", sourceIndex: 0 });
  const b = application("duplicate-b", { key: "b", type: "Real", active: false, sourceIndex: 1 });
  const groups = model.build(project([a, b], { a: "BASE", b: "BASE" }));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].applications.length, 2);
  assert.equal(groups[0].applications[0], a);
  assert.equal(groups[0].applications[1], b);
  assert.deepEqual(Array.from(groups[0].baseKeys), ["a", "b"]);
  assert.deepEqual(Array.from(groups[0].sourceKeys), ["a", "b"]);
  assert.deepEqual(Array.from(groups[0].applications, row => [row.entity, row.type, row.active, row.sourceIndex]), [
    ["IfcDoor", "Length", true, 0], ["IfcDoor", "Real", false, 1]
  ]);
});

test("identities preserve exact names, case and whitespace rather than normalizing separate combinations", () => {
  const rows = [
    application("normal"),
    application("case", { override: "base" }),
    application("space", { override: " BASE" }),
    application("lower-name", { name: "width" }),
    application("lower-set", { propertySet: "pset_test" })
  ];
  const groups = model.build(project(rows));
  assert.equal(groups.length, 5);
  assert.equal(new Set(Array.from(groups, group => group.id)).size, 5);
  assert.equal(groups.find(group => group.applications.some(row => row.id === "space")).parameter, " BASE");
});

test("the adapter parameter callback is used with the original project and an explicit empty override stays missing", () => {
  const rows = [application("base"), application("empty", { entity: "IfcWindow", override: "" })];
  const data = project(rows);
  let calls = 0;
  const groups = model.build(data, { parameterOf(actualProject, row) {
    assert.equal(actualProject, data);
    calls += 1;
    return files.parameterOf(actualProject, row);
  } });
  assert.equal(calls, 2);
  assert.deepEqual(Array.from(groups, group => [group.parameterKind, group.parameter]), [["named", "BASE"], ["missing", ""]]);
  assert.deepEqual(ids(groups[1].applications), ["empty"]);
});

test("build does not mutate frozen project records, standards, metadata or visibility", () => {
  const a = Object.freeze(application("base"));
  const b = Object.freeze(application("local", { entity: "IfcWindow", override: "LOCAL" }));
  const data = Object.freeze({
    rows: Object.freeze([a, b]), standards: Object.freeze({ width: "BASE" }),
    sourceData: Object.freeze({ custom: "retain" })
  });
  const visibleIds = Object.freeze(["local"]);
  const before = JSON.stringify(data);
  const groups = model.build(data, { visibleIds });
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(visibleIds, ["local"]);
  assert.equal(groups[1].applications[0], b);
  assert.equal(groups[1].familyApplications[0], a);
});

test("adapter save/reopen preserves named combination membership across imported source identities", () => {
  const raw = {
    version: 1,
    headers: ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "Uniform_id", "Uniform_revit", "IfcDoor", "IfcWindow"],
    rows: [
      { Revit_parameter: "BASE", IFC_parameter: "Width", "Y/N": "x", Export_tabblad: "Pset_Test", Data_type: "Length", Uniform_id: "source-a", Uniform_revit: "BASE", IfcDoor: "x" },
      { Revit_parameter: "LOCAL", IFC_parameter: "Width", "Y/N": "x", Export_tabblad: "Pset_Test", Data_type: "Real", Uniform_id: "source-b", Uniform_revit: "BASE", IfcWindow: "x" }
    ]
  };
  const opened = files.open(JSON.stringify(raw), "project.json");
  const shape = data => plain(model.build(data, { parameterOf: files.parameterOf }).map(group => ({
    id: group.id, parameter: group.parameter, kind: group.parameterKind, baseKeys: group.baseKeys,
    sourceKeys: group.sourceKeys, cells: group.applications.map(row => [row.entity, row.type, row.active])
  })));
  assert.deepEqual(shape(files.open(files.save(opened), "saved.json")), shape(opened));
});

test("an empty project has no synthetic properties or anchors", () => {
  assert.equal(model.build({ rows: [], standards: {} }).length, 0);
});

test("changeParameter compares each selected application with its own central standard", () => {
  const a = application("a", { key: "source-a", override: "LOCAL_A" });
  const b = application("b", { key: "source-b", override: "LOCAL_B", entity: "IfcWindow" });
  const unselected = application("untouched", { key: "source-c", override: "X".repeat(501) });
  const data = {
    ...project([a, b, unselected], { "source-a": "BASE", "source-b": "OTHER", "source-c": "C" }),
    sourceData: { libraryImports: [{ id: "library", version: "1" }], rows: [{ Custom_note: "retain" }] },
    workspaceExtension: { keep: true }
  };
  const before = JSON.stringify(data);
  const changed = model.changeParameter(data, ["a", "b"], " BASE ");
  assert.notEqual(changed, data);
  assert.notEqual(changed.rows, data.rows);
  assert.notEqual(changed.rows[0], a);
  assert.notEqual(changed.rows[1], b);
  assert.equal(changed.rows[2], unselected);
  assert.equal(changed.rows[0].override, null);
  assert.equal(changed.rows[1].override, "BASE");
  assert.deepEqual(Array.from(changed.rows.slice(0, 2), row => files.parameterOf(changed, row)), ["BASE", "BASE"]);
  assert.equal(changed.standards, data.standards);
  assert.equal(changed.sourceData, data.sourceData);
  assert.equal(changed.workspaceExtension, data.workspaceExtension);
  assert.equal(JSON.stringify(data), before);
});

test("reset only clears overrides while preserving implicit, pending and source metadata", () => {
  const implicit = application("implicit", { override: "LOCAL", implicitRevit: true, sourceIndex: 3, classification: "Class A" });
  const pending = application("pending", { override: "LOCAL", entity: "IfcWindow", implicitRevit: false, sourceIndex: 4 });
  const data = project([implicit, pending], { width: "" });
  const reset = model.changeParameter(data, new Set(["implicit", "pending"]), null);
  assert.deepEqual(Array.from(reset.rows, row => row.override), [null, null]);
  assert.deepEqual(Array.from(reset.rows, row => [row.implicitRevit, row.sourceIndex]), [[true, 3], [false, 4]]);
  assert.equal(reset.rows[0].classification, "Class A");
  assert.equal(reset.standards, data.standards);
  assert.deepEqual(Array.from(model.build(reset), group => group.parameterKind), ["implicit", "missing"]);
  assert.equal(implicit.override, "LOCAL");
  assert.equal(pending.override, "LOCAL");
});

test("empty and unknown selections reject atomically without changing any project record", () => {
  const row = Object.freeze(application("known", { override: "ORIGINAL" }));
  const data = Object.freeze({ rows: Object.freeze([row]), standards: Object.freeze({ width: "BASE" }) });
  for (const selection of [[], ["unknown"], ["known", "unknown"], undefined, "known"]) {
    const before = JSON.stringify(data);
    assert.throws(() => model.changeParameter(data, selection, "NEW"), /bestaande toepassingen/);
    assert.equal(JSON.stringify(data), before);
    assert.equal(data.rows[0], row);
  }
});

test("invalid replacement parameters reject atomically while old long values can remain unchanged", () => {
  const data = project([application("selected"), application("old-long", { override: "X".repeat(501) })]);
  const before = JSON.stringify(data);
  for (const value of ["", "   ", "A\tB", "A\nB", "A\rB", "X".repeat(501), undefined, 123]) {
    assert.throws(() => model.changeParameter(data, ["selected"], value), /500 tekens/);
    assert.equal(JSON.stringify(data), before);
  }
  const valid = model.changeParameter(data, ["selected"], "X".repeat(500));
  assert.equal(valid.rows[0].override.length, 500);
  assert.equal(valid.rows[1], data.rows[1]);
  assert.equal(valid.rows[1].override.length, 501);
});

test("changed and reset multi-key mappings survive adapter save/open with central and source records intact", () => {
  const raw = {
    version: 1, libraryImports: [{ id: "source-library", version: "2", library: { license: "MIT" } }],
    headers: ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", "Uniform_id", "Uniform_revit", "Custom_note", "IfcDoor", "IfcWindow"],
    rows: [
      { Revit_parameter: "LOCAL_A", IFC_parameter: "Width", "Y/N": "x", Export_tabblad: "Pset_Test", Data_type: "Length", Uniform_id: "source-a", Uniform_revit: "BASE", Custom_note: "A", IfcDoor: "x" },
      { Revit_parameter: "LOCAL_B", IFC_parameter: "Width", "Y/N": "x", Export_tabblad: "Pset_Test", Data_type: "Real", Uniform_id: "source-b", Uniform_revit: "OTHER", Custom_note: "B", IfcWindow: "x" }
    ]
  };
  const opened = files.open(JSON.stringify(raw), "project.json");
  const changed = model.changeParameter(opened, ids(opened.rows), "BASE");
  const saved = files.open(files.save(changed), "changed.json");
  const byEntity = data => Object.fromEntries(Array.from(data.rows, row => [row.entity, files.parameterOf(data, row)]));
  assert.deepEqual(byEntity(saved), { IfcDoor: "BASE", IfcWindow: "BASE" });
  assert.equal(saved.standards["udps:source-a"], "BASE");
  assert.equal(saved.standards["udps:source-b"], "OTHER");
  const reset = model.changeParameter(saved, ids(saved.rows), null);
  const restored = files.open(files.save(reset), "reset.json");
  assert.deepEqual(byEntity(restored), { IfcDoor: "BASE", IfcWindow: "OTHER" });
  assert.deepEqual(plain(restored.sourceData.libraryImports), raw.libraryImports);
  assert.deepEqual(Array.from(restored.sourceData.rows, row => row.Custom_note), ["A", "B"]);
  assert.equal(opened.rows[0].override, "LOCAL_A");
  assert.equal(opened.rows[1].override, "LOCAL_B");
});
