import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { prepareLibraryFile, createLibraryProject } from '../../web/test/library-files.mjs';

const adapter = runInNewContext(readFileSync(new URL('../../web/test/project-files.js', import.meta.url), 'utf8') + '\nUDPSProjectFiles;');
const BASE = ['Revit_parameter', 'IFC_parameter', 'Y/N', 'Export_tabblad', 'Data_type'];

function library() {
  return { format: 'udps-library', schema: 1, id: 'facade', name: 'Gevelbibliotheek', version: '1.0',
    license: { identifier: 'CC-BY-4.0', attribution: 'Fixture author' },
    extraMetadata: { preserved: true },
    classes: [{ code: 'frame', name: 'Kozijn', ifcEntities: ['IfcDoor', 'IfcWindow'],
      extraClassMetadata: 'Keep this in the source',
      properties: [
        { code: 'Width', name: 'Breedte', propertySet: 'Pset_Facade', dataType: 'Length', extraPropertyMetadata: ['keep'] },
        { code: 'FireRating', name: 'Brandklasse', propertySet: 'Pset_Facade', dataType: 'Text' }
      ] }]
  };
}
const file = (data, name = 'gevel.json') => new File([JSON.stringify(data)], name, { type: 'application/json' });
const prepare = data => prepareLibraryFile(file(data));
function base(rows = []) {
  return { version: 1, source: 'Bestaand project', headers: [...BASE, 'IfcDoor', 'IfcWindow'], rows,
    customProjectMetadata: { keep: [1, 2] } };
}
function widthRow(extra = {}) {
  return { Revit_parameter: 'USER_WIDTH', IFC_parameter: 'Width', 'Y/N': 'x', Export_tabblad: 'Pset_Facade',
    Data_type: 'Length', IfcDoor: 'x', IfcWindow: '', ...extra };
}

test('reads the real library JSON format with stable property identities and original licence/metadata', async () => {
  const input = library();
  input.classes[0].ifcEntities.push('IfcBeam');
  const prepared = await prepare(input);
  assert.equal(prepared.library.name, 'Gevelbibliotheek');
  assert.equal(prepared.properties.length, 2);
  const property = prepared.properties[0];
  assert.equal(property.label, 'Breedte');
  assert.equal(property.code, 'Width');
  assert.equal(property.propertySet, 'Pset_Facade');
  assert.equal(property.dataType, 'Length');
  assert.deepEqual(property.entities, ['IfcDoor', 'IfcWindow', 'IfcBeam']);
  assert.equal(property.id, property.key);
  assert.match(property.id, /^urn:udps:library:facade:1\.0:class:frame:property:/);
  assert.deepEqual(prepared.source.library, input);
  assert.equal(prepared.source.fileName, 'gevel.json');
  assert.deepEqual((await prepare(input)).properties.map(property => property.id), prepared.properties.map(property => property.id));
});

test('rejects malformed JSON, another format and invalid library definitions without guessing', async () => {
  await assert.rejects(prepareLibraryFile(new File(['<ids/>'], 'not-json.json')), /JSON/);
  for (const change of [
    input => { input.format = 'project'; },
    input => { input.schema = 2; },
    input => { input.classes[0].ifcEntities = ['IfcImaginary']; },
    input => { input.classes[0].ifcEntities = ['IFCWINDOW']; },
    input => { input.classes[0].properties[0].dataType = 'UnknownType'; },
    input => { input.classes[0].properties.push({ ...input.classes[0].properties[0] }); },
    input => { input.classes.push(structuredClone(input.classes[0])); },
    input => { input.classes[0].properties = []; },
    input => { input.id = 'bad/id'; }
  ]) {
    const input = library(); change(input);
    await assert.rejects(prepare(input));
  }
  await assert.rejects(prepareLibraryFile({ size: 2, name: 'test.json' }), /lokaal/);
});

test('enforces the 10 MiB bound before reading and against actual bytes', async () => {
  let read = false;
  await assert.rejects(prepareLibraryFile({ name: 'large.json', size: 10 * 1024 * 1024 + 1,
    arrayBuffer() { read = true; throw Error('Should not read'); } }), /10 MiB/);
  assert.equal(read, false);
  await assert.rejects(prepareLibraryFile({ name: 'mismatch.json', size: 1,
    arrayBuffer: async () => new ArrayBuffer(10 * 1024 * 1024 + 1) }), /10 MiB/);
  await assert.rejects(prepareLibraryFile(new File([new Uint8Array([0xff, 0xfe])], 'invalid.json')), /UTF-8/);
});

