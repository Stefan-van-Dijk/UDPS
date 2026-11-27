// Library validation adapted from Stefan-van-Dijk/UDPS web/libraries.js, c016b911.
// MIT license and source provenance: library-files-LICENSE.txt.
// Only pinned class data is imported; no IDS/XML parser or network is needed.
import classData from './ids/ifc-classes.mjs';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PROJECT_BYTES = 32 * 1024 * 1024;
const MAX_ROWS = 10000;
const BASE_HEADERS = ['Revit_parameter', 'IFC_parameter', 'Y/N', 'Export_tabblad', 'Data_type'];
const ENTITIES = new Set(classData.codes);
const TYPES = new Set('Area Boolean ClassificationReference ColorTemperature Count Currency ElectricalCurrent ElectricalEfficacy ElectricalVoltage Force Frequency Identifier Illuminance Integer Label Length Logical LuminousFlux LuminousIntensity MassDensity NormalisedRatio PlaneAngle PositiveLength PositivePlaneAngle PositiveRatio Power Pressure Ratio Real Text ThermalTransmittance ThermodynamicTemperature Volume VolumetricFlowRate'.split(' '));
const SOURCE_HEADERS = ['Mapping_pending', 'Mapping_origin', 'Uniform_id', 'Uniform_name', 'Uniform_revit',
  'Uniform_property', 'Uniform_propertyset', 'Uniform_datatype', 'Source_uri', 'Source_code', 'Source_name',
  'Source_version', 'Source_class', 'Source_class_uri', 'Source_dictionary', 'Source_property_dictionary',
  'Source_property_dictionary_name', 'Source_relation_uri', 'Source_contexts', 'Source_property_constraints'];
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const entityHeader = value => value.startsWith('Ifc') && !value.includes('_');
const sourceUri = library => `urn:udps:library:${encodeURIComponent(library.id)}:${encodeURIComponent(library.version)}`;

function clean(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    throw new Error(`Ongeldig veld in bibliotheek: ${label}.`);
  }
  return value.trim();
}

function validateLibrary(input) {
  if (!isRecord(input) || input.format !== 'udps-library' || input.schema !== 1 ||
      !Array.isArray(input.classes) || !input.classes.length || input.classes.length > MAX_ROWS) {
    throw new Error('Verwacht een JSON-bibliotheek met format udps-library, schema 1 en klassen.');
  }
  const id = clean(input.id, 'id'), name = clean(input.name, 'naam'), version = clean(input.version, 'versie');
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Bibliotheek-id: gebruik letters, cijfers, - of _.');
  const codes = new Set();
  let count = 0;
  const classes = input.classes.map(item => {
    if (!isRecord(item)) throw new Error('Ongeldige bibliotheekklasse.');
    const code = clean(item.code, 'klassecode');
    if (codes.has(code)) throw new Error(`Dubbele klassecode: ${code}.`);
    codes.add(code);
    if (!Array.isArray(item.ifcEntities) || !item.ifcEntities.length || item.ifcEntities.some(entity => !ENTITIES.has(entity))) {
      throw new Error(`Klasse ${code}: kies expliciete IFC-entiteiten uit de vastgezette catalogus.`);
    }
    if (!Array.isArray(item.properties) || !item.properties.length || (count += item.properties.length) > MAX_ROWS) {
      throw new Error('Een bibliotheek moet eigenschappen bevatten, met maximaal 10.000 definities.');
    }
    const seen = new Set();
    const properties = item.properties.map(property => {
      if (!isRecord(property)) throw new Error(`Ongeldige eigenschap in klasse ${code}.`);
      const propertyCode = clean(property.code, 'eigenschapcode');
      const propertySet = clean(property.propertySet, 'propertyset');
      const key = JSON.stringify([propertySet, propertyCode]);
      if (seen.has(key)) throw new Error(`Dubbele eigenschap: ${propertySet} / ${propertyCode}.`);
      seen.add(key);
      if (!TYPES.has(property.dataType)) throw new Error(`Ongeldig UDPS-datatype voor ${propertyCode}.`);
      return { code: propertyCode, name: clean(property.name || propertyCode, 'eigenschapnaam'), propertySet, dataType: property.dataType };
    });
    return { code, name: clean(item.name || code, 'klassenaam'), ifcEntities: [...new Set(item.ifcEntities)], properties };
  });
  return { format: 'udps-library', schema: 1, id, name, version, classes };
}

