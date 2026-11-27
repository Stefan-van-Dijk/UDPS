import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  prepareIdsFile, prepareSavedIdsSource, proposalsFor, createIdsProject, IDS_CATALOG, IDS_ENTITY_CODES, IDS_DATA_TYPES
} from '../../web/test/ids-project.mjs';
import { IDS_MAX_BYTES } from '../../web/test/ids/ids.mjs';

const literal = value => ({ kind: 'literal', value, attributes: {}, wrapperAttributes: {} });
const property = (index, extra = {}) => ({
  id: `spec:0/requirement:${index}`, kind: 'property', cardinality: 'required',
  attributes: { dataType: 'IFCLABEL' },
  parameters: { propertySet: literal('Pset_Example'), baseName: literal('Reference') },
  unknown: [], ...extra
});
const entity = name => ({
  id: 'spec:0/applicability:0', kind: 'entity', attributes: {}, unknown: [],
  parameters: { name: literal(name) }
});
function prepared(requirements = [property(0)], extra = {}) {
  // Prepared-document fixtures exercise translation; they do not claim XML parsing.
  const xml = '<ids xmlns="http://standards.buildingsmart.org/IDS"><info><title>Fixture</title></info><specifications/></ids>';
  return {
    catalog: IDS_CATALOG,
    document: {
      schema: 1, documentSchema: 2,
      id: 'sha256:' + createHash('sha256').update(xml).digest('hex'),
      title: 'Voorbeeld IDS', fileName: 'eisen.ids', xml,
      sourceEncoding: 'utf-8', sourceByteDigest: 'sha256:' + 'b'.repeat(64),
      format: { mappingAllowed: true }, attributes: {}, unknown: [], warnings: [],
      specifications: [{
        id: 'spec:0', name: 'Voorbeeld', ifcVersions: ['IFC4'],
        minOccurs: '1', maxOccurs: 'unbounded', attributes: {},
        applicabilityAttributes: {}, requirementsAttributes: [{}],
        applicability: [entity('IFCBEAM')], requirements, unknown: []
      }], ...extra
    }
  };
}
const decisionId = 'spec:0/requirement:0';
const adapter = runInNewContext(readFileSync(new URL('../../web/test/project-files.js', import.meta.url), 'utf8') + '\nUDPSProjectFiles;');

test('pinned class cache exposes canonical entities beyond the click model list', () => {
  assert.equal(IDS_ENTITY_CODES.length, 247);
  assert.equal(new Set(IDS_ENTITY_CODES).size, IDS_ENTITY_CODES.length);
  assert(IDS_ENTITY_CODES.includes('IfcBeam'));
  assert(IDS_ENTITY_CODES.includes('IfcSpace'));
  assert.equal(IDS_CATALOG.ifc.version, '4.3');
  assert.equal(IDS_CATALOG.ifc.status, 'Preview');
  assert.equal(IDS_CATALOG.checkedAt, '2026-11-12T09:39:29.551093+00:00');
  assert(IDS_DATA_TYPES.includes('MassDensity'));
  assert(IDS_DATA_TYPES.includes('Label'));
});

test('direct properties default to pending mappings with source identity and requirement references', () => {
  const input = prepared();
  const before = structuredClone(input);
  const result = createIdsProject(input);
  assert.equal(result.version, 1);
  assert.equal(result.source, 'Voorbeeld IDS');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].IfcBeam, 'x');
  assert.equal(result.rows[0].Data_type, 'Label');
  assert.equal(result.rows[0].Revit_parameter, '');
  assert.equal(result.rows[0].Mapping_pending, 'x');
  assert.equal(result.rows[0].Mapping_origin, 'ids');
  assert.equal(result.rows[0].Source_uri, undefined);
  assert.equal(result.idsImports[0].xml, input.document.xml);
  assert.equal(result.idsImports[0].sourceEncoding, 'utf-8');
  assert.equal(result.idsImports[0].sourceByteDigest, input.document.sourceByteDigest);
  assert.deepEqual(result.idsImports[0].selectedRequirementIds, [decisionId]);
  assert.deepEqual(JSON.parse(result.rows[0].IDS_requirements), [{
    documentId: input.document.id, requirementId: decisionId, specificationId: 'spec:0'
  }]);
  assert.deepEqual(input, before);
});

