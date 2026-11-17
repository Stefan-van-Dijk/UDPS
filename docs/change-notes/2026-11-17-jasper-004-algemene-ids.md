# UDPS 1.10.0 — algemene IDS-import

Deze note legt de gepubliceerde importverbetering en uitgevoerde verificatie vast. Breed lezen en bewaren is gescheiden van de beperktere UDPS-uitvoer; niet-uitgevoerde eisen worden niet als modelconformiteit voorgesteld.

```json
{
  "schema": 1,
  "change_id": "2026-11-17-jasper-004-algemene-ids",
  "created_at": "2026-11-17T13:02:46.017Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.10.0: algemene IDS-bronimport en beoordeelde parameterkoppelingen gepubliceerd; browser- en JSON-routes gecontroleerd, semantische grenzen expliciet.",
  "depends_on": [
    "2026-11-17-jasper-003-bronrelaties-ids"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-17-jasper-003-bronrelaties-ids",
      "revision": "2026-11-17-jasper-004-algemene-ids",
      "before": {
        "status": "In uitvoering",
        "evidence": "Beperkte IDS 1.0-import gepubliceerd in UDPS 1.9.0 via PR 9 op b100056286815b6100bed54e7b8465994d1d892f. Officiële ongewijzigde property-testcase gekozen; ondersteunde eisen worden als pending Revit-mappings toegevoegd, met oorspronkelijke XML en expliciete uitsluitingen. Syntaxcontrole en 124 tests geslaagd; witruimtefout hersteld en onafhankelijk hercontroleerd. Native browser: preview, pending exportblokkade, Revit-naam invullen en geldige uitvoer, herladen/bewaarde bron, dubbele import, conditionele eis, randspaties en ongeldige XML gecontroleerd. Gedownloade JSON bevat exact de oorspronkelijke IDS en koppeling. Native JSON-terugimport bleef door een browseronderbreking onbevestigd; oorspronkelijke testproject is hersteld. Geen volledige IDS-validatie of Revit-modeltest.",
        "next_step": "Een representatieve praktijk-IDS aanleveren en de feitelijke vereisten/IFC-versie vergelijken met de expliciet ondersteunde selectie. Werk niet ondersteunde conditionele eisen op basis van die bron uit. Herhaal bij gelegenheid de native JSON-terugimport; de automatische roundtrip en backupinhoud zijn gecontroleerd."
      },
      "after": {
        "status": "In uitvoering",
        "evidence": "Generieke IDS-bronimport gepubliceerd als UDPS 1.10.0 via PR 11, main b429a0b9e4e56b01e5576abc2817aa96e4ae3a5c. Alle zes facetten en restricties blijven leesbaar; volledige bron kan zonder mappings worden bewaard. Concrete entiteitenlijsten, handmatige doelen/namen/datatypes en afzonderlijke scope-/waarde-/optioneelkeuzes zijn herleidbaar. Niet-uitgevoerde voorwaarden houden exportwaarschuwingen. Syntaxcontrole, 175 tests, 334 ongewijzigde officiële IDS-bestanden en onafhankelijke eisen-/kwaliteitsreviews geslaagd; bevindingen hersteld en hercontroleerd. Privépraktijkbestand alleen lokaal onderzocht, niet gepubliceerd. Native cloudbrowser 1.10.0: bronbewaring zonder regels, conditionele twee-entiteitenproef met waardepatroon, materiaal/verboden specificatie zichtbaar, twee pending mappings, Revit-namen en geldige uitvoer, blijvende waarschuwingen, herladen/bewaarde bron, herhaling zonder duplicaten en echte gedownloade JSON-terugimport geslaagd. Download apart gecontroleerd op exacte XML, SHA-256 en keuzes/herkomst; oorspronkelijke 59-regelige projectkopie via JSON hersteld. Geen volledige XSD/IDS-audit, IFC-modelcontrole of universele verliesvrije omzetting naar UDPS.",
        "next_step": "Praktijkacceptatie van 1.10.0: beoordeel de getoonde toepassingsfilters, waarde-eisen en expliciete naam-/datatypekeuzes voordat koppelingen worden toegevoegd. Niet-propertyroutes, quantity sets, historische/toekomstige formaten en niet ondersteunde aantallen blijven broninformatie. Volledige IDS-audit en IFC-controle zijn afzonderlijke mogelijkheden, geen bewezen onderdeel van deze import. De collega-aansluiting blijft op Jaspers verzoek apart uitgesteld."
      }
    }
  ],
  "evidence": [
    "Codepublicatie: https://github.com/Stefan-van-Dijk/UDPS/pull/11 ; main b429a0b9e4e56b01e5576abc2817aa96e4ae3a5c, codeboom bc43286229c55053c0279552d8da7efd2f1187c8. Deze voortgangsnote verandert geen appcode.",
    "Ondersteuning en grenzen: https://github.com/Stefan-van-Dijk/UDPS/blob/b429a0b9e4e56b01e5576abc2817aa96e4ae3a5c/docs/ids-import.md . Bronmanifest van 334 ongewijzigde officiële IDS-bestanden met licentie en SHA-256: tests/fixtures/ids/official-provenance.json. Corpuscontrole bewijst lezen en behoud, geen geldigheid van alle testcases of modelconformiteit.",
    "npm ci, syntaxcontrole en 175 tests geslaagd. Twee onafhankelijke reviews en gerichte hercontrole: keuzewissen, onbekende wrapperattributen, herhaalde metadata, specificaties zonder losse eisen en dezelfde getoonde/toegepaste keuzes bij opnieuw uploaden hersteld.",
    "Merge-controle: https://github.com/Stefan-van-Dijk/UDPS/actions/runs/44085874956 ; Pages-publicatie: https://github.com/Stefan-van-Dijk/UDPS/actions/runs/44085874981 . Beide geslaagd.",
    "Native cloudbrowser op https://stefan-van-dijk.github.io/UDPS/ toonde 1.10.0. Synthetische openbare proef: ontbrekende schemaLocation, twee concrete entiteiten, classificatiefilter, waardepatroon, materiaaleis en verboden specificatie zonder requirements. Volledige bron bewaren gaf nul mappings; afzonderlijke scope-/waardebevestigingen maakten één eigenschapsvoorstel bruikbaar en voegden twee pending mappings toe.",
    "Na invullen QA_Code ontstonden twee geldige exportblokken met blijvende waarschuwingen voor scope/waarden. Herladen/bewaarde bron en herhaalde import behielden de twee Revit-namen zonder duplicaten. Gedownloade project-JSON bevatte één bron, exacte XML, passend SHA-256, beslissingen en twee herkomstverwijzingen. Die werkelijke download is via de app teruggeïmporteerd en de bron bleef opnieuw beschikbaar.",
    "Oorspronkelijke browserproject vóór de proef gedownload en daarna via de app exact als JSON teruggezet; 59 regels/416 koppelingen weer zichtbaar. Bestandskeuze in de cloudbrowser was traag, maar de beschreven acties zijn uiteindelijk waargenomen.",
    "Privépraktijk-IDS uitsluitend lokaal onderzocht; geen bedrijfsbestand of inhoud in de publieke repository/testset. Volledige XSD-audit niet uitgevoerd (offline schema-importen ontbreken), geen IFC-model- of Revit-test. Aansluiting met de collega en Digitaal Bouwen blijven intact en apart uitgesteld."
  ]
}
```