function propertiesFor(library) {
  const uri = sourceUri(library);
  return library.classes.flatMap(item => {
    const classUri = `${uri}:class:${encodeURIComponent(item.code)}`;
    return item.properties.map(property => {
      const id = `${classUri}:property:${encodeURIComponent(property.propertySet)}:${encodeURIComponent(property.code)}`;
      return { id, key: id, label: property.name, code: property.code, propertySet: property.propertySet,
        dataType: property.dataType, entities: [...item.ifcEntities], classCode: item.code, className: item.name,
        sourceUri: uri, classUri, relationUri: `${classUri}:relation:${encodeURIComponent(property.propertySet)}:${encodeURIComponent(property.code)}` };
    });
  });
}

/** Read a local UTF-8 JSON file. Original metadata and licence remain in source.library. */
export async function prepareLibraryFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Verwacht een lokaal JSON-bibliotheekbestand.');
  }
  if (file.size > MAX_BYTES) throw new Error('Bibliotheekbestand is groter dan 10 MiB.');
  const fileName = clean(file.name || 'Bibliotheek.json', 'bestandsnaam');
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); }
  catch { throw new Error('Het bibliotheekbestand kon niet worden gelezen. Kies het bestand opnieuw.'); }
  if (bytes.byteLength > MAX_BYTES) throw new Error('Bibliotheekbestand is groter dan 10 MiB.');
  let original;
  try { original = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')); }
  catch { throw new Error('Het bibliotheekbestand bevat geen geldige UTF-8 JSON.'); }
  const library = validateLibrary(original);
  return { library, properties: propertiesFor(library), source: {
    id: library.id, version: library.version, name: library.name, fileName, uri: sourceUri(library), library: original
  } };
}

function projectBase(input) {
  if (input === undefined) return { version: 1, headers: [...BASE_HEADERS], rows: [], mode: 'I/T', skipEmpty: true };
  if (!isRecord(input) || (input.version !== undefined && input.version !== 1) ||
      !Array.isArray(input.headers) || !Array.isArray(input.rows) || input.rows.length > MAX_ROWS ||
      !input.headers.every(header => typeof header === 'string' && !/[\t\r\n]/.test(header)) ||
      new Set(input.headers).size !== input.headers.length || !BASE_HEADERS.every(header => input.headers.includes(header)) ||
      !input.rows.every(isRecord)) throw new Error('Verwacht een geldig UDPS-project als basis voor de bibliotheektoevoeging.');
  return structuredClone(input);
}

function canonical(value) {
  return JSON.stringify(value, (_key, current) => isRecord(current)
    ? Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]])) : current);
}

function checkedProject(data) {
  if (new TextEncoder().encode(JSON.stringify(data, null, 2)).byteLength > MAX_PROJECT_BYTES) {
    throw new Error('Het project zou groter dan 32 MiB worden. Er is niets toegevoegd.');
  }
  return data;
}

/** Return a new raw UDPS project. An omitted/empty selection saves only the source.
 * Repeated identical sources may add more properties; changed id/version pairs cannot overwrite evidence.
 * Existing mappings are reused unchanged; conflicting types or other explicit source identities reject the whole addition.
 */