test('default selection leaves optional, prohibited, unknown type and other facets in the source', () => {
  const input = prepared([
    property(0), property(1, { cardinality: 'optional' }),
    property(2, { cardinality: 'prohibited' }),
    property(3, { attributes: { dataType: 'IFCUNKNOWN' } }),
    { id: 'spec:0/requirement:4', kind: 'material', cardinality: 'required', attributes: {}, parameters: { value: literal('Steel') } }
  ]);
  const result = createIdsProject(input);
  assert.equal(proposalsFor(input).length, 5);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.idsImports[0].selectedRequirementIds, [decisionId]);
  assert.equal(result.idsImports[0].xml, input.document.xml);
  assert.throws(() => createIdsProject(input, { selectedIds: ['spec:0/requirement:2'] }), /Verboden property/);
  assert.throws(() => createIdsProject(input, { selectedIds: ['spec:0/requirement:4'] }), /andere IFC-route/);
});

test('explicit empty selections preserve source and choices without creating rows', () => {
  const input = prepared();
  const decisions = { [decisionId]: { revitParameter: 'QA_Beam' } };
  for (const selectedIds of [[], new Set()]) {
    const result = createIdsProject(input, { name: 'Alleen bron', selectedIds, decisions });
    assert.equal(result.source, 'Alleen bron');
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.idsImports[0].selectedRequirementIds, []);
    assert.deepEqual(result.idsImports[0].decisions, decisions);
    assert.equal(result.idsImports[0].xml, input.document.xml);
  }
});

test('restricted scope, required values and datatype are reassessed without reducing them to a first value', () => {
  const input = prepared([property(0, {
    attributes: { dataType: 'IFCUNKNOWN' },
    parameters: { propertySet: literal('Pset_Example'), baseName: literal('Reference'), value: literal('REI60') }
  })]);
  input.document.specifications[0].applicability.push({
    id: 'spec:0/applicability:1', kind: 'classification', attributes: {},
    parameters: { system: literal('NL/SfB'), value: literal('31') }, unknown: []
  });
  assert.equal(proposalsFor(input)[0].eligible, false);
  const decisions = { [decisionId]: { dataType: 'Text', acknowledgeScope: true, acknowledgeValues: true, revitParameter: 'QA_Fire' } };
  const [proposal] = proposalsFor(input, decisions);
  assert.equal(proposal.eligible, true);
  assert.equal(proposal.direct, false);
  assert(proposal.warnings.some(warning => warning.includes('toepassingsvoorwaarden')));
  assert(proposal.warnings.some(warning => warning.includes('waarde')));
  const result = createIdsProject(input, { selectedIds: new Set([decisionId]), decisions });
  const reference = JSON.parse(result.rows[0].IDS_requirements)[0];
  assert.equal(result.rows[0].Revit_parameter, 'QA_Fire');
  assert.equal(result.rows[0].Data_type, 'Text');
  assert.deepEqual(reference.decisions, decisions[decisionId]);
  assert.equal(reference.conditions.conditional, true);
  assert.equal(reference.values.constrained, true);
  assert.equal(result.idsImports[0].xml, input.document.xml);
});

