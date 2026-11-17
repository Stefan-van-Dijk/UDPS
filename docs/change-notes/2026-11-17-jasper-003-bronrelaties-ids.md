# UDPS 1.9.0 — bronrelaties en IDS

Deze note registreert de gepubliceerde productwijziging en de werkelijk uitgevoerde controles. Praktijkacceptatie van IDS en de aansluiting met de collega blijven zichtbaar open. Het bestaande Digitaal Bouwen-dossier blijft behouden.

```json
{
  "schema": 1,
  "change_id": "2026-11-17-jasper-003-bronrelaties-ids",
  "created_at": "2026-11-17T06:15:20.450Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.9.0: Raam/Dakraam-bronroute afgerond, beperkte IDS-import gebouwd en gecontroleerd; praktijk-IDS en collega-aansluiting blijven open.",
  "depends_on": [
    "2026-11-16-jasper-001-bootstrap",
    "2026-11-16-jasper-002-invoering"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T008",
      "entity_type": "task",
      "base_revision": "2026-11-16-jasper-001-bootstrap",
      "revision": "2026-11-17-jasper-003-bronrelaties-ids",
      "before": {
        "status": "Te doen",
        "evidence": "Ontwikkelwens vastgelegd. Raam naar Dakraam is een te onderzoeken voorbeeld, geen geverifieerde overerving in een specifieke dictionary.",
        "next_step": "Voor Raam en Dakraam in de relevante bSDD-bronnen de objecten, eigenschappen en relaties onderzoeken en de mapping uitwerken."
      },
      "after": {
        "status": "Afgerond",
        "evidence": "Raam en Dakraam in O&E 2.0.1 onderzocht: bevestigde hiërarchie, elk twee rechtstreeks gepubliceerde eigenschappen en verschillende ObjectType-voorwaarden. Klassehiërarchie en uitgaande relaties zijn navigeerbaar met behoud van dictionary en broncontext; geen automatische eigenschapsovererving. Gepubliceerd als UDPS 1.9.0 via PR 9 op b100056286815b6100bed54e7b8465994d1d892f; syntaxcontrole, 124 tests, afzonderlijke code-/datareview en native browserproef Raam → Dakraam geslaagd. Live vernieuwen blijft afzonderlijk bij UDPS-T005 geblokkeerd.",
        "next_step": "Onderzoek en uitvoering van de Raam/Dakraam-route afgerond. Alleen de bestaande live bronvernieuwing bij UDPS-T005 wacht op bSDD-CORS; geen automatische overerving afleiden uit een ouder-kindrelatie."
      }
    },
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-16-jasper-001-bootstrap",
      "revision": "2026-11-17-jasper-003-bronrelaties-ids",
      "before": {
        "status": "Te doen",
        "evidence": "Ontwikkelwens vastgelegd; representatief IDS-bestand en technische route nog niet gekozen.",
        "next_step": "Een representatief IDS-bestand kiezen en uitwerken hoe de eisen naar benodigde Revit-parameterkoppelingen worden vertaald."
      },
      "after": {
        "status": "In uitvoering",
        "evidence": "Beperkte IDS 1.0-import gepubliceerd in UDPS 1.9.0 via PR 9 op b100056286815b6100bed54e7b8465994d1d892f. Officiële ongewijzigde property-testcase gekozen; ondersteunde eisen worden als pending Revit-mappings toegevoegd, met oorspronkelijke XML en expliciete uitsluitingen. Syntaxcontrole en 124 tests geslaagd; witruimtefout hersteld en onafhankelijk hercontroleerd. Native browser: preview, pending exportblokkade, Revit-naam invullen en geldige uitvoer, herladen/bewaarde bron, dubbele import, conditionele eis, randspaties en ongeldige XML gecontroleerd. Gedownloade JSON bevat exact de oorspronkelijke IDS en koppeling. Native JSON-terugimport bleef door een browseronderbreking onbevestigd; oorspronkelijke testproject is hersteld. Geen volledige IDS-validatie of Revit-modeltest.",
        "next_step": "Een representatieve praktijk-IDS aanleveren en de feitelijke vereisten/IFC-versie vergelijken met de expliciet ondersteunde selectie. Werk niet ondersteunde conditionele eisen op basis van die bron uit. Herhaal bij gelegenheid de native JSON-terugimport; de automatische roundtrip en backupinhoud zijn gecontroleerd."
      }
    },
    {
      "entity_id": "UDPS-T010",
      "entity_type": "task",
      "base_revision": "2026-11-16-jasper-002-invoering",
      "revision": "2026-11-17-jasper-003-bronrelaties-ids",
      "before": {
        "evidence": "PR 7 publiceert het log, de beginsituatie en de instructies. Negen oorspronkelijke dossiers plus invoeringstaak overgenomen; tien unieke taken en drie besluiten teruggelezen. Lokale procedureproef met echte Notion-writes, herhaling, ontvangstherstel en conflictbehoud geslaagd. Onafhankelijke documentreview en CI geslaagd. ChatGPT-projectinstelling niet aangepast door toegangstime-out; collega-account en nieuwe-chatproeven nog open. Digitaal Bouwen behouden.",
        "next_step": "Vervang de eigen ChatGPT-projectinstructie. Laat de collega de aansluitprompt uitvoeren met de eigen accounts en een terugmelding op UDPS-T010 publiceren. Verwerk die bij Jasper en voer de echte nieuwe-chatproeven uit. Digitaal Bouwen niet opheffen."
      },
      "after": {
        "evidence": "PR 7 publiceert het log, de beginsituatie en de instructies. Negen oorspronkelijke dossiers plus invoeringstaak overgenomen; tien unieke taken en drie besluiten teruggelezen. Lokale procedureproef met echte Notion-writes, herhaling, ontvangstherstel en conflictbehoud geslaagd. Onafhankelijke documentreview en CI geslaagd. ChatGPT-projectinstelling niet aangepast door toegangstime-out; collega-account en nieuwe-chatproeven nog open. Digitaal Bouwen behouden. Jasper heeft op 17 november 2026 aangegeven de aansluiting later met zijn collega te testen; onafhankelijke producttaken zijn intussen voortgezet. Geen geslaagde tweerichtings- of nieuwe-chatproef geclaimd.",
        "next_step": "Jasper test de aansluiting later met zijn collega. Gebruik dan de bestaande aansluitprompt en eigen accounts, publiceer een echte terugmelding op UDPS-T010 en controleer verwerking en nieuwe-chatroute. De opgeslagen projectinstelling blijft afzonderlijk te verifiëren. Digitaal Bouwen behouden."
      }
    }
  ],
  "evidence": [
    "Codepublicatie: https://github.com/Stefan-van-Dijk/UDPS/pull/9 ; main b100056286815b6100bed54e7b8465994d1d892f, boom 9789974b1066107b1eca414d5c234f9b9d052409. Geen appcode gewijzigd door deze voortgangsnote.",
    "Brononderzoek en opgeslagen antwoorden: https://github.com/Stefan-van-Dijk/UDPS/blob/b100056286815b6100bed54e7b8465994d1d892f/docs/bsdd-window-mapping.md",
    "IDS-ondersteuning, officiële testcase en grenzen: https://github.com/Stefan-van-Dijk/UDPS/blob/b100056286815b6100bed54e7b8465994d1d892f/docs/ids-import.md",
    "Syntax en 124 tests geslaagd op de codeboom; onafhankelijke eisen-/kwaliteitsreviews met hercontrole van de gerepareerde IDS-identiteitsfout. Merge-CI: https://github.com/Stefan-van-Dijk/UDPS/actions/runs/43996888424 ; Pages-publicatie: https://github.com/Stefan-van-Dijk/UDPS/actions/runs/43996888410 .",
    "Native cloudbrowser op https://stefan-van-dijk.github.io/UDPS/ toonde 1.9.0. Gecontroleerde proefdata en een vooraf bewaarde projectkopie gebruikt. Raam → Dakraam, eigen ObjectType-voorwaarden en uitgaande relaties zichtbaar; geen automatische toevoeging. Live bSDD gaf nog de zichtbare netwerk/CORS-beperking en opgeslagen brondata.",
    "IDS-native proef: officiële XML → preview → pending mapping → QA_Foo → correcte UDPS-uitvoer; browserherladen, bewaarde bron en herhaling zonder extra regel. Conditionele toepassing, randspaties en ongeldige XML blokkeerden toevoegen. De JSON-download is apart gelezen: oorspronkelijke XML exact, SHA-256 passend, één IDS-bron en één mapping. Native JSON-terugimport door onderbreking niet bewezen. Oorspronkelijke 59-regelige projectkopie daarna via de app hersteld en teruggezien.",
    "Bedrijfslogica UDPS-T007 wacht op concrete bedrijfsregels. Aansluiting met de collega is uitgesteld door Jasper; geen nieuwe accounts, deelrechten, workspace-opheffing of Revit-proef uitgevoerd."
  ]
}
```
