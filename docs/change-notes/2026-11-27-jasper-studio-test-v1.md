# Studio B als afzonderlijke testversie

De gebruiker heeft het ontwerp goedgekeurd, met behoud van de bestaande klikmodeltabel en een afzonderlijke testsubmap in de publieke app. De huidige hoofdapp blijft ongewijzigd.

```json
{
  "schema": 1,
  "change_id": "2026-11-27-jasper-studio-test-v1",
  "created_at": "2026-11-27T15:27:35Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "Goedgekeurd Studio B ontwerp in het klikmodel ingevoerd en als geïsoleerde testversie voor de bestaande UDPS-publicatie voorbereid.",
  "depends_on": [
    "2026-11-16-jasper-001-bootstrap"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T003",
      "entity_type": "task",
      "base_revision": "2026-11-16-jasper-001-bootstrap",
      "revision": "2026-11-27-jasper-studio-test-v1",
      "before": {
        "evidence": "Release 1.8.1 gepubliceerd via PR 5; 102 regressietests en 15 echte browsercontroles geslaagd. Live bSDD-toegang blijft geblokkeerd op CORS; Revit-proef vervallen.",
        "next_step": "Externe bSDD-CORS-toelating regelen voor [https://stefan-van-dijk.github.io](https://stefan-van-dijk.github.io); verzoek en bewijs staan bij de browsertaak. Daarna alleen de live bronroute opnieuw controleren."
      },
      "after": {
        "evidence": "Studio B geïmplementeerd in klikmodel v36 en afzonderlijke web/test-map; bestaande 47 webbestanden bytegelijk. 502 tests en syntax/assetcontrole geslaagd. Browserproeven bevestigen bedrijfsbasis/projectwijzigingen, JSON-heropening, echte IDS-worker/XSD/bronversievergelijking en TXT-/bibliotheekdownload. Publicatie van de testmap volgt via de bestaande Pages-workflow na samenvoegen.",
        "next_step": "Testversie onder /UDPS/test/ in de praktijk beoordelen. Bestaande hoofdapp behouden; live bSDD blijft afhankelijk van de bestaande CORS-grens. Revit-proef blijft vervallen."
      }
    }
  ],
  "evidence": [
    "Klikmodelbron d998e5511903e2a428cf115aaef239a88f2af53a, Site v36: https://udps-werkstroom-concept.jasperkempen.chatgpt.site/",
    "docs/studio-test.md en docs/studio-evidence: concrete desktopbrowserproeven en grenzen.",
    "npm run check en npm test: 502 pass, 0 fail, 0 skipped. 47 oorspronkelijke webbestanden bytegelijk aan 9a05876a33ab8d37543a393a8843f7c623c4ffc8.",
    "De testsubmap is voorbereid; daadwerkelijke Pages-publicatie wordt na de merge apart bevestigd. Geen nieuwe live bSDD-/Windows-/Revit-/telefoonclaim."
  ]
}
```
