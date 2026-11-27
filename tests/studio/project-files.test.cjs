const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const adapterSource = readFileSync(path.join(__dirname, "../../web/test/project-files.js"), "utf8");
const files = vm.runInNewContext(`${adapterSource}\nUDPSProjectFiles;`);

function legacyFile({ datatype = "", entities = ["IfcDoor"] } = {}) {
  return {
    headers: ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type", ...entities],
    rows: [{
      Revit_parameter: "BASE",
      IFC_parameter: "Width",
      "Y/N": "x",
      Export_tabblad: "Pset_Test",
      Data_type: datatype,
      ...Object.fromEntries(entities.map(entity => [entity, "x"]))
    }]
  };
}

function open(data) {
  return files.open(JSON.stringify(data), "project.json");
}

function reopen(project) {
  return files.open(files.save(project), "saved-project.json");
}

function centralStandard(project) {
  const standards = Object.values(project.standards);
  assert.equal(standards.length, 1, "The fixture must remain one central property group");
  return standards[0];
}

function parametersByEntity(project) {
  return Object.fromEntries(Array.from(project.rows, row => [row.entity, files.parameterOf(project, row)]));
}

test("legacy electric datatype aliases export Revit codes without rewriting stored source values", () => {
  for (const [stored, expected] of [["ElectricalCurrent", "ElectricCurrent"], ["ElectricalVoltage", "ElectricVoltage"], ["ElectricCurrent", "ElectricCurrent"], ["Label", "Label"], ["toString", "toString"], ["constructor", "constructor"], ["__proto__", "__proto__"]]) {
    const project = open(legacyFile({ datatype: stored }));
    const before = files.save(project);
    assert.ok(files.exportText(project).includes(`\tWidth\t${expected}\tBASE`));
    assert.equal(files.save(project), before);
    assert.equal(reopen(project).rows[0].type, stored);
  }
});

function explicitStandardFile(standard) {
  const data = legacyFile();
  data.headers.push("Uniform_revit", "Uniform_datatype");
  Object.assign(data.rows[0], {
    Revit_parameter: "LOCAL",
    Uniform_revit: standard,
    Uniform_datatype: ""
  });
  return data;
}

test("a local edit survives save/reopen without replacing an inferred central standard when datatype is empty", () => {
  const project = open(legacyFile());
  assert.equal(centralStandard(project), "BASE");

  project.rows[0].override = "LOCAL";
  assert.equal(centralStandard(project), "BASE");

  const restored = reopen(project);
  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "LOCAL" });
});

test("a local edit of one entity preserves the central standard and the other entity when datatype is empty", () => {
  const project = open(legacyFile({ entities: ["IfcDoor", "IfcWindow"] }));
  assert.equal(centralStandard(project), "BASE");

  project.rows.find(row => row.entity === "IfcWindow").override = "LOCAL";
  assert.deepEqual(parametersByEntity(project), { IfcDoor: "BASE", IfcWindow: "LOCAL" });

  const restored = reopen(project);
  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "BASE", IfcWindow: "LOCAL" });
});

test("an explicit Uniform_revit standard is respected even when Uniform_datatype is empty", () => {
  const project = open(explicitStandardFile("BASE"));

  assert.equal(centralStandard(project), "BASE");
  assert.deepEqual(parametersByEntity(project), { IfcDoor: "LOCAL" });
  assert.equal(project.rows[0].override, "LOCAL");

  const restored = reopen(project);
  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "LOCAL" });
});

test("an explicitly empty Uniform_revit remains empty instead of becoming the local parameter", () => {
  const project = open(explicitStandardFile(""));

  assert.equal(centralStandard(project), "");
  assert.deepEqual(parametersByEntity(project), { IfcDoor: "LOCAL" });
  assert.equal(project.rows[0].override, "LOCAL");

  const restored = reopen(project);
  assert.equal(centralStandard(restored), "");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "LOCAL" });
});

test("legacy imports with a normal datatype retain inferred standards and local edits across save/reopen", () => {
  const project = open(legacyFile({ datatype: "Length", entities: ["IfcDoor", "IfcWindow"] }));
  assert.equal(centralStandard(project), "BASE");
  assert.deepEqual(parametersByEntity(project), { IfcDoor: "BASE", IfcWindow: "BASE" });

  project.rows.find(row => row.entity === "IfcWindow").override = "LOCAL";
  const restored = reopen(project);

  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "BASE", IfcWindow: "LOCAL" });
  assert.ok(restored.rows.every(row => row.type === "Length" && row.active));
});