test('finite entity enumeration creates every target and retains the source scope', () => {
  const input = prepared();
  input.document.specifications[0].applicability[0].parameters.name = {
    kind: 'restriction', base: 'xs:string', baseNamespace: 'http://www.w3.org/2001/XMLSchema',
    attributes: { base: 'xs:string' }, wrapperAttributes: {},
    facets: ['IFCBEAM', 'IFCSPACE'].map(value => ({ kind: 'enumeration', namespace: 'http://www.w3.org/2001/XMLSchema', value, attributes: { value } }))
  };
  assert.deepEqual(proposalsFor(input)[0].entities, ['IfcBeam', 'IfcSpace']);
  const result = createIdsProject(input);
  assert.equal(result.rows.length, 2);
  assert(result.rows.some(row => row.IfcBeam === 'x'));
  assert(result.rows.some(row => row.IfcSpace === 'x'));
  for (const row of result.rows) assert.deepEqual(JSON.parse(row.IDS_requirements)[0].appliedTargets.entities, ['IfcBeam', 'IfcSpace']);
});

test('entity and property name patterns need concrete reviewed choices', () => {
  const input = prepared();
  const pattern = { kind: 'restriction', base: 'xs:string', baseNamespace: 'http://www.w3.org/2001/XMLSchema', facets: [{ kind: 'pattern', namespace: 'http://www.w3.org/2001/XMLSchema', value: 'IFC.*' }] };
  input.document.specifications[0].applicability[0].parameters.name = pattern;
  input.document.specifications[0].requirements[0].parameters.baseName = { ...pattern, facets: [{ ...pattern.facets[0], value: 'Fire.*' }] };
  assert.equal(proposalsFor(input)[0].eligible, false);
  const decisions = { [decisionId]: { entities: ['IfcSpace'], property: 'FireRating', acknowledgeScope: true } };
  const result = createIdsProject(input, { selectedIds: [decisionId], decisions });
  assert.equal(result.rows[0].IfcSpace, 'x');
  assert.equal(result.rows[0].IFC_parameter, 'FireRating');
  assert.equal(result.idsImports[0].xml, input.document.xml);
});

test('source-only document formats cannot be forced into positive mappings', () => {
  const input = prepared(undefined, { format: { mappingAllowed: false } });
  const result = createIdsProject(input);
  assert.equal(result.rows.length, 0);
  assert.equal(result.idsImports[0].xml, input.document.xml);
  assert.throws(() => createIdsProject(input, { selectedIds: [decisionId] }), /alleen als bron/);
});

test('adding to an existing raw project reuses mappings, preserves its name and never mutates the input', () => {
  const input = prepared();
  const baseData = createIdsProject(input, { name: 'Bestaand', decisions: { [decisionId]: { revitParameter: 'Behoud' } } });
  baseData.customMetadata = { keep: true };
  const before = structuredClone(baseData);
  const result = createIdsProject(input, { baseData, selectedIds: [decisionId], decisions: { [decisionId]: { revitParameter: 'Vervang niet' } } });
  assert.equal(result.source, 'Bestaand');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].Revit_parameter, 'Behoud');
  assert.equal(result.idsImports.length, 1);
  assert.equal(JSON.parse(result.rows[0].IDS_requirements).length, 1);
  assert.deepEqual(result.customMetadata, { keep: true });
  assert.deepEqual(baseData, before);
  assert.notEqual(result, baseData);
});

test('datatype conflict rejects the whole selection without touching the existing project', () => {
  const input = prepared();
  const baseData = createIdsProject(input);
  baseData.rows[0].Data_type = 'Text';
  const before = structuredClone(baseData);
  assert.throws(() => createIdsProject(input, { baseData, selectedIds: [decisionId] }), /Conflicterend datatype/);
  assert.deepEqual(baseData, before);
});

