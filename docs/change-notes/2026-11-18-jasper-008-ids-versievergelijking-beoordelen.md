# UDPS 1.11.5 — IDS-versievergelijking beoordelen

UDPS 1.11.5 toont IDS-eisen die beoordeling vragen en geeft toegang tot hun voorwaarden. Gelijke eisen blijven afzonderlijk terug te vinden via **Alle eisen**.

```json
{
  "schema": 1,
  "change_id": "2026-11-18-jasper-008-ids-versievergelijking-beoordelen",
  "created_at": "2026-11-18T00:01:39.890Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.11.5 toont IDS-eisen die beoordeling vragen en geeft toegang tot hun voorwaarden.",
  "depends_on": [
    "2026-11-18-jasper-007-ids-massdensity"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-18-jasper-007-ids-massdensity",
      "revision": "2026-11-18-jasper-008-ids-versievergelijking-beoordelen",
      "before": {
        "evidence": "UDPS 1.11.4 vertaalt IFCMASSDENSITYMEASURE uit IDS naar MassDensity in het TXT-bestand voor de Revit IFC-exporter. De gekozen Revit-parameter en het datatype blijven bewaard in project-JSON. Autodesk-broncode van IFC_v24.3.40 en IFC_v25.4.40 bevestigt het type en het pad naar IfcMassDensityMeasure. Syntaxcontrole en 279 tests slagen. Edge 157 bevestigde XSD, het automatische voorstel, de TXT-download en bytegelijke TXT-uitvoer na het terugzetten van de werkelijke JSON-backup. De browserproef gebruikte een synthetische IDS en een proefparametertitel. Code 757c2704ba1f7534939f3cd8e1db3f54a4424bf3.",
        "next_step": "Beoordeel de toepassingsfilters, de echte Revit-parameternamen en de inhoudelijke bronpunten bij het bedrijfsbestand. Voor een massadichtheidseis moet de bron het juiste IDS-type declareren en de gekoppelde Revit-parameter een massadichtheidswaarde bevatten. De collega-aansluiting blijft een aparte taak."
      },
      "after": {
        "evidence": "UDPS 1.11.5 opent de IDS-versievergelijking bij eisen die beoordeling vragen. Niet-eenduidige eisen staan per groep met specificaties, aantallen en eerdere exportregels. Alle eisen toont iedere eis apart. Bekijk parameter opent de bijbehorende voorwaarden. Syntaxcontrole, 281 tests en de buildingSMART-referentieproef slagen. Edge 157 bevestigde de groepering, individuele weergave, toetsenbordfocus, smalle weergave, twee MassDensity-proefregels en exacte bewaring van beide bronnen in project-JSON. Code bcaf663bb7ed6e5f23b5d22c0dea1f2fd7132d9d.",
        "next_step": "Beoordeel de classificatiefilters, de echte Revit-parameternamen en het correctieconcept voor het aangeleverde IDS. Gebruik Te beoordelen om de niet-eenduidige groepen en hun voorwaarden terug te vinden. Voor de massadichtheidseis is een Revit-parameter met een massadichtheidswaarde nodig."
      }
    }
  ],
  "evidence": [
    "Broncode en contracten op https://github.com/Stefan-van-Dijk/UDPS/commit/bcaf663bb7ed6e5f23b5d22c0dea1f2fd7132d9d .",
    "281 automatische tests, inclusief regressies voor gelijke eisen, brede groepen met verschillende eigenschappen en afzonderlijke toepassingsvoorwaarden. De buildingSMART-referentieproef distingueert geldige IDS, schemafouten en inhoudsfouten.",
    "Edge 157 bevestigde het weergegeven resultaat op 47 gecontroleerde webbestanden met een representatieve IDS. De proef controleerde het filter, de focus op de voorwaarden via het toetsenbord, de smalle weergave en TXT- en JSON-export met proefgegevens."
  ]
}
```
