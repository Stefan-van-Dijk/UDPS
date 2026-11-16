# Sjabloon voor een nieuwe change note

Kopieer dit naar een nieuw, uniek bestand in `docs/change-notes/`. Vervang alle voorbeeldwaarden. Dit sjabloon zelf is geen gepubliceerde projectwijziging.

```json
{
  "schema": 1,
  "change_id": "YYYY-MM-DD-actor-uniek",
  "created_at": "YYYY-MM-DDTHH:MM:SSZ",
  "actor": "eigen-actor",
  "kind": "task-update",
  "summary": "Welke concrete projecttoestand verandert en waarom?",
  "depends_on": ["vorige-change-id"],
  "operations": [
    {
      "entity_id": "UDPS-T-actor-uniek",
      "entity_type": "task",
      "base_revision": "vorige-objectversie",
      "revision": "YYYY-MM-DD-actor-uniek",
      "before": {"status": "Te doen", "next_step": "Oude stap"},
      "after": {"status": "In uitvoering", "next_step": "Nieuwe concrete stap"}
    }
  ],
  "evidence": ["Bronlink en werkelijk resultaat; benoem wat nog niet bewezen is."]
}
```

Voor een nieuwe taak: `base_revision: null`, `before: null` en een volledige `after` met `title`, `status`, `acceptance`, `evidence`, `next_step`, `description`. De gedeelde taakvelden komen overeen met Notion Taak, Status, Acceptatie, Bewijs en Volgende stap; `description` komt herkenbaar in de pagina-inhoud. Lokale workspace-ID's, paginalinks en persoonlijke notities horen in het eigen Notion-synchronisatiedossier. Een bestaand dossier wordt niet vervangen door alleen deze gedeelde velden.

Een hersteloperatie voor bekende verschillende voorgangers kan daarnaast `resolves`, `resolution_decision` en `accepted_predecessors` bevatten. Elke voorganger bevat `revision` en dezelfde concrete `before`-velden. Volg het conflictherstel in het protocol; ontbrekend keuze-bewijs of een onbekende lokale toestand blijft geblokkeerd. Gebruik deze uitzondering uitsluitend voor een expliciet opgelost inhoudelijk conflict.
