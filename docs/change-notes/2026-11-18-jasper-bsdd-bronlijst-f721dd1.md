# UDPS 1.12.1 — bSDD-bronlijst bewaren

UDPS behoudt de laatste geslaagde lijstvernieuwing bij herladen en bij een mislukte aanvraag. De live verbinding vereist toelating door buildingSMART.

```json
{
  "schema": 1,
  "change_id": "2026-11-18-jasper-bsdd-bronlijst-f721dd1",
  "created_at": "2026-11-18T15:16:19.558Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.12.1 bewaart de laatst geslaagde bSDD-lijstvernieuwing.",
  "depends_on": [
    "2026-11-16-jasper-001-bootstrap"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T005",
      "entity_type": "task",
      "base_revision": "2026-11-16-jasper-001-bootstrap",
      "revision": "2026-11-18-jasper-bsdd-bronlijst-f721dd1",
      "before": {
        "evidence": "Na objectkeuze: Binnendeur toont 24 opgeslagen eigenschappen zonder live aanvraag. Roldeur zonder detailcache triggert Class/v1, maar de browser blokkeert door ontbrekende CORS-toelating. Cache is geen bewijs van live toegang.",
        "next_step": "Laat buildingSMART origin [https://stefan-van-dijk.github.io](https://stefan-van-dijk.github.io) toelaten voor CORS; concreet verzoek staat in de taak en is niet verstuurd. Herhaal daarna live bronvernieuwing, eigenschappen ophalen en updates op de publicatie."
      },
      "after": {
        "evidence": "UDPS 1.12.1 bewaart de laatst opgehaalde bSDD-bronlijst bij herladen en een mislukte vervolgvernieuwing. Edge 157 bevestigde met gecontroleerde antwoorden dat een gevonden bron selecteerbaar blijft en een eigen bibliotheek behouden blijft. De 285 tests slagen. CCI en LCA leverden actuele eigenschappen tot aan UDPS-export buiten de browser. Live ophalen vanuit GitHub Pages blijft geblokkeerd door ontbrekende CORS-toelating.",
        "next_step": "Vraag buildingSMART om de browserorigin https://stefan-van-dijk.github.io toe te laten. Het verzoek staat klaar voor verzending. Controleer daarna live lijstvernieuwing, ongecachete klassen, eigenschappen en updates in de gepubliceerde app."
      }
    }
  ],
  "evidence": [
    "Geteste patch en regressietest. https://github.com/Stefan-van-Dijk/UDPS/commit/f721dd15d6e6bfe0e2e5f783a99e3858cb9ef5d4",
    "285 automatische tests geslaagd. Edge 157 met gecontroleerde bSDD-antwoorden bevestigde vernieuwen, herladen, een mislukte vervolgvernieuwing en opnieuw een bewaarde bron kiezen.",
    "13 actuele openbare API-antwoorden zijn buiten de browser verwerkt. CCI Room en LCA Acidification zijn met bevestigde IFC-relaties tot UDPS geëxporteerd.",
    "De live browserroute vereist CORS-toelating van het gepubliceerde domein. https://technical.buildingsmart.org/services/bsdd/using-the-bsdd-api/"
  ]
}
```