test('source-only creation is the default and survives the real UDPS adapter roundtrip', async () => {
  const input = library(), prepared = await prepare(input);
  const data = createLibraryProject(prepared);
  assert.equal(data.rows.length, 0);
  assert.equal(data.source, input.name);
  assert.equal(data.libraryImports.length, 1);
  assert.deepEqual(data.libraryImports[0].library, input);
  const project = adapter.open(JSON.stringify(data), 'source-only.json');
  const saved = JSON.parse(adapter.save(project));
  assert.deepEqual(saved.libraryImports[0].library, input);
  assert.equal(saved.rows.length, 0);
});

test('explicit selection creates pending mappings only for the declared IFC targets and preserves source identity', async () => {
  const prepared = await prepare(library());
  const before = structuredClone(prepared);
  const property = prepared.properties[0];
  const data = createLibraryProject(prepared, { selectedIds: [property.id] });
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].Uniform_id, property.key);
  assert.equal(data.rows[0].Source_uri, property.id);
  assert.equal(data.rows[0].Source_dictionary, prepared.source.uri);
  assert.equal(data.rows[0].Mapping_origin, 'library');
  assert.equal(data.rows[0].Mapping_pending, 'x');
  assert.equal(data.rows[0].Revit_parameter, '');
  assert.equal(data.rows[0].IfcDoor, 'x');
  assert.equal(data.rows[0].IfcWindow, 'x');
  assert.equal(data.headers.includes('IfcWall'), false);
  assert.deepEqual(JSON.parse(data.rows[0].Source_contexts).map(context => context.entity), ['IfcDoor', 'IfcWindow']);
  assert.deepEqual(prepared, before);

  const opened = adapter.open(JSON.stringify(data), 'library-project.json');
  assert.equal(opened.rows.length, 2);
  assert.equal(new Set(opened.rows.map(row => row.key)).size, 1);
  assert.ok(opened.rows.every(row => row.override === null && !row.implicitRevit));
  opened.standards[opened.rows[0].key] = 'WINDOW_WIDTH';
  const saved = JSON.parse(adapter.save(opened));
  assert.deepEqual(saved.libraryImports[0].library.license, library().license);
  const restored = adapter.open(JSON.stringify(saved), 'saved.json');
  assert.equal(new Set(restored.rows.map(row => row.key)).size, 1);
  assert.ok(restored.rows.every(row => adapter.parameterOf(restored, row) === 'WINDOW_WIDTH'));
  assert.deepEqual(JSON.parse(restored.sourceData.rows[0].Source_contexts), JSON.parse(data.rows[0].Source_contexts));
});

test('existing mappings and inferred central standards are reused without overwritten names or fabricated defaults', async () => {
  const prepared = await prepare(library());
  const existing = base([widthRow({ 'Y/N': '' })]);
  const before = structuredClone(existing);
  const data = createLibraryProject(prepared, { baseData: existing, selectedIds: [prepared.properties[0].id] });
  assert.deepEqual(existing, before);
  assert.deepEqual(data.rows[0], existing.rows[0]);
  assert.equal(Object.hasOwn(data.rows[0], 'Uniform_revit'), false);
  assert.equal(data.rows.length, 2);
  assert.equal(data.rows[1].IfcWindow, 'x');
  assert.equal(data.rows[1].IfcDoor, '');
  assert.equal(data.rows[1].Revit_parameter, '');
  const project = adapter.open(JSON.stringify(data), 'mixed.json');
  const door = project.rows.find(row => row.entity === 'IfcDoor');
  assert.equal(door.active, false);
  assert.equal(adapter.parameterOf(project, door), 'USER_WIDTH');
  assert.equal(project.standards[door.key], 'USER_WIDTH');
  const restored = adapter.open(adapter.save(project), 'roundtrip.json');
  assert.equal(adapter.parameterOf(restored, restored.rows.find(row => row.entity === 'IfcDoor')), 'USER_WIDTH');
  assert.deepEqual(JSON.parse(adapter.save(project)).customProjectMetadata, existing.customProjectMetadata);
});

