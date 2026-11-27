import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as ids from '../../web/test/ids-project.mjs';
import { loadIdsFile, loadIdsText } from '../../web/test/production/ids-loader.js';
import { auditIdsDocument } from '../../web/test/production/ids-audit.js';
import { readIds } from '../../web/test/ids/ids.mjs';
import { DOMParser, XMLSerializer } from '../../web/test/production/vendor/ids-parser/xmldom.js';

const XML = '<?xml version="1.0" encoding="utf-8"?><ids xmlns="http://standards.buildingsmart.org/IDS"><info><title>Studio IDS</title></info><specifications><specification name="Door" ifcVersion="IFC4"><applicability maxOccurs="unbounded"><entity><name><simpleValue>IFCDOOR</simpleValue></name></entity></applicability><requirements><property dataType="IFCLABEL"><propertySet><simpleValue>Pset_Test</simpleValue></propertySet><baseName><simpleValue>Reference</simpleValue></baseName></property></requirements></specification></specifications></ids>';
const hash = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const literal = value => ({ kind: 'literal', value, attributes: {}, wrapperAttributes: {} });
function fixture() {
  return {
    schema: 1, documentSchema: 2, xml: XML, id: hash(XML), title: 'Studio IDS',
    fileName: 'source.ids', sourceEncoding: 'utf-8', sourceByteDigest: hash(XML),
    format: { profile: 'ids-1.0', mappingAllowed: true }, attributes: {}, unknown: [], warnings: [],
    specifications: [{
      id: 'spec:0', name: 'Door', ifcVersions: ['IFC4'], minOccurs: '1', maxOccurs: 'unbounded',
      attributes: {}, applicabilityAttributes: {}, requirementsAttributes: [{}], unknown: [],
      applicability: [{ id: 'spec:0/applicability:0', kind: 'entity', attributes: {}, unknown: [], parameters: { name: literal('IFCDOOR') } }],
      requirements: [{ id: 'spec:0/requirement:0', kind: 'property', cardinality: 'required', attributes: { dataType: 'IFCLABEL' }, unknown: [], parameters: { propertySet: literal('Pset_Test'), baseName: literal('Reference') } }]
    }]
  };
}
const validAudit = () => ({ status: 'valid', complete: false, schema: 'IDS 1.0', checks: [{ id: 'xsd', status: 'valid' }], issues: [] });
const file = () => new File([XML], 'source.ids', { type: 'application/xml' });

// This executes the copied browser module worker and parser through a Node
// transport adapter; native browser acceptance is checked separately by root.
class WorkerAdapter {
  static instances = [];
  constructor(url, options) {
    assert.equal(options.type, 'module');
    this.terminated = false;
    const boot = "import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(" +
      JSON.stringify(String(url)) + ");parentPort.on('message',data=>self.onmessage({data}));";
    this.thread = new ThreadWorker(boot, { eval: true, type: 'module' });
    this.thread.on('message', data => this.onmessage?.({ data }));
    this.thread.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
    WorkerAdapter.instances.push(this);
  }
  postMessage(value) { this.thread.postMessage(value); }
  terminate() { this.terminated = true; return this.thread.terminate(); }
}
function workers(t) {
  const previous = globalThis.Worker;
  globalThis.Worker = WorkerAdapter;
  t.after(async () => {
    if (previous === undefined) delete globalThis.Worker;
    else globalThis.Worker = previous;
    for (const worker of WorkerAdapter.instances) if (!worker.terminated) await worker.terminate();
    WorkerAdapter.instances.length = 0;
  });
}

test('IDS bridge delegates file bytes and audit with the same cancellation signal', async () => {
  const controller = new AbortController();
  const doc = fixture(), events = [];
  const source = { name: 'source.ids', size: XML.length, arrayBuffer() { throw Error('main-thread read'); } };
  const prepared = await ids.prepareIdsFile(source, {
    signal: controller.signal,
    loadIdsFile: async (input, options) => { assert.equal(input, source); assert.equal(options.signal, controller.signal); events.push('reader'); return doc; },
    auditIdsDocument: async (input, options) => { assert.equal(input, doc); assert.equal(options.signal, controller.signal); events.push('audit'); return validAudit(); }
  });
  assert.deepEqual(events, ['reader', 'audit']);
  assert.equal(prepared.document, doc);
  assert.equal(prepared.audit.status, 'valid');
  assert.equal(prepared.audit.complete, false);
  assert.equal(ids.createIdsProject(prepared).rows.length, 1);
});