test("a declared Uniform_revit column with no row property retains legacy standard inference", () => {
  const data = legacyFile({ datatype: "Length" });
  data.headers.push("Uniform_revit");
  assert.equal(Object.hasOwn(data.rows[0], "Uniform_revit"), false);

  const project = open(data);
  assert.equal(centralStandard(project), "BASE");
  assert.equal(project.rows[0].override, null);
  assert.deepEqual(parametersByEntity(project), { IfcDoor: "BASE" });

  project.rows[0].override = "LOCAL";
  const restored = reopen(project);
  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "LOCAL" });
});

test("a row's undeclared Uniform_revit field is ignored like other undeclared fields", () => {
  const data = legacyFile({ datatype: "Length" });
  data.rows[0].Uniform_revit = "UNDECLARED";
  assert.equal(data.headers.includes("Uniform_revit"), false);

  const project = open(data);
  assert.equal(centralStandard(project), "BASE");
  assert.equal(project.rows[0].override, null);
  assert.deepEqual(parametersByEntity(project), { IfcDoor: "BASE" });

  const saved = JSON.parse(files.save(project));
  assert.equal(saved.rows[0].Uniform_revit, "BASE");
  const restored = open(saved);
  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "BASE" });
});

function sourceFixture({ entities = ["IfcDoor"], includeUnmapped = false } = {}) {
  const data = legacyFile({ datatype: "Length", entities });
  data.headers.push("Source_contexts", "Custom_note");
  data.rows[0].Source_contexts = '[{"source":"urn:test:width","version":"2"}]';
  data.rows[0].Custom_note = "Keep the source evidence";
  data.customExtension = { owner: "test", versions: [1, 2] };
  if (includeUnmapped) data.rows.push({
    Revit_parameter: "UNMAPPED", IFC_parameter: "Unmapped source definition", "Y/N": "",
    Export_tabblad: "Pset_SourceOnly", Data_type: "Text", Custom_note: "This row has no IFC application"
  });
  return data;
}

test("removing the last imported application returns a new project without changing metadata or input", () => {
  const project = open(sourceFixture());
  project.workspaceExtension = { selectedSource: "urn:test:width" };
  const before = JSON.stringify(project);
  const result = files.removeApplications(project, [project.rows[0].id]);

  assert.notEqual(result, project);
  assert.equal(JSON.stringify(project), before, "Removal must not mutate the caller's project");
  assert.equal(result.rows.length, 0);
  assert.deepEqual(Array.from(result.removedSourceIndices), [0]);
  for (const field of ["sourceData", "standards", "workspaceExtension"]) {
    assert.equal(JSON.stringify(result[field]), JSON.stringify(project[field]));
  }
});

test("a removed imported application does not revive on save/reopen, while an unseen source row survives", () => {
  const project = open(sourceFixture({ includeUnmapped: true }));
  assert.equal(project.rows.length, 1);
  assert.equal(project.sourceData.rows.length, 2);
  const removed = { ...project, rows: [], removedSourceIndices: [0] };
  const saved = JSON.parse(files.save(removed));

  assert.equal(saved.rows.length, 1);
  assert.equal(saved.rows[0].IFC_parameter, "Unmapped source definition");
  assert.equal(saved.rows[0].Custom_note, "This row has no IFC application");
  assert.deepEqual(saved.customExtension, { owner: "test", versions: [1, 2] });
  const restored = open(saved);
  assert.equal(restored.rows.length, 0, "The deleted application must remain absent");
  assert.equal(restored.sourceData.rows.length, 1, "Unrepresented source records are not deletions");
});

test("removing one imported application keeps the other entity, standard and local value across save/reopen", () => {
  const project = open(sourceFixture({ entities: ["IfcDoor", "IfcWindow"] }));
  project.rows.find(row => row.entity === "IfcWindow").override = "WINDOW_LOCAL";
  const door = project.rows.find(row => row.entity === "IfcDoor");
  const removed = files.removeApplications(project, [door.id]);

  assert.deepEqual(Array.from(removed.removedSourceIndices), []);
  const saved = JSON.parse(files.save(removed));
  assert.equal(saved.rows.length, 1);
  assert.equal(saved.rows[0].IfcDoor, "");
  assert.equal(saved.rows[0].IfcWindow, "x");
  assert.equal(saved.rows[0].Custom_note, "Keep the source evidence");
  assert.equal(saved.rows[0].Source_contexts, project.sourceData.rows[0].Source_contexts);
  const restored = open(saved);
  assert.equal(centralStandard(restored), "BASE");
  assert.deepEqual(parametersByEntity(restored), { IfcWindow: "WINDOW_LOCAL" });

  const removedLast = files.removeApplications(removed, [removed.rows[0].id]);
  assert.deepEqual(Array.from(removedLast.removedSourceIndices), [0]);
  assert.equal(reopen(removedLast).rows.length, 0);
});

