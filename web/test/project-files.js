const UDPSProjectFiles = (() => {
  const baseHeaders = ["Revit_parameter", "IFC_parameter", "Y/N", "Export_tabblad", "Data_type"];
  const uniformHeaders = ["Uniform_id", "Uniform_name", "Uniform_revit", "Uniform_property", "Uniform_propertyset", "Uniform_datatype"];
  const isEntity = header => header.startsWith("Ifc") && !header.includes("_");
  const isRecord = value => value && typeof value === "object" && !Array.isArray(value);
  const parameterOf = (project, row) => row.override ?? project.standards[row.key] ?? "";
  // Older UDPS files used these aliases; preserve stored source values, emit Revit's actual codes.
  const exportDataType = code => code === "ElectricalCurrent" ? "ElectricCurrent" : code === "ElectricalVoltage" ? "ElectricVoltage" : code;
  const propertyKey = (row, index) => row.Uniform_id || row.Source_uri || `row:${index}`;

  function open(text, fileName) {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch { throw new Error("Het bestand bevat geen geldige JSON."); }
    const { headers, rows } = data ?? {};
    if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length > 10000 ||
        !headers.every(header => typeof header === "string" && !/[\t\r\n]/.test(header)) ||
        !baseHeaders.every(header => headers.includes(header)) || !rows.every(isRecord)) {
      throw new Error("Kies een UDPS-projectbestand (.json) met de vereiste koppelingkolommen.");
    }
    if (data.version !== undefined && data.version !== 1) {
      throw new Error("Deze versie van het UDPS-projectbestand wordt niet ondersteund.");
    }
    const context = data.studioContext;
    if (context !== undefined && (!isRecord(context) || context.schema !== 1 ||
        typeof context.bookId !== "string" || !context.bookId || context.bookId.length > 200 ||
        !(context.basisVersion == null || typeof context.basisVersion === "string") ||
        !(context.baseProject == null || (isRecord(context.baseProject) && Array.isArray(context.baseProject.rows) && isRecord(context.baseProject.standards))))) {
      throw new Error("Het werkblad bevat ongeldige Studio-basisgegevens.");
    }
    const usedApplicationIds = new Set();
    const normalizedHeaders = headers.map(header => header === "IfcWindowsw" ? "IfcWindow" : header);
    if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
      throw new Error("Het projectbestand bevat dubbele kolomnamen.");
    }
    const sourceRows = rows.map(row => Object.fromEntries(headers.map((header, index) => [
      normalizedHeaders[index], String(Object.hasOwn(row, header) ? row[header] ?? "" : "")
    ])));
    const entityHeaders = normalizedHeaders.filter(isEntity);
    const sourceGroups = Map.groupBy(sourceRows.map((row, index) => ({ row, index })), item => propertyKey(item.row, item.index));
    const standards = Object.fromEntries([...sourceGroups].map(([key, group]) => {
      const first = group[0].row;
      const sameParameter = group.every(({ row }) => row.Revit_parameter === first.Revit_parameter);
      // A saved standard remains explicit even when the datatype still needs repair.
      const hasSavedStandard = (normalizedHeaders.includes("Uniform_revit") &&
        Object.hasOwn(rows[group[0].index], "Uniform_revit")) || Boolean(first.Uniform_datatype);
      const standard = hasSavedStandard ? first.Uniform_revit || "" : sameParameter ? first.Revit_parameter : "";
      return [`udps:${key}`, standard];
    }));
    const name = String(data.source || fileName.replace(/\.json$/i, "") || "UDPS-project");
    const studioMaps = sourceRows.map(row => {
      if (!context || !row.Studio_application_ids) return {};
      let ids;
      try { ids = JSON.parse(row.Studio_application_ids); }
      catch { throw new Error("Het werkblad bevat ongeldige Studio-regelidentiteiten."); }
      if (!isRecord(ids)) throw new Error("Het werkblad bevat ongeldige Studio-regelidentiteiten.");
      return ids;
    });
    const reservedIds = new Set(studioMaps.flatMap(ids => Object.values(ids)));
    const applications = sourceRows.flatMap((row, index) => {
      const key = `udps:${propertyKey(row, index)}`;
      const studioIds = studioMaps[index];
      return entityHeaders.filter(entity => row[entity] === "x").map(entity => {
        let id = studioIds[entity] ?? `udps-${index}-${entity}`;
        if (context && studioIds[entity] === undefined) {
          let suffix = 0;
          while (reservedIds.has(id) || usedApplicationIds.has(id)) id = `studio-added-${index}-${entity}-${++suffix}`;
        }
        if (typeof id !== "string" || !id || id.length > 500 || usedApplicationIds.has(id)) throw new Error("Het werkblad bevat dubbele of ongeldige regelidentiteiten.");
        usedApplicationIds.add(id);
        return ({
        id,
        entity,
        propertySet: row.Export_tabblad,
        name: row.IFC_parameter,
        label: row.Uniform_name || row.Source_name || row.Source_code || row.IFC_parameter,
        type: row.Data_type,
        key,
        source: row.Source_name || row.Source_dictionary || fileName,
        sourceIndex: index,
        classification: row.Classification || row.Source_class || "",
        override: row.Revit_parameter === standards[key] ? null : row.Revit_parameter,
        implicitRevit: row.Mapping_pending !== "x" && !row.Revit_parameter.trim(),
        active: row["Y/N"] === "x"
      }); });
    });
    const sourceData = { ...data, headers: normalizedHeaders, rows: sourceRows };
    delete sourceData.studioContext;
    return { name, standards, rows: applications, sourceData, ...(context ? { studioContext: structuredClone(context) } : {}) };
  }

  function removeApplications(project, ids = []) {
    const selected = new Set(ids);
    const rows = project.rows.filter(row => !selected.has(row.id));
    const remainingSources = new Set(rows.map(row => row.sourceIndex));
    const sourceCount = project.sourceData?.rows?.length || 0;
    const isSourceIndex = index => Number.isInteger(index) && index >= 0 && index < sourceCount;
    const removedSourceIndices = new Set((project.removedSourceIndices || []).filter(isSourceIndex));
    for (const row of project.rows) {
      if (selected.has(row.id) && isSourceIndex(row.sourceIndex) && !remainingSources.has(row.sourceIndex)) {
        removedSourceIndices.add(row.sourceIndex);
      }
    }
    // Restored applications represent their source row again; the UI owns undo records.
    for (const index of remainingSources) removedSourceIndices.delete(index);
    return { ...project, rows, removedSourceIndices: [...removedSourceIndices].sort((a, b) => a - b) };
  }

  function save(project) {
    const originals = project.sourceData?.rows || [];
    // Reuse the import identity without attaching source-class evidence to an own application.
    const centralIdentities = new Map(originals.map((original, index) => {
      const key = `udps:${propertyKey(original, index)}`;
      return [key, original.Uniform_id || original.Source_uri || `klikmodel:${key}`];
    }));
    const removedSourceIndices = new Set(project.removedSourceIndices || []);
    const existing = Map.groupBy(project.rows.filter(row => Number.isInteger(row.sourceIndex)), row => row.sourceIndex);
    const newRows = Map.groupBy(project.rows.filter(row => !Number.isInteger(row.sourceIndex)), row => row.key);
    const headers = [...new Set([
      ...(project.sourceData?.headers || baseHeaders), ...uniformHeaders, "Mapping_pending",
      ...(project.rows.some(row => row.classification) ? ["Classification"] : []),
      ...(project.studioContext ? ["Studio_application_ids"] : []),
      ...project.rows.map(row => row.entity)
    ])];
    const hasClassification = headers.includes("Classification");
    const entityHeaders = headers.filter(isEntity);
    const firstByGroup = Map.groupBy(project.rows, row => row.key);
    function makeRows(applications, original = {}) {
      const classification = row => row.classification ?? original.Classification ?? original.Source_class ?? "";
      return [...Map.groupBy(applications, row => JSON.stringify([
        row.propertySet, row.name, row.type, parameterOf(project, row), row.active, Boolean(row.implicitRevit), classification(row)
      ])).values()].map(variants => {
        const row = variants[0];
        const first = firstByGroup.get(row.key)[0];
        const parameter = parameterOf(project, row);
        const output = {
          ...original,
          "Y/N": row.active ? "x" : original["Y/N"] === "x" ? "" : original["Y/N"] || "",
          IFC_parameter: row.name,
          Export_tabblad: row.propertySet,
          Data_type: row.type,
          Revit_parameter: parameter,
          Mapping_pending: !parameter.trim() && !row.implicitRevit ? "x" : "",
          ...(project.studioContext ? { Studio_application_ids: JSON.stringify(Object.fromEntries(variants.map(item => [item.entity,item.id]))) } : {}),
          Uniform_id: original.Uniform_id || (original.Source_uri ? "" : centralIdentities.get(row.key) || `klikmodel:${row.key}`),
          Uniform_name: original.Uniform_name || first.label,
          Uniform_revit: project.standards[row.key] ?? "",
          Uniform_property: original.Uniform_property || first.name,
          Uniform_propertyset: original.Uniform_propertyset || first.propertySet,
          Uniform_datatype: original.Uniform_datatype || first.type,
          ...(hasClassification ? { Classification: classification(row) } : {})
        };
        for (const entity of entityHeaders) if (output[entity] === "x") output[entity] = "";
        for (const application of variants) output[application.entity] = "x";
        return output;
      });
    }
    // A source row without applications is retained unless deletion was explicit.
    const projected = originals.flatMap((row, index) => existing.has(index)
      ? makeRows(existing.get(index), row) : removedSourceIndices.has(index) ? [] : [row]);
    for (const applications of newRows.values()) projected.push(...makeRows(applications));
    if (projected.length > 10000) throw new Error("Dit project bevat na het opsplitsen meer dan 10.000 UDPS-regels.");
    const rows = projected.map(row => Object.fromEntries(headers.map(header => [header, Object.hasOwn(row, header) ? row[header] : ""])));
    return JSON.stringify({ ...project.sourceData, version: 1, source: project.name, headers, rows, mode: "I/T", skipEmpty: true,
      ...(project.studioContext ? { studioContext: project.studioContext } : {}) }, null, 2);
  }

  function exportText(project) {
    const groups = Map.groupBy(project.rows.filter(row => row.active), row => JSON.stringify([row.propertySet, row.entity]));
    const blocks = [...groups.values()];
    const compare = new Intl.Collator("nl", { numeric: true, sensitivity: "base" }).compare;
    const sorting = project.sourceData?.exportOrder;
    const classification = row => row.classification || "\uffff";
    const blockClass = rows => rows.map(classification).sort(compare)[0];
    blocks.sort((a, b) => {
      const bySet = compare(a[0].propertySet, b[0].propertySet);
      const byEntity = compare(a[0].entity, b[0].entity);
      if (sorting === "entity") return byEntity || bySet;
      if (sorting === "classification") return compare(blockClass(a), blockClass(b)) || bySet || byEntity;
      return bySet || byEntity;
    });
    const lines = ["# User Defined PropertySet Definition File", "# Generator: Jasper Kempen & Stefan van Dijk", "# UDPS Studio", "#"];
    for (const block of blocks) {
      const first = block[0];
      lines.push(["PropertySet:", first.propertySet, "I/T", first.entity].join("\t"));
      if (sorting === "classification") block.sort((a, b) => compare(classification(a), classification(b)) || compare(a.name, b.name));
      for (const row of block) lines.push(["", row.name, exportDataType(row.type), parameterOf(project, row)].join("\t"));
    }
    return lines.join("\r\n") + "\r\n";
  }

  return { open, save, exportText, parameterOf, removeApplications, exportDataType };
})();