test('unavailable or invalid XSD never selects mappings implicitly and retains exact source-only XML', async () => {
  for (const status of ['invalid', 'unavailable', 'unsupported']) {
    const prepared = await ids.prepareIdsFile(file(), {
      loadIdsFile: async () => fixture(),
      auditIdsDocument: async () => ({ status, complete: false, issues: [{ message: 'Control boundary' }] })
    });
    assert.equal(prepared.audit.status, status);
    assert.equal(prepared.proposals[0].eligible, false);
    const sourceOnly = ids.createIdsProject(prepared);
    assert.deepEqual(sourceOnly.rows, []);
    assert.equal(sourceOnly.idsImports[0].xml, XML);
    assert.throws(() => ids.createIdsProject(prepared, { selectedIds: ['spec:0/requirement:0'] }), /XSD|controle/);
  }
});

test('audit startup failure is explicit and still permits preserving the already read source', async () => {
  const prepared = await ids.prepareIdsFile(file(), {
    loadIdsFile: async () => fixture(),
    auditIdsDocument: async () => { throw Error('blocked wasm'); }
  });
  assert.equal(prepared.audit.status, 'unavailable');
  assert.match(prepared.audit.issues[0].message, /blocked wasm/);
  assert.deepEqual(ids.createIdsProject(prepared, { selectedIds: [] }).rows, []);
});

test('cancelled or superseded processing cannot publish a prepared document', async () => {
  const before = new AbortController();
  before.abort();
  let called = false;
  await assert.rejects(ids.prepareIdsFile(file(), {
    signal: before.signal, loadIdsFile: async () => { called = true; return fixture(); }, auditIdsDocument: async () => validAudit()
  }), { name: 'AbortError' });
  assert.equal(called, false);
  const during = new AbortController();
  await assert.rejects(ids.prepareIdsFile(file(), {
    signal: during.signal, loadIdsFile: async () => fixture(),
    auditIdsDocument: async () => { during.abort(); return validAudit(); }
  }), { name: 'AbortError' });
});

test('copied parser worker plus actual local XSD engine complete the browser-facing bridge', async t => {
  workers(t);
  const original = Blob.prototype.arrayBuffer;
  let mainReads = 0;
  Blob.prototype.arrayBuffer = function () { mainReads++; throw Error('main-thread file read'); };
  let prepared;
  try { prepared = await ids.prepareIdsFile(file(), { loadIdsFile, auditIdsDocument }); }
  finally { Blob.prototype.arrayBuffer = original; }
  assert.equal(mainReads, 0);
  assert.equal(prepared.document.xml, XML);
  assert.equal(prepared.document.id, hash(XML));
  assert.equal(prepared.document.sourceByteDigest, hash(XML));
  assert.equal(prepared.audit.status, 'valid');
  assert.equal(prepared.audit.checks.find(check => check.id === 'ifc-model').status, 'not-run');
  assert.equal(ids.createIdsProject(prepared).rows[0].Mapping_pending, 'x');
  assert(WorkerAdapter.instances.every(worker => worker.terminated));
});

test('readable XSD-invalid input stays source-only after a real schema check', async t => {
  workers(t);
  const xml = XML.replace('ifcVersion="IFC4"', '');
  const prepared = await ids.prepareIdsFile(new File([xml], 'invalid.ids'), { loadIdsFile, auditIdsDocument });
  assert.equal(prepared.audit.status, 'invalid');
  assert(prepared.audit.issues.some(issue => issue.line > 0));
  const raw = ids.createIdsProject(prepared, { selectedIds: [] });
  assert.equal(raw.idsImports[0].xml, xml);
  assert.deepEqual(raw.rows, []);
});

test('UTF-16 and reopening saved XML preserve separate text and byte identities', async t => {
  workers(t);
  const xml = XML.replace('encoding="utf-8"', 'encoding="UTF-16"');
  const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);
  const prepared = await ids.prepareIdsFile(new File([bytes], 'utf16.ids'), { loadIdsFile, auditIdsDocument });
  const raw = ids.createIdsProject(prepared, { selectedIds: [] });
  const reopened = await ids.prepareSavedIdsSource(raw.idsImports[0], raw.idsImports, { loadIdsText, auditIdsDocument });
  assert.equal(reopened.document.xml, xml);
  assert.equal(reopened.document.id, hash(xml));
  assert.equal(reopened.document.sourceByteDigest, hash(bytes));
  assert.equal(reopened.document.sourceEncoding, 'utf-16le');
  assert.equal(reopened.audit.status, 'valid');
});