export function createLibraryProject(prepared, { baseData, selectedIds = [], name } = {}) {
  if (!isRecord(prepared?.source?.library)) throw new Error('Bereid eerst een JSON-bibliotheekbestand voor.');
  const library = validateLibrary(prepared.source.library);
  const source = { id: library.id, version: library.version, name: library.name,
    fileName: clean(prepared.source.fileName || 'Bibliotheek.json', 'bestandsnaam'),
    uri: sourceUri(library), library: structuredClone(prepared.source.library) };
  const selected = selectedIds instanceof Set ? [...selectedIds] : selectedIds;
  if (!Array.isArray(selected)) throw new Error('Verwacht een lijst met gekozen bibliotheekeigenschappen.');
  const properties = new Map(propertiesFor(library).map(property => [property.id, property]));
  const chosen = [...new Set(selected)].map(id => {
    if (!properties.has(id)) throw new Error('Een gekozen bibliotheekeigenschap bestaat niet meer. Lees het bestand opnieuw.');
    return properties.get(id);
  });
  if (chosen.reduce((sum, property) => sum + property.entities.length, 0) > MAX_ROWS) {
    throw new Error('De selectie bevat meer dan 10.000 IFC-koppelingen. Kies minder eigenschappen tegelijk.');
  }
  const data = projectBase(baseData);
  data.source = clean(name ?? data.source ?? library.name, 'projectnaam');
  data.version = 1;
  if (data.libraryImports !== undefined && !Array.isArray(data.libraryImports)) throw new Error('De bewaarde bibliotheekbronnen zijn ongeldig.');
  const imports = data.libraryImports || [];
  const matches = imports.filter(record => record?.id === source.id && record?.version === source.version);
  if (matches.length > 1) throw new Error('Deze bibliotheek-id en versie komen meermaals voor in het project.');
  if (matches.length && canonical(matches[0].library) !== canonical(source.library)) {
    throw new Error('Deze bibliotheek-id en versie hebben andere broninhoud. Gebruik een nieuwe versie.');
  }
  data.libraryImports = matches.length ? imports : [...imports, source];
  if (!chosen.length) return checkedProject(data);

  const headers = new Set([...data.headers, ...SOURCE_HEADERS, ...chosen.flatMap(property => property.entities)]);
  data.headers = [...headers];
  const entityHeaders = data.headers.filter(entityHeader);
  const byTarget = new Map();
  const targetKey = (propertySet, property, entity) => JSON.stringify([propertySet, property, entity]);
  for (const row of data.rows) for (const entity of entityHeaders) {
    if (row[entity] !== 'x') continue;
    const key = targetKey(String(row.Export_tabblad ?? ''), String(row.IFC_parameter ?? ''), entity);
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(row);
  }
  for (const property of chosen) {
    const missing = [];
    for (const entity of property.entities) {
      const matches = byTarget.get(targetKey(property.propertySet, property.code, entity)) || [];
      if (matches.some(row => row.Data_type !== property.dataType)) {
        throw new Error(`Datatypeconflict bij ${entity} · ${property.propertySet}.${property.code}. Er is niets toegevoegd.`);
      }
      if (matches.some(row => row.Source_uri && row.Source_uri !== property.id)) {
        throw new Error(`Het IFC-doel ${entity} · ${property.propertySet}.${property.code} heeft een andere bronkoppeling. Er is niets toegevoegd.`);
      }
      if (!matches.length) missing.push(entity);
    }
    if (!missing.length) continue;
    const context = entity => ({ propertyUri: property.id, classUri: property.classUri, className: property.className,
      dictionary: property.sourceUri, version: library.version, propertySet: property.propertySet,
      relationUri: property.relationUri, entity, origin: 'library', sourceDataType: property.dataType,
      dataType: property.dataType, constraints: { units: [], allowedValues: [], constraints: {} } });
    const row = Object.fromEntries(data.headers.map(header => [header, '']));
    Object.assign(row, {
      'Y/N': 'x', Revit_parameter: '', IFC_parameter: property.code, Export_tabblad: property.propertySet,
      Data_type: property.dataType, Mapping_pending: 'x', Mapping_origin: 'library',
      Uniform_id: property.key, Uniform_name: property.label, Uniform_revit: '', Uniform_property: property.code,
      Uniform_propertyset: property.propertySet, Uniform_datatype: property.dataType,
      Source_uri: property.id, Source_code: property.code, Source_name: property.label, Source_version: library.version,
      Source_class: property.className, Source_class_uri: property.classUri, Source_dictionary: property.sourceUri,
      Source_property_dictionary: property.sourceUri, Source_property_dictionary_name: library.name,
      Source_relation_uri: property.relationUri, Source_contexts: JSON.stringify(missing.map(context)),
      Source_property_constraints: JSON.stringify({ units: [], allowedValues: [], constraints: {} })
    });
    for (const entity of missing) {
      row[entity] = 'x';
      byTarget.set(targetKey(property.propertySet, property.code, entity), [row]);
    }
    data.rows.push(row);
    if (data.rows.length > MAX_ROWS) throw new Error('Het project zou meer dan 10.000 UDPS-regels bevatten. Er is niets toegevoegd.');
  }
  return checkedProject(data);
}
