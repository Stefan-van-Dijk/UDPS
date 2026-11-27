const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../../web/test/ifc-entity-catalog.js"), "utf8");
const catalog = vm.runInNewContext(`${source}\nUDPSIfcCatalog;`, {
  fetch() { throw new Error("The catalog must work offline."); }
});
const version = id => catalog.versions.find(item => item.id === id);
const entity = (id, code) => version(id).entities.find(item => item.code === code);
const codes = results => Array.from(results, item => item.code);

test("three distinct official release snapshots have the expected object-definition and abstract counts", () => {
  assert.deepEqual(Array.from(catalog.versions, item => [item.id, item.label, item.entities.length, item.entities.filter(entity => entity.abstract).length]), [
    ["IFC2X3", "IFC2x3", 233, 39],
    ["IFC4", "IFC4", 353, 45],
    ["IFC4X3", "IFC4.3", 415, 49]
  ]);
  assert.notDeepEqual(codes(version("IFC2X3").entities), codes(version("IFC4").entities));
  assert.notDeepEqual(codes(version("IFC4").entities), codes(version("IFC4X3").entities));
});

test("IFC2x3-only target classes do not leak into the IFC4 version filter", () => {
  assert.ok(entity("IFC2X3", "IfcElectricDistributionPoint"));
  assert.equal(entity("IFC4", "IfcElectricDistributionPoint"), undefined);
  assert.equal(entity("IFC4X3", "IfcElectricDistributionPoint"), undefined);
  assert.deepEqual(codes(catalog.search("IFC4", "ElectricDistributionPoint")), []);
});

test("new IFC4 occurrences and IFC4.3 infrastructure targets appear only in their actual schema", () => {
  assert.equal(entity("IFC2X3", "IfcAirTerminal"), undefined);
  assert.ok(entity("IFC2X3", "IfcAirTerminalType"));
  assert.ok(entity("IFC4", "IfcAirTerminal"));
  assert.ok(entity("IFC4X3", "IfcAirTerminal"));
  for (const code of ["IfcBridge", "IfcRoad", "IfcRailway"]) {
    assert.equal(entity("IFC2X3", code), undefined);
    assert.equal(entity("IFC4", code), undefined);
    assert.equal(entity("IFC4X3", code).abstract, false);
  }
});

test("schema renames and removals retain exact official names rather than generated aliases", () => {
  assert.equal(entity("IFC2X3", "IfcBuildingElement").abstract, true);
  assert.equal(entity("IFC4", "IfcBuildingElement").abstract, true);
  assert.equal(entity("IFC4X3", "IfcBuildingElement"), undefined);
  assert.equal(entity("IFC4", "IfcBuiltElement"), undefined);
  assert.equal(entity("IFC4X3", "IfcBuiltElement").abstract, false);
  assert.ok(entity("IFC4", "IfcDoorStyle"));
  assert.equal(entity("IFC4X3", "IfcDoorStyle"), undefined);
  assert.deepEqual(codes(catalog.search("IFC4X3", "DoorStyle")), []);
});

test("abstract object-definition targets are explicit and resource, property and relationship entities are excluded", () => {
  for (const item of catalog.versions) {
    assert.equal(entity(item.id, "IfcObjectDefinition").abstract, true);
    assert.equal(entity(item.id, "IfcDoor").abstract, false);
    assert.ok(entity(item.id, "IfcDoorType") || entity(item.id, "IfcDoorStyle"));
    for (const code of ["IfcRoot", "IfcCartesianPoint", "IfcPropertySet", "IfcMaterial", "IfcRelDefinesByProperties", "IfcSIUnit"]) {
      assert.equal(entity(item.id, code), undefined, `${item.id} must not offer ${code} as an object-definition target`);
    }
  }
});

test("each version has unique sorted IFC codes and a boolean abstract flag", () => {
  for (const item of catalog.versions) {
    const actual = codes(item.entities);
    assert.equal(new Set(actual).size, actual.length);
    assert.deepEqual(actual, [...actual].sort());
    for (const entry of item.entities) {
      assert.match(entry.code, /^Ifc[A-Za-z0-9]+$/);
      assert.equal(typeof entry.abstract, "boolean");
      assert.equal(entry.code.includes("*"), false);
    }
  }
});

test("search is case-insensitive, trims whitespace and supports separate words in an IFC code", () => {
  assert.deepEqual(codes(catalog.search("IFC4", "  iFcAIR   tErMiNaL  ")), [
    "IfcAirTerminal", "IfcAirTerminalBox", "IfcAirTerminalBoxType", "IfcAirTerminalType"
  ]);
  assert.deepEqual(codes(catalog.search("IFC4X3", "IfcBridge")), ["IfcBridge", "IfcBridgePart"]);
  assert.deepEqual(codes(catalog.search("IFC4", "IfcBridge")), []);
  assert.deepEqual(codes(catalog.search("IFC4", "made-up-entity")), []);
});

test("empty search returns the selected version only and unknown versions never widen the result", () => {
  for (const item of catalog.versions) {
    assert.equal(catalog.search(item.id).length, item.entities.length);
    assert.equal(catalog.search(item.id, "   ").length, item.entities.length);
    assert.equal(catalog.search(item.id, null).length, item.entities.length);
  }
  for (const id of [undefined, "", "IFC4X4", "ifc4", "__proto__"]) {
    assert.deepEqual(codes(catalog.search(id, "wall")), []);
  }
});

test("the offline catalog cannot be mutated through a search result or its version metadata", () => {
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(Object.isFrozen(catalog.versions), true);
  for (const item of catalog.versions) {
    assert.equal(Object.isFrozen(item), true);
    assert.equal(Object.isFrozen(item.entities), true);
    assert.equal(Object.isFrozen(item.entities[0]), true);
  }
  const result = catalog.search("IFC4X3", "IfcBridge");
  const first = result[0];
  result.splice(0, 1);
  assert.equal(first.code, "IfcBridge");
  assert.equal(catalog.search("IFC4X3", "IfcBridge").length, 2);
  assert.notEqual(result, version("IFC4X3").entities);
});