test('worker absence rejects instead of silently parsing browser input on the main thread', async t => {
  const previous = globalThis.Worker;
  delete globalThis.Worker;
  t.after(() => { if (previous !== undefined) globalThis.Worker = previous; });
  let reads = 0;
  const source = { name: 'source.ids', size: XML.length, async arrayBuffer() { reads++; return new TextEncoder().encode(XML).buffer; } };
  await assert.rejects(ids.prepareIdsFile(source, { loadIdsFile, auditIdsDocument }), /achtergrondverwerking/);
  assert.equal(reads, 0);
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let index = 0; index < 100 && !predicate(); index++) await new Promise(resolve => setTimeout(resolve, 1));
  assert(predicate(), 'Expected interface state did not become available');
}
function interfaceHarness(dependencies = {}) {
  const listeners = new Map(), submits = [];
  const state = { html: '', writes: [], project: null, completed: [], form: null, manager: false };
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const dialog = {
    open: false, classList: { add() {}, remove() {} },
    addEventListener(type, handler) { const list = listeners.get(type) || []; list.push(handler); listeners.set(type, list); },
    querySelector(selector) {
      if (selector === '[name="ids-project-name"]') return state.form?.projectName || null;
      if (selector === '[name="ids-link-previous"]') return state.form?.linkPrevious || null;
      if (selector === '[data-ids-loading]') return state.form?.loading ? state.form : null;
      if (selector === '[data-ids-draft]') return state.form?.dataset.idsDraft ? state.form : null;
      if (selector.startsWith('#ids-file-form ') && state.form?.id === 'ids-file-form') return state.form.submit;
      return selector === '#' + state.form?.id ? state.form : null;
    },
    querySelectorAll() { return []; }
  };
  function showDialog(html) {
    if (state.form) state.form.isConnected = false;
    state.html = html; state.writes.push(html); dialog.open = true;
    const id = /<form[^>]* id="([^"]+)"/.exec(html)?.[1];
    const attribute = name => new RegExp(name + '="([^"]*)"').exec(html)?.[1] || '';
    const form = {
      id, isConnected: true,
      loading: html.includes('data-ids-loading'),
      dataset: { mode: attribute('data-mode'), sourceMode: attribute('data-source-mode'), workbookName: attribute('data-workbook-name'), previousId: attribute('data-previous-id'), idsDraft: attribute('data-ids-draft'), id: attribute('data-id') },
      elements: { 'ids-file': { files: [file()] } },
      submit: { disabled: false, textContent: 'Inlezen' }, error: { hidden: true, textContent: '' }, progress: { hidden: true, textContent: '' },
      querySelector(selector) { return selector === '.form-error' ? this.error : selector === '[data-ids-progress]' ? this.progress : selector === '[type="submit"]' ? this.submit : null; }
    };
    const name = /name="ids-project-name" value="([^"]*)"/.exec(html);
    if (name) form.projectName = { value: name[1] };
    const link = /name="ids-link-previous"([^>]*)/.exec(html);
    if (link) form.linkPrevious = { checked: link[1].includes('checked') };
    form.values = Object.fromEntries(['entities', 'propertySet', 'property'].map(name => [name, new RegExp('name="' + name + '" value="([^"]*)"').exec(html)?.[1] || '']));
    form.values.dataType = /<option value="([^"]+)" selected/.exec(html)?.[1] || '';
    state.form = form;
  }
  const document = { addEventListener(type, handler) { if (type === 'submit') submits.push(handler); } };
  const Factory = runInNewContext(readFileSync(new URL('../../web/test/ids-interface.js', import.meta.url), 'utf8') + '\nUDPSIdsInterface;', {
    document, AbortController, queueMicrotask, File, CSS: { escape: value => value },
    FormData: class { constructor(form) { this.form = form; } get(name) { return this.form.values[name]; } },
    UDPSProjectFiles: { save: project => JSON.stringify(project.raw) }
  });
  state.api = Factory({ dialog, showDialog, getProject: () => state.project, complete: (raw, mode) => state.completed.push({ raw, mode }),
    onModule() {}, escapeHtml: esc, sourceMode: () => state.manager, loadModule: async () => ({ ...ids, ...dependencies }) });
  state.submit = () => submits.forEach(handler => handler({ target: state.form, preventDefault() {} }));
  state.fire = (type, target) => (listeners.get(type) || []).forEach(handler => handler({ target }));
  state.close = () => { dialog.open = false; state.fire('close'); };
  state.backTo = html => { state.fire('udps:dialog-back'); showDialog(html); };
  return state;
}