test('a second source can be retained alone or linked to the existing mapping without losing either source', () => {
  const first = prepared();
  const second = prepared(undefined, { fileName: 'aanvullend.ids' });
  second.document.xml += '<!-- second source -->';
  second.document.id = 'sha256:' + createHash('sha256').update(second.document.xml).digest('hex');
  const baseData = createIdsProject(first);
  const before = structuredClone(baseData);
  const sourceOnly = createIdsProject(second, { baseData, selectedIds: [] });
  assert.deepEqual(sourceOnly.rows, baseData.rows);
  assert.equal(sourceOnly.idsImports.length, 2);
  assert.deepEqual(sourceOnly.idsImports[1].selectedRequirementIds, []);
  assert.equal(sourceOnly.idsImports[1].xml, second.document.xml);
  const linked = createIdsProject(second, { baseData, selectedIds: [decisionId] });
  assert.equal(linked.rows.length, 1);
  assert.equal(linked.idsImports.length, 2);
  assert.deepEqual(JSON.parse(linked.rows[0].IDS_requirements).map(ref => ref.documentId), [first.document.id, second.document.id]);
  const saved = JSON.parse(adapter.save(adapter.open(JSON.stringify(sourceOnly), 'voorbeeld.json')));
  assert.deepEqual(saved.idsImports, sourceOnly.idsImports);
  assert.deepEqual(baseData, before);
});

test('the click model adapter retains XML, requirement links, choices and extra headers on save/open', () => {
  const input = prepared();
  const raw = createIdsProject(input, { decisions: { [decisionId]: { revitParameter: 'QA_Beam' } } });
  const project = adapter.open(JSON.stringify(raw), 'voorbeeld.json');
  const saved = JSON.parse(adapter.save(project));
  assert.deepEqual(saved.idsImports, raw.idsImports);
  assert.equal(saved.rows[0].IDS_requirements, raw.rows[0].IDS_requirements);
  assert.equal(saved.rows[0].Mapping_origin, 'ids');
  assert(saved.headers.includes('IDS_requirements'));
  const reopened = adapter.open(JSON.stringify(saved), 'voorbeeld.json');
  assert.equal(reopened.rows[0].entity, 'IfcBeam');
  assert.equal(reopened.rows[0].type, 'Label');
  assert.equal(adapter.parameterOf(reopened, reopened.rows[0]), 'QA_Beam');
});

test('invalid selections, decisions and base projects fail explicitly', () => {
  const input = prepared();
  assert.throws(() => createIdsProject(input, { selectedIds: 'all' }), /lijst/);
  assert.throws(() => createIdsProject(input, { selectedIds: ['spec:0/requirement:99'] }), /niet beschikbaar/);
  assert.throws(() => createIdsProject(input, { selectedIds: [decisionId, decisionId] }), /Selecteer/);
  assert.throws(() => createIdsProject(input, { decisions: { [decisionId]: { dataType: 'Arbitrary' } } }), /datatype/);
  assert.throws(() => createIdsProject(input, { selectedIds: [], decisions: { [decisionId]: { property: '' } } }), /eigenschapsnaam/);
  assert.throws(() => createIdsProject(input, { baseData: { headers: [], rows: [] } }), /geldig UDPS-project/);
  assert.throws(() => proposalsFor({}), /Bereid eerst/);
});

test('file failures and bounded byte errors do not require a parser or product dependencies', async () => {
  await assert.rejects(prepareIdsFile(null), /lokaal IDS-bestand/);
  let read = false;
  await assert.rejects(prepareIdsFile({ name: 'large.ids', size: IDS_MAX_BYTES + 1, arrayBuffer() { read = true; } }), /10 MiB/);
  assert.equal(read, false);
  await assert.rejects(prepareIdsFile({ name: 'eisen.ids', size: 1, async arrayBuffer() { throw Error('gone'); } }), /kon niet worden gelezen/);
  const file = bytes => ({ name: 'eisen.ids', size: bytes.byteLength, async arrayBuffer() { return bytes; } });
  await assert.rejects(prepareIdsFile(file(new Uint8Array().buffer)), /leeg/);
  await assert.rejects(prepareIdsFile(file(Uint8Array.of(0xff).buffer)), /ongeldige bytes/);
  await assert.rejects(prepareIdsFile(file(new TextEncoder().encode('<!DOCTYPE ids [<!ENTITY custom "x">]><ids/>').buffer)), /DTD|entiteiten/);
  if (typeof globalThis.DOMParser === 'undefined') {
    await assert.rejects(prepareIdsFile(file(new TextEncoder().encode('<ids/>').buffer)), /XML-parser/);
  }
});

