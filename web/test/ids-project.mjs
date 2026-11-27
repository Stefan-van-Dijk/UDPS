// A bounded bridge from the existing IDS reader/planner to the click model's raw JSON.
import {
  decodeIdsBytes, readIds, mappingProposals, planIdsImport, saveIdsSource, validateIdsImports, IDS_MAX_BYTES
} from './ids/ids.mjs';
import classData from './ids/ifc-classes.mjs';

const BASE_HEADERS = ['Revit_parameter', 'IFC_parameter', 'Y/N', 'Export_tabblad', 'Data_type'];
export const IDS_ENTITY_CODES = Object.freeze([...classData.codes]);
// These are the output types accepted by the reused planner, not IFC input type names.
export const IDS_DATA_TYPES = Object.freeze('Area Boolean ClassificationReference ColorTemperature Count Currency ElectricalCurrent ElectricalEfficacy ElectricalVoltage Force Frequency Identifier Illuminance Integer Label Length Logical LuminousFlux LuminousIntensity MassDensity NormalisedRatio PlaneAngle PositiveLength PositivePlaneAngle PositiveRatio Power Pressure Ratio Real Text ThermalTransmittance ThermodynamicTemperature Volume VolumetricFlowRate'.split(' '));
export const IDS_CATALOG = Object.freeze({
  schema: classData.schema,
  checkedAt: classData.metadata.checkedAt,
  ifc: Object.freeze({
    ...classData.metadata,
    items: Object.freeze(IDS_ENTITY_CODES.map(code => Object.freeze({ kind: 'class', code })))
  })
});

function documentOf(prepared) {
  const document = prepared?.document;
  if (!document || typeof document !== 'object' || !Array.isArray(document.specifications)) {
    throw new Error('Bereid eerst een leesbaar IDS-bestand voor.');
  }
  return document;
}

/** Reassess the full source, including unresolved and non-property facets. */
export function idsMappingsAllowed(prepared) {
  return prepared?.auditRequired !== true || prepared.audit?.status === 'valid';
}

export function proposalsFor(prepared, decisions = {}) {
  const proposals = mappingProposals(documentOf(prepared), prepared.catalog || IDS_CATALOG, decisions);
  if (idsMappingsAllowed(prepared)) return proposals;
  return proposals.map(proposal => ({
    ...proposal, eligible: false, direct: false,
    reasons: ['Voeg pas regels toe nadat de lokale IDS 1.0-XSD-controle is geslaagd.', ...(proposal.reasons || [])]
  }));
}

function countsFor(document, proposals) {
  return {
    specifications: document.specifications.length,
    requirements: proposals.length,
    direct: proposals.filter(proposal => proposal.direct).length,
    eligible: proposals.filter(proposal => proposal.eligible).length,
    review: proposals.filter(proposal => proposal.kind === 'property' && !proposal.direct).length,
    sourceOnly: proposals.filter(proposal => proposal.kind !== 'property').length,
    warnings: document.warnings?.length || 0
  };
}

/** Compile the existing reader's complete document; never invent source XML. */
export function prepareDocument(document, { audit, auditRequired = true } = {}) {
  const prepared = { document, catalog: IDS_CATALOG, audit: audit || unavailableAudit('De XSD-controle is niet uitgevoerd.'), auditRequired };
  documentOf(prepared);
  const proposals = proposalsFor(prepared);
  return { ...prepared, proposals, counts: countsFor(document, proposals) };
}

function abortError() {
  const error = new Error('IDS-verwerking geannuleerd.');
  error.name = 'AbortError';
  return error;
}

function checkAbort(signal) { if (signal?.aborted) throw abortError(); }

function unavailableAudit(message) {
  return { status: 'unavailable', complete: false, schema: 'IDS 1.0',
    checks: [{ id: 'xsd', status: 'unavailable' }],
    issues: [{ severity: 'warning', code: 'AUDIT_UNAVAILABLE', message }] };
}