test('factory startNew preserves the shell seed; a direct IDS route uses the document title', async () => {
  const prepared = ids.prepareDocument(fixture(), { audit: validAudit() });
  const h = interfaceHarness({ prepareIdsFile: async () => prepared });
  h.api.startNew('Mijn gekozen werkblad');
  h.submit(); await turn();
  assert.match(h.html, /name="ids-project-name" value="Mijn gekozen werkblad"/);
  h.api.actions['ids-new'](); h.submit(); await turn();
  assert.match(h.html, /name="ids-project-name" value="Studio IDS"/);
});

test('closing the factory dialog aborts work and suppresses an ignored-signal late result', async () => {
  const pending = deferred(), started = deferred();
  let signal;
  const h = interfaceHarness({ prepareIdsFile: (_, options) => { signal = options.signal; started.resolve(); return pending.promise; } });
  h.api.startNew('Late result');
  h.submit(); await started.promise;
  const writes = h.writes.length;
  h.close();
  assert.equal(signal.aborted, true);
  pending.resolve(ids.prepareDocument(fixture(), { audit: validAudit() }));
  await turn();
  assert.equal(h.writes.length, writes);
  assert.deepEqual(h.completed, []);
});

test('changing the selected file aborts busy work and enables a fresh read', async () => {
  const pending = deferred(), started = deferred();
  let signal;
  const h = interfaceHarness({ prepareIdsFile: (_, options) => { signal = options.signal; started.resolve(); return pending.promise; } });
  h.api.startNew('New file');
  h.submit(); await started.promise;
  const form = h.form, writes = h.writes.length;
  form.elements['ids-file'].files = [new File([XML], 'replacement.ids')];
  h.fire('change', { name: 'ids-file', dataset: {}, form });
  assert.equal(signal.aborted, true);
  assert.equal(form.submit.disabled, false);
  pending.resolve(ids.prepareDocument(fixture(), { audit: validAudit() }));
  await turn();
  assert.equal(h.writes.length, writes);
  assert.equal(form.error.hidden, true);
});

test('invalid XSD is visible, choices stay disabled and source-only saving creates no rows', async () => {
  const prepared = ids.prepareDocument(fixture(), { audit: { status: 'invalid', issues: [{ line: 1, message: '<invalid>' }] } });
  const h = interfaceHarness({ prepareIdsFile: async () => prepared });
  h.api.startNew('Invalid source');
  h.submit(); await turn();
  assert.match(h.html, /Afwijking van XSD/);
  assert.match(h.html, /Regels toevoegen is geblokkeerd/);
  assert.match(h.html, /data-ids-select="[^"]+" disabled/);
  assert.match(h.html, /&lt;invalid&gt;/);
  assert.doesNotMatch(h.html, /data-action="ids-review"/);
  h.api.actions['ids-source-only']();
  assert.equal(h.completed.length, 1);
  assert.deepEqual(h.completed[0].raw.rows, []);
  assert.equal(h.completed[0].raw.idsImports[0].xml, XML);
});

const firstId = 'spec:0/requirement:0';
async function parsed(xml, fileName = 'source.ids') {
  return ids.prepareDocument(await readIds(xml, { fileName, DOMParser, XMLSerializer }), { auditRequired: false });
}

test('revision bridge identifies modified and removed requirements without changing existing rows or reusing their choices', async () => {
  const specification = XML.slice(XML.indexOf('<specification name='), XML.indexOf('</specifications>'));
  const previous = await parsed(XML.replace('</specifications>', specification.replace('name="Door"', 'name="Window"').replace('IFCDOOR', 'IFCWINDOW').replace('Reference', 'Code') + '</specifications>'));
  const current = await parsed(XML.replace('IFCLABEL', 'IFCTEXT'), 'changed.ids');
  const choices = { [firstId]: { revitParameter: 'ExistingReference' }, 'spec:1/requirement:0': { revitParameter: 'ExistingCode' } };
  const baseData = ids.createIdsProject(previous, { decisions: choices });
  const before = structuredClone(baseData);
  const report = await ids.comparePreparedIdsSources(previous, current, choices, { rows: baseData.rows });
  assert.deepEqual(report.counts, { unchanged: 0, modified: 1, added: 0, removed: 1, ambiguous: 0 });
  assert.deepEqual(report.decisions, {});
  assert.deepEqual(report.changes.find(item => item.status === 'removed').impactedRows, [1]);
  const retained = ids.createIdsProject(current, { baseData, selectedIds: [] });
  assert.deepEqual(retained.rows, before.rows);
  assert.equal(retained.idsImports[0].xml, previous.document.xml);
  assert.equal(retained.idsImports[1].xml, current.document.xml);
  assert.equal(retained.idsImports[1].previousDocumentId, undefined);
  assert.deepEqual(baseData, before);
});

