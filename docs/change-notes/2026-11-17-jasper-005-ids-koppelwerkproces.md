# UDPS 1.11.2 — IDS-koppelwerkproces

Deze note legt de gepubliceerde verbetering en verificatie vast. Documentcontrole, parameterkoppelingen en niet-uitgevoerde modelvoorwaarden blijven herkenbaar gescheiden.

```json
{
  "schema": 1,
  "change_id": "2026-11-17-jasper-005-ids-koppelwerkproces",
  "created_at": "2026-11-17T14:48:22.894Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.11.2: gegroepeerde IDS-koppelingen, directe Revit-invoer, wijzigingsoverzicht, bronvergelijking en lokale XSD-controle gepubliceerd en geverifieerd.",
  "depends_on": [
    "2026-11-17-jasper-004-algemene-ids"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-17-jasper-004-algemene-ids",
      "revision": "2026-11-17-jasper-005-ids-koppelwerkproces",
      "before": {
        "status": "In uitvoering",
        "evidence": "Generieke IDS-bronimport gepubliceerd als UDPS 1.10.0 via PR 11, main b429a0b9e4e56b01e5576abc2817aa96e4ae3a5c. Alle zes facetten en restricties blijven leesbaar; volledige bron kan zonder mappings worden bewaard. Concrete entiteitenlijsten, handmatige doelen/namen/datatypes en afzonderlijke scope-/waarde-/optioneelkeuzes zijn herleidbaar. Niet-uitgevoerde voorwaarden houden exportwaarschuwingen. Syntaxcontrole, 175 tests, 334 ongewijzigde officiële IDS-bestanden en onafhankelijke eisen-/kwaliteitsreviews geslaagd; bevindingen hersteld en hercontroleerd. Privépraktijkbestand alleen lokaal onderzocht, niet gepubliceerd. Native cloudbrowser 1.10.0: bronbewaring zonder regels, conditionele twee-entiteitenproef met waardepatroon, materiaal/verboden specificatie zichtbaar, twee pending mappings, Revit-namen en geldige uitvoer, blijvende waarschuwingen, herladen/bewaarde bron, herhaling zonder duplicaten en echte gedownloade JSON-terugimport geslaagd. Download apart gecontroleerd op exacte XML, SHA-256 en keuzes/herkomst; oorspronkelijke 59-regelige projectkopie via JSON hersteld. Geen volledige XSD/IDS-audit, IFC-modelcontrole of universele verliesvrije omzetting naar UDPS.",
        "next_step": "Praktijkacceptatie van 1.10.0: beoordeel de getoonde toepassingsfilters, waarde-eisen en expliciete naam-/datatypekeuzes voordat koppelingen worden toegevoegd. Niet-propertyroutes, quantity sets, historische/toekomstige formaten en niet ondersteunde aantallen blijven broninformatie. Volledige IDS-audit en IFC-controle zijn afzonderlijke mogelijkheden, geen bewezen onderdeel van deze import. De collega-aansluiting blijft op Jaspers verzoek apart uitgesteld."
      },
      "after": {
        "status": "In uitvoering",
        "evidence": "IDS-koppelwerkproces gepubliceerd als UDPS 1.11.2 via PR 13, 14 en 15; code-main cab5b5cf6d6edf67971e2bbb38109cb497904ef1. Parameters gegroepeerd met behoud van afzonderlijke broncontexten; gezamenlijke toepassingsbeoordeling, directe Revit-namen en IFC-uitzonderingen, atomisch wijzigingsoverzicht, veilige bronvergelijking, achtergrondverwerking en IndexedDB-opslag/herstel. Browser voert lokale XSD-controle uit; officiële buildingSMART-inhoudsaudit 1.0.124 afzonderlijk als ontwikkel-/CI-referentie beproefd. Syntax, 272 tests, het bestaande corpus van 334 officiële IDS-bestanden en onafhankelijke eisen-/kwaliteitsreviews geslaagd. Native 1.11.2 bevestigt XSD, 3 eisen naar 2 definities/4 koppelingen, afwijkende deurnaam, exact wijzigingsoverzicht en geldige export met blijvende voorwaardenwaarschuwingen, bewaren/herladen en herhaling zonder duplicaten. Werkelijke JSON-download bevat exacte XML/SHA-256, keuzes, 2 centrale identiteiten en 6 herkomstverwijzingen. Oorspronkelijk browserproject via JSON hersteld op 59 regels/416 koppelingen. Bronversievergelijking en opslagfoutgevallen automatisch getest; niet aanvullend native beproefd. Geen volledige browser-IDS-audit, IFC-modelcontrole of universele omzettingsclaim.",
        "next_step": "Praktijkacceptatie van 1.11.2: controleer de getoonde toepassingsfilters, waarde-eisen, namen/datatypes en voorgestelde Revit-koppelingen voordat je toevoegt. Bronproblemen met de IDS-opsteller beoordelen. Niet-propertyroutes, quantity sets en niet ondersteunde formaten/aantallen blijven broninformatie. Volledige semantische browseraudit is nog geen productfunctie; de officiële auditroute is wel als ontwikkelreferentie beschikbaar. Aanvullende native proef van bronversievergelijking blijft mogelijk. De collega-aansluiting blijft op Jaspers verzoek apart uitgesteld."
      }
    }
  ],
  "evidence": [
    "Code: https://github.com/Stefan-van-Dijk/UDPS/pull/13 ; checkboxherstel: https://github.com/Stefan-van-Dijk/UDPS/pull/14 ; directe invoer en IFC-keuzes: https://github.com/Stefan-van-Dijk/UDPS/pull/15 . Code-main cab5b5cf6d6edf67971e2bbb38109cb497904ef1, boom c8a083d2b0a60af480b26129bdf4370bc4e82e84.",
    "Contract: docs/ids-import.md. Exacte parameterdefinities groeperen zonder broneisen samen te vouwen; gezamenlijke scopekeuzes omvatten alleen de getoonde parameters. Waarden en optionele eigenschappen blijven apart. Onbekende geneste XML blijft onderscheidend; geen automatische gelijkstelling of naamcorrectie.",
    "Preflight en toepassen gebruiken dezelfde atomische planner. Bestaande ingevulde Revit-namen blijven behouden. Nieuwe regels voor dezelfde definitie delen een centrale identiteit; bestaande centrale groepen worden niet automatisch samengevoegd. Bronversies vergelijken op semantische context met expliciet gekozen voorganger; alleen bewezen ongewijzigde keuzes overnemen.",
    "npm run check en 272 tests geslaagd, inclusief het bestaande corpus van 334 ongewijzigde officiële IDS-documenten. Dat corpus bewijst lezen/behoud, niet dat ieder positief of negatief testbestand geldig is. Nieuwe controles dekken groepering, conflicten, preflight, revisies, workers, daadwerkelijke WASM-XSD-validatie en IndexedDB/fallback/herstel.",
    "Officiële buildingSMART ids-tool.CommandLine 1.0.124 met pakketintegriteitscontrole daadwerkelijk uitgevoerd: geldig geval exit 0, XSD-ongeldig exit 24, semantisch ongeldig exit 16. De browser gebruikt lokale libxml2/XSD in een worker; .NET-inhoudsaudit blijft ontwikkel-/CI-route. Geen modelcontrole. Geen IDS-inhoud naar een auditdienst verzonden.",
    "Onafhankelijke eisen-/kwaliteitsreviews en hercontroles uitgevoerd. Hersteld: geneste onbekende XML-context, opslagmarkering na dubbele schrijffout, verouderd asynchroon vergelijkingsresultaat, native checkboxdefault en directe invoer zonder blur. Gerichte onafhankelijke eindcontrole van 1.11.2: 50 tests en aanvullende lege-invoer/preflightproef geslaagd.",
    "Native cloudbrowser op https://stefan-van-dijk.github.io/UDPS/ bevestigde 1.11.2. Synthetische proef: 2 specificaties, 3 eisen, 2 definities, 1 gezamenlijke toepassingsgroep, concrete IfcWall/IfcDoor-doelen en waarde-eis. XSD geldig, scope-/waardekeuzes bedienbaar, directe namen QA_Code/QA_Tag en QA_Code_Door-uitzondering zichtbaar als 4 nieuwe regels. Werkelijke uitvoer: 2 blokken en 4 koppelingen met blijvende voorwaardenwaarschuwingen.",
    "Na bewaren/herladen bleven bron, namen, keuzes en 2 centrale definities aanwezig. Herhaalde import toonde 0 nieuw/4 hergebruik en voegde geen duplicaten toe. De echte projectdownload is apart geverifieerd: exacte XML en SHA-256, vier juiste namen, twee centrale identiteiten en zes afzonderlijke herkomstverwijzingen. Oorspronkelijke JSON-kopie via de app teruggezet: 59 regels en 416 koppelingen, opslag bevestigd.",
    "Bronversievergelijking, workerannulering en opslagfout/herstelgevallen zijn automatisch beproefd; geen aanvullende native claim voor die routes. De native bestandskiezer was traag. De huidige projectdownload is inhoudelijk gecontroleerd; geen aparte native terugimport van die nieuwe proefdownload geclaimd. Origineelherstel via JSON is wel waargenomen.",
    "Merge-CI: https://github.com/Stefan-van-Dijk/UDPS/actions/runs/44105959631 ; Pages: https://github.com/Stefan-van-Dijk/UDPS/actions/runs/44105959549 . Beide geslaagd.",
    "Privépraktijkbestand uitsluitend lokaal onderzocht; concrete bedrijfsinhoud en auditbevinding staan alleen in het persoonlijke taakdossier. Geen bronbestand, persoonlijke Notion-bestemmingen of ongefilterde dossiers gepubliceerd. Collega-aansluiting uitgesteld; Digitaal Bouwen niet gewijzigd of opgeheven."
  ]
}
```

