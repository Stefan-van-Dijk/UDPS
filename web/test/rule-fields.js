const UDPSRuleFields = (() => {
  "use strict";

  const text = value => typeof value === "string" ? value.trim() : "";
  const evidence = value => Array.isArray(value) ? value.length > 0 : value != null && (typeof value !== "string" || Boolean(value.trim()));
  const records = (project, key) => {
    const value = project?.sourceData?.[key] ?? project?.[key];
    return Array.isArray(value) ? value.filter(record => record && typeof record === "object") : [];
  };
  const own = () => ({ linked: false, kind: "own", label: "Eigen regel", available: false });
  const originKey = value => JSON.stringify([
    value.kind, value.sourceId || "", value.sourceVersion || "", value.sourceUri || "", value.demo || false,
    value.sourceId || value.sourceUri ? "" : value.label
  ]);

  function distinctOrigins(values) {
    const result = new Map();
    for (const value of values) {
      const key = originKey(value);
      if (!result.has(key)) result.set(key, value);
    }
    return [...result.values()];
  }

  function contexts(project, row) {
    const result = row && typeof row === "object" ? [row] : [];
    const originals = project?.sourceData?.rows;
    if (Array.isArray(originals) && Number.isInteger(row?.sourceIndex) && row.sourceIndex >= 0 &&
        row.sourceIndex < originals.length && originals[row.sourceIndex] && typeof originals[row.sourceIndex] === "object") {
      result.push(originals[row.sourceIndex]);
    }
    return result;
  }

  function idsOrigins(project, value) {
    if (!evidence(value)) return [];
    let references;
    try { references = typeof value === "string" ? JSON.parse(value) : value; }
    catch { references = null; }
    if (!Array.isArray(references)) return [{ linked: true, kind: "ids", label: "IDS · bronverwijzing niet leesbaar", available: false }];
    if (!references.length) return [];
    const ids = [...new Set(references.map(reference => text(reference?.documentId)).filter(Boolean))];
    const result = ids.map(id => {
      const matches = records(project, "idsImports").filter(source => source.id === id);
      const source = matches.length === 1 ? matches[0] : null;
      const available = Boolean(source && text(source.fileName));
      return {
        linked: true, kind: "ids", label: source && text(source.fileName) ? `IDS · ${source.fileName}` : "IDS · bron ontbreekt of is niet eenduidig",
        sourceId: id, available,
        ...(available ? { navigation: { action: "ids-source", value: id } } : {})
      };
    });
    if (references.some(reference => !text(reference?.documentId))) {
      result.push({ linked: true, kind: "ids", label: "IDS · onvolledige bronverwijzing", available: false });
    }
    return result;
  }

  function sourceOrigin(project, context, marker) {
    const propertyUri = text(context.Source_uri);
    const dictionary = text(context.Source_dictionary);
    const version = text(context.Source_version);
    const matches = records(project, "libraryImports").filter(source => {
      const uri = text(source.uri);
      return uri && (!version || source.version === version) &&
        (dictionary === uri || propertyUri === uri || propertyUri.startsWith(`${uri}:class:`));
    });
    const library = matches.length === 1 ? matches[0] : null;
    const libraryEvidence = marker === "library" || matches.length > 0 ||
      [propertyUri, dictionary].some(uri => uri.startsWith("urn:udps:library:"));
    const sourceUri = library ? library.uri : dictionary || propertyUri;
    const sourceVersion = library ? text(library.version) : version;
    const name = library ? text(library.name) || text(library.library?.name) : text(context.Source_property_dictionary_name);
    const available = Boolean(library && text(library.id) && text(library.version) && library.library);
    return {
      linked: true, kind: libraryEvidence ? "library" : "source",
      label: libraryEvidence ? `Bibliotheek${name ? ` · ${name}` : ""}${sourceVersion ? ` · ${sourceVersion}` : ""}`
        : name || dictionary || propertyUri || "Bron · herkomst niet leesbaar",
      available,
      ...(library && text(library.id) ? { sourceId: library.id } : {}),
      ...(sourceVersion ? { sourceVersion } : {}),
      ...(sourceUri ? { sourceUri } : {}),
      ...(propertyUri ? { propertyUri } : {}),
      ...(available ? { navigation: { action: "library-source", value: JSON.stringify([library.id, library.version]) } } : {})
    };
  }

  /** Provenance is evidence, not a filename heuristic. A sourceIndex only locates
   * possible raw context; missing context never invents a source connection.
   */
  function origin(project, row) {
    const found = [];
    const markers = [];
    for (const context of contexts(project, row)) {
      found.push(...idsOrigins(project, context.IDS_requirements));
      const marker = text(context.Mapping_origin);
      const hasSource = evidence(context.Source_uri) || evidence(context.Source_dictionary);
      if (hasSource) found.push(sourceOrigin(project, context, marker));
      if (evidence(context.Mapping_origin)) markers.push({ marker, context });
    }
    if (markers.some(({ marker }) => marker === "ids") && !found.some(value => value.kind === "ids")) {
      found.push({ linked: true, kind: "ids", label: "IDS · bronverwijzing ontbreekt", available: false });
    }
    if (markers.some(({ marker }) => marker === "library") && !found.some(value => value.kind === "library")) {
      found.push(sourceOrigin(project, markers.find(({ marker }) => marker === "library").context, "library"));
    }
    if (!found.length && markers.length) {
      const marker = markers[0].marker;
      found.push({ linked: true, kind: "source", label: marker ? `Bron · ${marker}` : "Bron · herkomst niet leesbaar", available: false });
    }
    // These two exact markers belong to the bundled, direct demo source rows.
    // Imported JSON rows get a filename in row.source, so do not use that fallback.
    if (!Number.isInteger(row?.sourceIndex)) {
      if (row?.source === "Voorbeeld-IDS") found.push({ linked: true, kind: "ids", label: "Voorbeeld-IDS", demo: true, available: true });
      if (row?.source === "IFC 4.3") found.push({ linked: true, kind: "library", label: "IFC 4.3", demo: true, available: true });
    }
    const origins = distinctOrigins(found);
    if (!origins.length) return { ...own(), origins: [] };
    if (origins.length === 1) return { ...origins[0], origins };
    return {
      linked: true, kind: origins[0].kind,
      label: [...new Set(origins.map(value => value.label))].join(" · "),
      available: origins.some(value => value.available), origins
    };
  }

  /** Any protected application protects the schema of the combined visible row. */
  function info(project, rows = []) {
    if (!Array.isArray(rows)) throw new Error("Verwacht een lijst met toepassingen.");
    const items = rows.map(row => origin(project, row));
    const linked = items.some(item => item.linked);
    const types = [...new Set(rows.map(row => typeof row?.type === "string" ? row.type : ""))];
    const origins = distinctOrigins(items.flatMap(item => item.linked ? item.origins : [own()]));
    return {
      linked, editable: rows.length > 0 && !linked, origins, types,
      mixedTypes: types.length > 1,
      protectedIds: rows.filter((_row, index) => items[index].linked).map(row => row.id)
    };
  }

  function allowedCodes(allowedTypes) {
    if (allowedTypes && typeof allowedTypes !== "string" && typeof allowedTypes[Symbol.iterator] === "function") {
      return new Set(allowedTypes);
    }
    if (allowedTypes && typeof allowedTypes === "object") return new Set(Object.keys(allowedTypes));
    return new Set();
  }

  /** Validate the whole selection before making a new wrapper. Only type changes;
   * keys, overrides, activation, standards and opaque provenance keep their values.
   */
  function changeType(project, ids, type, allowedTypes) {
    const selectionError = () => new Error("Kies één of meer eenduidige bestaande toepassingen.");
    if (!project || !Array.isArray(project.rows) || !ids || typeof ids === "string" || typeof ids[Symbol.iterator] !== "function") throw selectionError();
    const selected = new Set(ids);
    if (!selected.size || [...selected].some(id => typeof id !== "string" || !id)) throw selectionError();
    const selectedRows = project.rows.filter(row => row && selected.has(row.id));
    const foundIds = new Set(selectedRows.map(row => row.id));
    if (selectedRows.length !== selected.size || foundIds.size !== selected.size) throw selectionError();
    if (typeof type !== "string" || !type || type !== type.trim() || !allowedCodes(allowedTypes).has(type)) {
      throw new Error("Kies een ondersteund UDPS-datatype uit de lijst.");
    }
    if (info(project, selectedRows).linked) {
      throw new Error("Het datatype van een brongebonden regel kan niet worden gewijzigd. De Revit-parameter en exportdeelname blijven bewerkbaar.");
    }
    return { ...project, rows: project.rows.map(row => selected.has(row.id) ? { ...row, type } : row) };
  }

  return Object.freeze({ origin, info, changeType });
})();