test('revision lineage is explicit, immutable and rejects missing, self or cyclic predecessors', async () => {
  const previous = await parsed(XML);
  const current = await parsed(XML.replace('Studio IDS', 'Studio IDS revision'), 'new.ids');
  const baseData = ids.createIdsProject(previous, { selectedIds: [] });
  const before = structuredClone(baseData);
  const linked = ids.createIdsProject(current, { baseData, selectedIds: [], previousDocumentId: previous.document.id });
  assert.equal(linked.idsImports[1].previousDocumentId, previous.document.id);
  assert.equal(current.document.previousDocumentId, undefined);
  assert.deepEqual(baseData, before);
  assert.throws(() => ids.createIdsProject(current, { baseData, selectedIds: [], previousDocumentId: current.document.id }), /andere IDS-bron/);
  assert.throws(() => ids.createIdsProject(current, { baseData, selectedIds: [], previousDocumentId: hash('missing') }), /andere IDS-bron/);
  assert.throws(() => ids.createIdsProject(previous, { baseData: linked, selectedIds: [], previousDocumentId: current.document.id }), /kringverwijzing/);
  const inherited = { ...current, document: { ...current.document, previousDocumentId: previous.document.id } };
  assert.equal(ids.createIdsProject(inherited, { baseData, selectedIds: [] }).idsImports[1].previousDocumentId, undefined);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(ids.comparePreparedIdsSources(previous, current, {}, { signal: controller.signal }), { name: 'AbortError' });
});

async function revisionHarness({ manager = false, audit = validAudit(), xml = XML.replace('Studio IDS', 'Studio IDS revision') } = {}) {
  const previous = ids.prepareDocument((await parsed(XML)).document, { audit: validAudit() });
  const current = ids.prepareDocument((await parsed(xml, 'revision.ids')).document, { audit });
  const raw = ids.createIdsProject(previous, { decisions: { [firstId]: { revitParameter: 'KeptReference' } } });
  const h = interfaceHarness({ prepareSavedIdsSource: async () => previous, prepareIdsFile: async () => current });
  h.manager = manager;
  h.project = { raw, sourceData: { idsImports: raw.idsImports } };
  h.api.actions['ids-source'](previous.document.id);
  await until(() => /data-action="ids-compare"/.test(h.html));
  const sourceHtml = h.html;
  h.api.actions['ids-compare']();
  assert.equal(h.form.dataset.previousId, previous.document.id);
  h.submit();
  await until(() => /aria-label="IDS-bronversies vergelijken"/.test(h.html));
  return { h, previous, current, raw, sourceHtml };
}

test('saved-source comparison is passive until choices and predecessor are explicitly selected', async () => {
  const { h, raw, previous, current } = await revisionHarness();
  assert.match(h.html, /Ongewijzigd: 1/);
  assert.match(h.html, /Regels kiezen · 0 geselecteerd/);
  assert.equal(h.form.linkPrevious.checked, false);
  h.api.actions['ids-reuse']();
  assert.match(h.html, /Ongewijzigde keuzes overgenomen/);
  assert.match(h.html, /Regels kiezen · 0 geselecteerd/);
  h.form.linkPrevious.checked = true;
  h.api.actions['ids-source-only']();
  const saved = h.completed[0].raw;
  assert.deepEqual(saved.rows, raw.rows);
  assert.equal(saved.idsImports[1].previousDocumentId, previous.document.id);
  assert.equal(saved.idsImports[1].xml, current.document.xml);
  assert.equal(saved.idsImports[1].decisions[firstId].revitParameter, 'KeptReference');
});