test("consecutive removals keep earlier source deletions without deleting unrelated imported applications", () => {
  const data = sourceFixture({ entities: ["IfcDoor", "IfcWindow"] });
  data.rows[0].IfcWindow = "";
  data.rows.push({ ...data.rows[0], IFC_parameter: "Height", IfcDoor: "", IfcWindow: "x" });
  const project = open(data);
  const first = files.removeApplications(project, [project.rows[0].id]);
  assert.deepEqual(Array.from(first.removedSourceIndices), [0]);
  assert.equal(reopen(first).rows[0].name, "Height");
  const second = files.removeApplications(first, [first.rows[0].id, "unknown-id"]);
  assert.deepEqual(Array.from(second.removedSourceIndices), [0, 1]);
  assert.equal(reopen(second).rows.length, 0);
  assert.deepEqual(Array.from(first.removedSourceIndices), [0], "Later removal must not mutate earlier state");
});

test("removing a new application or unknown IDs does not mark unrelated source rows as deleted", () => {
  const project = open(sourceFixture({ includeUnmapped: true }));
  project.rows.push({ ...project.rows[0], id: "own-height", key: "own-height", entity: "IfcWall", sourceIndex: undefined });
  project.standards["own-height"] = "HEIGHT";
  const removed = files.removeApplications(project, new Set(["own-height", "does-not-exist"]));

  assert.deepEqual(Array.from(removed.removedSourceIndices), []);
  assert.equal(removed.rows.length, 1);
  assert.deepEqual(parametersByEntity(reopen(removed)), { IfcDoor: "BASE" });
  assert.equal(JSON.parse(files.save(removed)).rows.length, 2, "Both original source records remain");
});

test("undo can restore removed records, source indices and local values without losing source metadata", () => {
  const project = open(sourceFixture({ entities: ["IfcDoor", "IfcWindow"], includeUnmapped: true }));
  project.rows.find(row => row.entity === "IfcWindow").override = "WINDOW_LOCAL";
  const records = Array.from(project.rows, (row, index) => ({ row, index }));
  const removed = files.removeApplications(project, records.map(record => record.row.id));
  assert.equal(reopen(removed).rows.length, 0);

  // The UI owns undo records and restores its previous deletion markers.
  const undone = { ...removed, rows: Array.from(removed.rows), removedSourceIndices: [] };
  for (const { row, index } of records) undone.rows.splice(index, 0, row);
  assert.equal(JSON.stringify(undone.rows), JSON.stringify(project.rows));
  assert.equal(JSON.stringify(undone.standards), JSON.stringify(project.standards));
  const restored = reopen(undone);
  assert.deepEqual(parametersByEntity(restored), { IfcDoor: "BASE", IfcWindow: "WINDOW_LOCAL" });
  assert.equal(restored.standards[restored.rows[0].key], "BASE");
  assert.equal(restored.sourceData.rows.find(row => row.IFC_parameter === "Width").Custom_note, "Keep the source evidence");
  assert.equal(restored.sourceData.rows.find(row => row.IFC_parameter === "Unmapped source definition").Custom_note, "This row has no IFC application");
  assert.equal(JSON.stringify(restored.sourceData.customExtension), JSON.stringify(project.sourceData.customExtension));
});

test("local IFC target edits survive save/reopen while explicit central IFC defaults stay independent", () => {
  const data = sourceFixture({ entities: ["IfcDoor", "IfcWindow"] });
  data.headers.push("Uniform_id", "Uniform_revit", "Uniform_property", "Uniform_propertyset", "Uniform_datatype");
  Object.assign(data.rows[0], { Uniform_id: "central-width", Uniform_revit: "BASE", Uniform_property: "Width", Uniform_propertyset: "Pset_Test", Uniform_datatype: "Length" });
  const project = open(data);
  Object.assign(project.rows.find(row => row.entity === "IfcWindow"), { name: "Depth", propertySet: "Pset_WindowLocal", type: "Real" });

  const saved = JSON.parse(files.save(project));
  const local = saved.rows.find(row => row.IfcWindow === "x");
  assert.equal(local.IFC_parameter, "Depth");
  assert.equal(local.Export_tabblad, "Pset_WindowLocal");
  assert.equal(local.Data_type, "Real");
  for (const row of saved.rows) {
    assert.equal(row.Uniform_property, "Width");
    assert.equal(row.Uniform_propertyset, "Pset_Test");
    assert.equal(row.Uniform_datatype, "Length");
  }
  const restored = open(saved);
  const restoredLocal = restored.rows.find(row => row.entity === "IfcWindow");
  assert.equal(restoredLocal.name, "Depth");
  assert.equal(restoredLocal.propertySet, "Pset_WindowLocal");
  assert.equal(restoredLocal.type, "Real");
  assert.equal(restored.rows.find(row => row.entity === "IfcDoor").name, "Width");
  assert.equal(centralStandard(restored), "BASE");
});