function checkedAudit(report) {
  if (!report || !['valid', 'invalid', 'unavailable', 'unsupported'].includes(report.status)) {
    return unavailableAudit('De lokale XSD-controle gaf geen herkenbaar resultaat.');
  }
  const xsd = report.checks?.find(check => check.id === 'xsd');
  if (xsd && xsd.status !== report.status) return unavailableAudit('De XSD-controlestatus is niet eenduidig.');
  return { ...report, complete: false, issues: Array.isArray(report.issues) ? report.issues : [] };
}

function pureReaderTest(options) {
  const node = typeof process === 'object' && Boolean(process.versions?.node) && typeof globalThis.window === 'undefined';
  if (options.testMode === true && !node) throw new Error('De pure IDS-lezer is alleen beschikbaar voor Node-tests.');
  // Preserve the pre-existing no-options Node fixtures. Browser callers always
  // use the copied worker, including browsers without Worker support.
  return options.testMode === true || node && Object.keys(options).length === 0 && typeof globalThis.Worker !== 'function';
}

function checkedOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Ongeldige IDS-verwerkingsopties.');
  return options;
}

async function auditedDocument(document, options) {
  checkAbort(options.signal);
  options.onProgress?.({ stage: 'auditing', message: 'Lokale IDS 1.0-XSD-controle uitvoeren…' });
  let audit;
  try {
    const inspect = options.auditIdsDocument || (await import('./production/ids-audit.js')).auditIdsDocument;
    checkAbort(options.signal);
    audit = checkedAudit(await inspect(document, { signal: options.signal, timeoutMs: options.auditTimeoutMs }));
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    audit = unavailableAudit(error?.message || 'De lokale XSD-controle is niet beschikbaar.');
  }
  checkAbort(options.signal);
  return prepareDocument(document, { audit });
}

/** File bytes, decoding and parsing remain in the existing production worker. */
export async function prepareIdsFile(file, options = {}) {
  checkedOptions(options);
  checkAbort(options.signal);
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Verwacht een lokaal IDS-bestand.');
  }
  if (file.size > IDS_MAX_BYTES) throw new Error('IDS-bestand is groter dan 10 MiB.');
  const fileName = file.name || 'Ingeladen.ids';
  // The saved source record uses the tighter 500-character identity bound.
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 500 || /[\u0000-\u001f\u007f-\u009f]/.test(fileName)) {
    throw new Error('Ongeldige IDS-bestandsnaam.');
  }
  if (pureReaderTest(options)) {
    let bytes;
    try { bytes = await file.arrayBuffer(); }
    catch { throw new Error('Het lokale IDS-bestand kon niet worden gelezen. Kies het bestand opnieuw.'); }
    checkAbort(options.signal);
    const { xml, encoding, byteDigest } = await decodeIdsBytes(bytes);
    const document = await readIds(xml, { fileName, sourceEncoding: encoding, sourceByteDigest: byteDigest });
    checkAbort(options.signal);
    return prepareDocument(document, { auditRequired: false });
  }
  const read = options.loadIdsFile || (await import('./production/ids-loader.js')).loadIdsFile;
  checkAbort(options.signal);
  const document = await read(file, { fileName, signal: options.signal, onProgress: options.onProgress, timeoutMs: options.timeoutMs });
  return auditedDocument(document, options);
}

/** Saved XML is already decoded. Re-encoding it as a synthetic File would corrupt
 * its relationship with declarations such as UTF-16 or windows-1252.
 * Choices stay on the saved record and can be passed separately to proposalsFor.
 */