test('changed requirements can be reviewed in source mode while only the source is retained', async () => {
  const { h, raw, current } = await revisionHarness({ manager: true, xml: XML.replace('IFCLABEL', 'IFCTEXT') });
  assert.match(h.html, /Gewijzigd: 1/);
  assert.match(h.html, /data-action="ids-review"/);
  assert.doesNotMatch(h.html, /data-action="ids-reuse"/);
  h.api.actions['ids-review'](firstId);
  assert.equal(h.form.id, 'ids-requirement-form');
  assert.equal(h.form.values.dataType, 'Text');
  h.submit();
  assert.equal(h.form.id, 'ids-source-form');
  h.form.linkPrevious.checked = true;
  h.submit();
  assert.equal(h.completed.length, 1);
  assert.deepEqual(h.completed[0].raw.rows, raw.rows);
  assert.equal(h.completed[0].raw.idsImports[1].decisions[firstId].dataType, 'Text');
  assert.equal(h.completed[0].raw.idsImports[1].xml, current.document.xml);
});

test('comparison with invalid XSD stays source-only and an unchecked predecessor remains absent', async () => {
  const { h, raw } = await revisionHarness({ manager: true, audit: { status: 'invalid', issues: [] } });
  assert.match(h.html, /Afwijking van XSD/);
  assert.doesNotMatch(h.html, /data-action="ids-reuse"|data-action="ids-review"/);
  assert.equal(h.form.linkPrevious.checked, false);
  h.submit();
  assert.deepEqual(h.completed[0].raw.rows, raw.rows);
  assert.equal(h.completed[0].raw.idsImports[1].previousDocumentId, undefined);
});

test('back restores the saved-source draft and closing clears stale comparison actions', async () => {
  const { h, sourceHtml, previous } = await revisionHarness({ manager: true });
  h.backTo(sourceHtml); await turn();
  h.api.actions['ids-compare']();
  assert.equal(h.form.dataset.previousId, previous.document.id);
  const writes = h.writes.length;
  h.close();
  h.api.actions['ids-compare']();
  h.api.actions['ids-reuse']();
  h.api.actions['ids-source-only']();
  assert.equal(h.writes.length, writes);
  assert.deepEqual(h.completed, []);
});

test('reusing unchanged choices preserves a current manual review and leaves all rows untouched', async () => {
  const { h, raw } = await revisionHarness({ manager: true });
  h.api.actions['ids-review'](firstId);
  h.form.values.property = 'ReviewedReference';
  h.submit();
  assert.equal(h.form.id, 'ids-source-form');
  h.api.actions['ids-reuse']();
  h.submit();
  const saved = h.completed[0].raw;
  assert.equal(saved.idsImports[1].decisions[firstId].property, 'ReviewedReference');
  assert.deepEqual(saved.rows, raw.rows);
});

test('closing while the predecessor is read aborts that stage and ignores its late result', async () => {
  const previous = ids.prepareDocument(fixture(), { audit: validAudit() });
  const current = { ...previous, document: { ...previous.document, xml: XML + '<!-- revision -->', id: hash(XML + '<!-- revision -->') } };
  const raw = ids.createIdsProject(previous, { selectedIds: [] });
  const started = deferred(), pending = deferred();
  let reads = 0, signal;
  const h = interfaceHarness({
    prepareIdsFile: async () => current,
    prepareSavedIdsSource: (_, __, options) => {
      if (++reads === 1) return Promise.resolve(previous);
      signal = options.signal; started.resolve(); return pending.promise;
    }
  });
  h.project = { raw, sourceData: { idsImports: raw.idsImports } };
  h.api.actions['ids-source'](previous.document.id);
  await until(() => /data-action="ids-compare"/.test(h.html));
  h.api.actions['ids-compare'](); h.submit(); await started.promise;
  const writes = h.writes.length;
  h.close();
  assert.equal(signal.aborted, true);
  pending.resolve(previous); await turn();
  assert.equal(h.writes.length, writes);
  assert.deepEqual(h.completed, []);
});

test('factory results cannot be saved into a different workbook or editing mode', async () => {
  const { h, raw } = await revisionHarness({ manager: true });
  h.project = { raw, sourceData: { idsImports: raw.idsImports } };
  h.submit();
  assert.deepEqual(h.completed, []);
  assert.match(h.form.error.textContent, /werkblad is gewijzigd/);
  const second = await revisionHarness({ manager: true });
  second.h.manager = false;
  second.h.api.actions['ids-source-only']();
  assert.deepEqual(second.h.completed, []);
  assert.match(second.h.form.error.textContent, /werkblad is gewijzigd/);
});
