# UDPS 1.12.0 — Een project starten uit IDS

UDPS 1.12.0 laat gebruikers vanuit alleen een IDS een nieuw project starten. De gebruiker kiest wanneer de IDS-bron of de gecontroleerde selectie het actieve project wordt.

```json
{
  "schema": 1,
  "change_id": "2026-11-18-jasper-009-ids-zelfstandig-project",
  "created_at": "2026-11-18T06:18:04.625Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.12.0 laat gebruikers vanuit alleen een IDS een nieuw project starten.",
  "depends_on": [
    "2026-11-18-jasper-008-ids-versievergelijking-beoordelen"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-18-jasper-008-ids-versievergelijking-beoordelen",
      "revision": "2026-11-18-jasper-009-ids-zelfstandig-project",
      "before": {
        "evidence": "UDPS 1.11.5 opent de IDS-versievergelijking bij eisen die beoordeling vragen. Niet-eenduidige eisen staan per groep met specificaties, aantallen en eerdere exportregels. Alle eisen toont iedere eis apart. Bekijk parameter opent de bijbehorende voorwaarden. Syntaxcontrole, 281 tests en de buildingSMART-referentieproef slagen. Edge 157 bevestigde de groepering, individuele weergave, toetsenbordfocus, smalle weergave, twee MassDensity-proefregels en exacte bewaring van beide bronnen in project-JSON. Code bcaf663bb7ed6e5f23b5d22c0dea1f2fd7132d9d.",
        "next_step": "Beoordeel de classificatiefilters, de echte Revit-parameternamen en het correctieconcept voor het aangeleverde IDS. Gebruik Te beoordelen om de niet-eenduidige groepen en hun voorwaarden terug te vinden. Voor de massadichtheidseis is een Revit-parameter met een massadichtheidswaarde nodig.",
        "acceptance": "Een IDS kunnen inladen en de benodigde parameters aan Revit-parameters kunnen koppelen."
      },
      "after": {
        "acceptance": "Met een IDS als startbestand een nieuw UDPS-project maken. Alle eisen kunnen worden bekeken. Geschikte parameters kunnen in een nieuw of bestaand project aan Revit-parameters worden gekoppeld.",
        "evidence": "UDPS 1.12.0 heeft een directe ingang Nieuw project uit IDS. De algemene IDS-parser en het koppeloverzicht gebruiken een leeg conceptproject. Edge 157 testte twee officiële IDS-bestanden, bronopslag en heropenen zonder exportregels, een geweigerde projectwissel met identieke JSON-backup en een eigenschapskoppeling tot TXT en JSON. Smalle weergave en ongeldige XML zijn gecontroleerd. De 284 tests slagen. Code ce5dd8576a0de9de0068ddd50d479765b6c4c1af.",
        "next_step": "Valideer de zelfstandige route met verschillende IDS-bestanden uit de praktijk. Onderzoek hoe gebruikers bevestigde Revit-koppelingen veilig kunnen hergebruiken over projecten."
      }
    }
  ],
  "evidence": [
    "Geteste code en documentatie. https://github.com/Stefan-van-Dijk/UDPS/commit/ce5dd8576a0de9de0068ddd50d479765b6c4c1af",
    "De geautomatiseerde suite bevat de leescontrole van 334 onveranderde officiële IDS-testbestanden.",
    "De Edge-proef op 47 geverifieerde webbestanden bevestigde zowel een bron met classificatie-eis als een bron met een ondersteunde eigenschapseis."
  ]
}
```