test('a datatype conflict rejects the whole selection after another proposal without partial writes', async () => {
  const prepared = await prepare(library());
  const data = base([widthRow({ Data_type: 'Text' })]);
  const before = structuredClone(data), preparedBefore = structuredClone(prepared);
  assert.throws(() => createLibraryProject(prepared, { baseData: data,
    selectedIds: [prepared.properties[1].id, prepared.properties[0].id] }), /Datatypeconflict/);
  assert.deepEqual(data, before);
  assert.deepEqual(prepared, preparedBefore);
});

test('another explicit source identity cannot be silently overwritten or merged', async () => {
  const prepared = await prepare(library());
  const data = base([widthRow({ Source_uri: 'urn:other:property' })]);
  data.headers.push('Source_uri');
  const before = structuredClone(data);
  assert.throws(() => createLibraryProject(prepared, { baseData: data, selectedIds: [prepared.properties[0].id] }), /andere bronkoppeling/);
  assert.deepEqual(data, before);
});

test('identical source versions can add a later selection while changed content needs a new version', async () => {
  const prepared = await prepare(library());
  const first = createLibraryProject(prepared, { selectedIds: [prepared.properties[0].id] });
  first.libraryImports[0].localNote = 'Keep the existing source record';
  const second = createLibraryProject(prepared, { baseData: first, selectedIds: new Set([prepared.properties[1].id]) });
  assert.equal(second.rows.length, 2);
  assert.equal(second.libraryImports.length, 1);
  assert.equal(second.libraryImports[0].localNote, 'Keep the existing source record');
  assert.equal(first.rows.length, 1);

  const changed = library(); changed.name = 'Changed title';
  const changedPrepared = await prepare(changed);
  const before = structuredClone(second);
  assert.throws(() => createLibraryProject(changedPrepared, { baseData: second }), /andere broninhoud/);
  assert.deepEqual(second, before);
  changed.version = '2.0';
  const nextVersion = createLibraryProject(await prepare(changed), { baseData: second });
  assert.equal(nextVersion.libraryImports.length, 2);
  assert.equal(nextVersion.libraryImports[0].name, 'Gevelbibliotheek');
  assert.equal(nextVersion.rows.length, second.rows.length);
});

test('reselecting existing own-library targets does not duplicate them or replace edited Revit names', async () => {
  const prepared = await prepare(library());
  const first = createLibraryProject(prepared, { selectedIds: [prepared.properties[0].id] });
  Object.assign(first.rows[0], { Revit_parameter: 'LOCAL_WIDTH', Uniform_revit: 'LOCAL_WIDTH', Mapping_pending: '' });
  const again = createLibraryProject(prepared, { baseData: first, selectedIds: [prepared.properties[0].id] });
  assert.deepEqual(again.rows, first.rows);
  assert.equal(again.libraryImports.length, 1);
});

test('unknown selections and colliding properties in different source classes do not partially import', async () => {
  const input = library();
  input.classes.push({ ...structuredClone(input.classes[0]), code: 'other-frame' });
  const prepared = await prepare(input), data = base(), before = structuredClone(data);
  assert.throws(() => createLibraryProject(prepared, { baseData: data, selectedIds: ['not-a-property'] }), /bestaat niet/);
  assert.throws(() => createLibraryProject(prepared, { baseData: data,
    selectedIds: [prepared.properties[0].id, prepared.properties[2].id] }), /andere bronkoppeling/);
  assert.deepEqual(data, before);
});

test('source-only and selected additions reject a resulting raw project above 32 MiB atomically', async () => {
  const input = library(); input.extraMetadata.padding = 'b'.repeat(4096);
  const prepared = await prepare(input);
  const data = base();
  data.padding = 'a'.repeat(32 * 1024 * 1024 - 2048);
  assert.ok(new TextEncoder().encode(JSON.stringify(data, null, 2)).byteLength < 32 * 1024 * 1024);
  const initialRows = data.rows.length;
  for (const selectedIds of [[], [prepared.properties[0].id]]) {
    assert.throws(() => createLibraryProject(prepared, { baseData: data, selectedIds }), /32 MiB/);
    assert.equal(data.rows.length, initialRows);
    assert.equal(data.libraryImports, undefined);
  }
});