for (const identity of [
  { name: "Uniform_id", field: "Uniform_id", value: "width", exportedId: "width" },
  { name: "Source_uri", field: "Source_uri", value: "https://example.test/property/width", exportedId: "https://example.test/property/width" },
  { name: "legacy row identity", exportedId: "klikmodel:udps:row:0" }
]) {
  test(`a new application keeps the imported ${identity.name} group across repeated save/reopen`, () => {
    const data = sourceFixture();
    if (identity.field) {
      data.headers.push(identity.field);
      data.rows[0][identity.field] = identity.value;
    }
    const project = open(data);
    const door = project.rows[0];
    project.rows.push({ ...door, id: "new-window", entity: "IfcWindow", sourceIndex: undefined, override: "WINDOW_LOCAL" });

    const saved = JSON.parse(files.save(project));
    const added = saved.rows.find(row => row.IfcWindow === "x");
    assert.equal(added.Uniform_id, identity.exportedId);
    assert.equal(added.Source_contexts, "", "An own application must not inherit source-class evidence");
    assert.equal(added.Custom_note, "", "Only declared runtime fields are written for a new application");
    if (identity.field === "Source_uri") assert.equal(added.Source_uri, "");
    const restored = open(saved);
    assert.equal(new Set(restored.rows.map(row => row.key)).size, 1);
    assert.equal(centralStandard(restored), "BASE");
    assert.deepEqual(parametersByEntity(restored), { IfcDoor: "BASE", IfcWindow: "WINDOW_LOCAL" });
    const repeated = reopen(restored);
    assert.equal(repeated.rows[0].key, restored.rows[0].key);
    assert.equal(new Set(repeated.rows.map(row => row.key)).size, 1);

    // Identity must also survive when the imported application is removed before saving.
    const onlyAdded = reopen(files.removeApplications(project, [door.id]));
    assert.equal(onlyAdded.rows[0].key, restored.rows[0].key);
    assert.deepEqual(parametersByEntity(onlyAdded), { IfcWindow: "WINDOW_LOCAL" });
  });
}

test("new applications preserve their own classification without copying source-class evidence", () => {
  const data = sourceFixture();
  data.headers.push("Uniform_id", "Source_class");
  Object.assign(data.rows[0], { Uniform_id: "width", Source_class: "A" });
  const project = open(data);
  for (const [entity, classification] of [["IfcWindow", "B"], ["IfcWall", "C"]]) {
    project.rows.push({ ...project.rows[0], id: `new-${entity}`, entity, classification, sourceIndex: undefined });
  }

  const saved = JSON.parse(files.save(project));
  assert.ok(saved.headers.includes("Classification"));
  assert.equal(saved.rows.length, 3, "Different application classifications must not be collapsed");
  for (const entity of ["IfcWindow", "IfcWall"]) {
    assert.equal(saved.rows.find(row => row[entity] === "x").Source_class, "");
  }
  const restored = open(saved);
  assert.deepEqual(Object.fromEntries(Array.from(restored.rows, row => [row.entity, row.classification])), {
    IfcDoor: "A", IfcWindow: "B", IfcWall: "C"
  });
  assert.equal(new Set(restored.rows.map(row => row.key)).size, 1);
});

test("an explicit runtime classification is saved while absent runtime classification retains the original", () => {
  const data = sourceFixture();
  data.headers.push("Classification");
  data.rows[0].Classification = "ORIGINAL";
  const project = open(data);
  project.rows[0].classification = "MANUAL";
  assert.equal(reopen(project).rows[0].classification, "MANUAL");

  delete project.rows[0].classification;
  assert.equal(reopen(project).rows[0].classification, "ORIGINAL");
});

test("saving an unclassified project does not add an unused Classification column", () => {
  const project = open(sourceFixture());
  assert.equal(JSON.parse(files.save(project)).headers.includes("Classification"), false);
});