test('saved source validation rejects corrupt records, missing identities and invalid source history before parsing', async () => {
  const source = createIdsProject(prepared(), { selectedIds: [] }).idsImports[0];
  await assert.rejects(prepareSavedIdsSource({ ...source, id: 'bad-id' }), /opgeslagen IDS-bron/);
  await assert.rejects(prepareSavedIdsSource({ ...source, xml: '' }), /opgeslagen IDS-bron/);
  await assert.rejects(prepareSavedIdsSource(source, []), /ontbreekt/);
  await assert.rejects(prepareSavedIdsSource(source, [source, source]), /opgeslagen IDS-bron/);
  await assert.rejects(prepareSavedIdsSource(source, [{ ...source, previousDocumentId: 'sha256:' + 'c'.repeat(64) }]), /vorige IDS-bron ontbreekt/);
  await assert.rejects(prepareSavedIdsSource(source, [{ ...source, sourceByteDigest: 'bad-digest' }]), /bestandsidentiteit/);
});

test('saved XML reaches the reader unchanged, preserves encoding metadata and verifies the text digest', async () => {
  // Fixed DOM fixture tests the bridge, not XML parsing. No parser implementation
  // or dependency is shipped; the real encoded-file browser route stays separate.
  const namespace = 'http://standards.buildingsmart.org/IDS';
  const element = (name, children = [], text = '') => ({
    nodeType: 1, localName: name, nodeName: name, namespaceURI: namespace,
    childNodes: children, attributes: [], textContent: text || children.map(child => child.textContent).join(''),
    getAttribute() { return null; }, getAttributeNS() { return null; }, hasAttribute() { return false; }
  });
  const root = element('ids', [element('info', [element('title', [], 'Café')]), element('specifications')]);
  const seen = [];
  const originalParser = globalThis.DOMParser;
  const originalSerializer = globalThis.XMLSerializer;
  globalThis.DOMParser = class {
    parseFromString(xml) {
      seen.push(xml);
      return { documentElement: root, getElementsByTagNameNS() { return []; } };
    }
  };
  globalThis.XMLSerializer = undefined;
  try {
    for (const [declaration, sourceEncoding] of [['UTF-16', 'utf-16le'], ['windows-1252', 'windows-1252']]) {
      const xml = `<?xml version="1.0" encoding="${declaration}"?><ids xmlns="${namespace}"><info><title>Café</title></info><specifications/></ids>`;
      const source = {
        schema: 1, id: 'sha256:' + createHash('sha256').update(xml).digest('hex'),
        fileName: 'bewaard.ids', xml, selectedRequirementIds: [], sourceEncoding,
        sourceByteDigest: 'sha256:' + 'd'.repeat(64),
        decisions: { [decisionId]: { dataType: 'Label' } }
      };
      const before = structuredClone(source);
      const result = await prepareSavedIdsSource(source);
      assert.equal(seen.at(-1), xml);
      assert.equal(result.document.xml, xml);
      assert.equal(result.document.id, source.id);
      assert.equal(result.document.sourceEncoding, sourceEncoding);
      assert.equal(result.document.sourceByteDigest, source.sourceByteDigest);
      assert.equal(result.document.decisions, undefined);
      assert.equal(result.catalog, IDS_CATALOG);
      assert.deepEqual(result.proposals, []);
      assert.equal(result.counts.requirements, 0);
      assert.deepEqual(source, before);
      await assert.rejects(prepareSavedIdsSource({ ...source, id: 'sha256:' + 'e'.repeat(64) }), /bronidentiteit past niet/);
    }
  } finally {
    if (originalParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = originalParser;
    if (originalSerializer === undefined) delete globalThis.XMLSerializer;
    else globalThis.XMLSerializer = originalSerializer;
  }
});