export async function prepareSavedIdsSource(source, allSources = [source], options = {}) {
  checkedOptions(options);
  checkAbort(options.signal);
  const sources = validateIdsImports(allSources);
  const record = sources?.find(candidate => candidate.id === source?.id);
  if (!record) throw new Error('De gekozen IDS-bron ontbreekt in dit project.');
  const context = {
    fileName: record.fileName,
    sourceEncoding: record.sourceEncoding,
    sourceByteDigest: record.sourceByteDigest,
    signal: options.signal, onProgress: options.onProgress, timeoutMs: options.timeoutMs
  };
  const pure = pureReaderTest(options);
  const read = pure ? readIds : options.loadIdsText || (await import('./production/ids-loader.js')).loadIdsText;
  checkAbort(options.signal);
  const document = await read(record.xml, context);
  checkAbort(options.signal);
  if (document.id !== record.id) throw new Error('De opgeslagen IDS-bronidentiteit past niet bij de XML-inhoud.');
  return pure ? prepareDocument(document, { auditRequired: false }) : auditedDocument(document, options);
}

/** Keep revision identity and decision reuse in the existing production helper.
 * A comparison is passive evidence: it never applies or removes project rows.
 */
export async function comparePreparedIdsSources(previous, current, previousDecisions = {}, options = {}) {
  checkedOptions(options);
  checkAbort(options.signal);
  const compare = (await import('./production/ids-revisions.js')).compareIdsRevisions;
  checkAbort(options.signal);
  const report = compare(documentOf(previous), documentOf(current), previousDecisions, { rows: options.rows });
  checkAbort(options.signal);
  return report;
}

function projectBase(baseData) {
  if (baseData === undefined) return { version: 1, headers: [...BASE_HEADERS], rows: [], mode: 'I/T', skipEmpty: true };
  if (!baseData || typeof baseData !== 'object' || Array.isArray(baseData) ||
      (baseData.version !== undefined && baseData.version !== 1) ||
      !Array.isArray(baseData.headers) || !Array.isArray(baseData.rows) || baseData.rows.length > 10000 ||
      !baseData.headers.every(header => typeof header === 'string' && !/[\t\r\n]/.test(header)) ||
      new Set(baseData.headers).size !== baseData.headers.length ||
      !BASE_HEADERS.every(header => baseData.headers.includes(header)) ||
      !baseData.rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) {
    throw new Error('Verwacht een geldig UDPS-project als basis voor de IDS-toevoeging.');
  }
  return structuredClone(baseData);
}

/**
 * Produce a raw project atomically. Omitted selection chooses the source's direct
 * properties; an explicit empty array/Set retains only the full source and choices.
 * Existing mappings and their Revit names follow the upstream reuse/conflict rules.
 */
export function createIdsProject(prepared, options = {}) {
  const document = { ...documentOf(prepared) };
  // The caller must explicitly choose a retained predecessor; a parsed document
  // or a coincidental file name is never authority for a new source relation.
  delete document.previousDocumentId;
  const { name, decisions = {}, baseData } = options;
  const data = projectBase(baseData);
  if (options.previousDocumentId !== undefined) {
    const sources = validateIdsImports(data.idsImports) || [];
    if (options.previousDocumentId === document.id || !sources.some(item => item.id === options.previousDocumentId)) {
      throw new Error('Kies een bestaande andere IDS-bron als vorige versie.');
    }
    document.previousDocumentId = options.previousDocumentId;
  }
  const source = name ?? data.source ?? document.title ?? document.fileName;
  if (typeof source !== 'string' || !source.trim()) throw new Error('Geef het UDPS-project een naam.');
  data.version = 1;
  data.source = source;
  const selected = options.selectedIds === undefined
    ? proposalsFor(prepared).filter(proposal => proposal.direct).map(proposal => proposal.id)
    : options.selectedIds instanceof Set ? [...options.selectedIds] : options.selectedIds;
  if (!Array.isArray(selected)) throw new Error('Verwacht een lijst met geselecteerde IDS-eisen.');
  if (selected.length && !idsMappingsAllowed(prepared)) {
    throw new Error('De lokale XSD-controle is niet geslaagd. Bewaar deze IDS alleen als bron.');
  }
  if (!selected.length) {
    saveIdsSource(data, document, decisions);
    return data;
  }
  return planIdsImport(data, prepared.catalog || IDS_CATALOG, document, selected, decisions).project;
}
