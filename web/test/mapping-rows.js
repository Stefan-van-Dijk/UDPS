const UDPSMappingRows = (() => {
  const text = value => value == null ? "" : String(value);
  const parameterKind = (parameter, row) => parameter.trim() ? "named" : row.implicitRevit ? "implicit" : "missing";
  const familyId = (propertySet, name) => JSON.stringify([propertySet, name]);
  const mappingId = (propertySet, name, kind, parameter) => JSON.stringify([propertySet, name, kind, parameter]);
  const defaultParameterOf = (project, row) => row.override ?? project.standards?.[row.key] ?? "";

  function build(project, { visibleIds, parameterOf = defaultParameterOf } = {}) {
    const visible = visibleIds === undefined ? null : new Set(visibleIds);
    const sections = new Map();

    for (const row of project.rows) {
      const propertySet = text(row.propertySet);
      const name = text(row.name);
      const id = familyId(propertySet, name);
      if (!sections.has(propertySet)) sections.set(propertySet, new Map());
      const families = sections.get(propertySet);
      if (!families.has(id)) families.set(id, {
        id, propertySet, name, applications: [], combinations: new Map(), standards: new Map()
      });
      const family = families.get(id);
      family.applications.push(row);

      const parameter = text(parameterOf(project, row));
      const kind = parameterKind(parameter, row);
      const combinationId = mappingId(propertySet, name, kind, parameter);
      if (!family.combinations.has(combinationId)) family.combinations.set(combinationId, {
        id: combinationId, parameter, parameterKind: kind, applications: []
      });
      family.combinations.get(combinationId).applications.push(row);

      // The blank standard still has per-application semantics: implicit IFC name or pending mapping.
      const standard = text(project.standards?.[row.key]);
      const standardKind = parameterKind(standard, row);
      const standardId = mappingId(propertySet, name, standardKind, standard);
      if (!family.standards.has(standardId)) family.standards.set(standardId, {
        id: standardId, parameter: standard, parameterKind: standardKind, keys: new Set(), representative: row
      });
      const baseline = family.standards.get(standardId);
      baseline.keys.add(row.key);
      if (!visible || visible.has(row.id)) baseline.visibleRepresentative ||= row;
    }

    const groups = [];
    for (const families of sections.values()) {
      for (const family of families.values()) {
        const visibleFamily = family.applications.filter(row => !visible || visible.has(row.id));
        if (!visibleFamily.length) continue;

        // Standards are stable context, even when only a local combination matches the current filter.
        const orderedIds = new Set([...family.standards.keys(), ...family.combinations.keys()]);
        for (const id of orderedIds) {
          const combination = family.combinations.get(id);
          const standard = family.standards.get(id);
          const allApplications = combination?.applications || [];
          const applications = allApplications.filter(row => !visible || visible.has(row.id));
          if (!standard && !applications.length) continue;
          const baseKeys = standard ? [...standard.keys] : [];
          const representative = applications[0] || allApplications[0] ||
            standard?.visibleRepresentative || standard?.representative || visibleFamily[0];
          groups.push({
            id,
            familyId: family.id,
            propertySet: family.propertySet,
            name: family.name,
            parameter: (combination || standard).parameter,
            parameterKind: (combination || standard).parameterKind,
            isStandard: Boolean(standard),
            baseKeys,
            sourceKeys: [...new Set(allApplications.map(row => row.key))],
            applications,
            allApplications,
            familyApplications: family.applications,
            representative
          });
        }
      }
    }
    return groups;
  }

  function changeParameter(project, ids, parameter) {
    const selectionError = () => new Error("Kies één of meer bestaande toepassingen.");
    if (!ids || typeof ids === "string" || typeof ids[Symbol.iterator] !== "function") throw selectionError();
    const selected = new Set(ids);
    const existingIds = new Set(project.rows.map(row => row.id));
    if (!selected.size || [...selected].some(id => !existingIds.has(id))) throw selectionError();
    if (parameter !== null && (typeof parameter !== "string" || !parameter.trim() ||
        parameter.length > 500 || /[\t\r\n]/.test(parameter))) {
      throw new Error("Vul een Revit-parameter van maximaal 500 tekens in, zonder tabs of regeleinden.");
    }
    const value = parameter === null ? null : parameter.trim();
    const rows = project.rows.map(row => selected.has(row.id) ? {
      ...row,
      override: value === null || value === text(project.standards?.[row.key]) ? null : value
    } : row);
    return { ...project, rows };
  }

  return { build, changeParameter };
})();
