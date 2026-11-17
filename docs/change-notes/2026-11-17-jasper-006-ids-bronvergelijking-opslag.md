# UDPS 1.11.3 — bronvergelijking, bediening en opslag

De browserproef met twee synthetische IDS-bronnen leidde tot drie correcties. De controle omvatte het onderscheid tussen nieuw en vervallen, overname van ongewijzigde keuzes en herstel via de werkelijke projectdownload.

```json
{
  "schema": 1,
  "change_id": "2026-11-17-jasper-006-ids-bronvergelijking-opslag",
  "created_at": "2026-11-17T21:43:35.717Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.11.3 corrigeert bediening, bronvergelijking en opslagmeldingen voor IDS.",
  "depends_on": [
    "2026-11-17-jasper-005-ids-koppelwerkproces"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-17-jasper-005-ids-koppelwerkproces",
      "revision": "2026-11-17-jasper-006-ids-bronvergelijking-opslag",
      "before": {
        "evidence": "IDS-koppelwerkproces gepubliceerd als UDPS 1.11.2 via PR 13, 14 en 15; code-main cab5b5cf6d6edf67971e2bbb38109cb497904ef1. Parameters gegroepeerd met behoud van afzonderlijke broncontexten; gezamenlijke toepassingsbeoordeling, directe Revit-namen en IFC-uitzonderingen, atomisch wijzigingsoverzicht, veilige bronvergelijking, achtergrondverwerking en IndexedDB-opslag/herstel. Browser voert lokale XSD-controle uit; officiële buildingSMART-inhoudsaudit 1.0.124 afzonderlijk als ontwikkel-/CI-referentie beproefd. Syntax, 272 tests, het bestaande corpus van 334 officiële IDS-bestanden en onafhankelijke eisen-/kwaliteitsreviews geslaagd. Native 1.11.2 bevestigt XSD, 3 eisen naar 2 definities/4 koppelingen, afwijkende deurnaam, exact wijzigingsoverzicht en geldige export met blijvende voorwaardenwaarschuwingen, bewaren/herladen en herhaling zonder duplicaten. Werkelijke JSON-download bevat exacte XML/SHA-256, keuzes, 2 centrale identiteiten en 6 herkomstverwijzingen. Oorspronkelijk browserproject via JSON hersteld op 59 regels/416 koppelingen. Bronversievergelijking en opslagfoutgevallen automatisch getest; niet aanvullend native beproefd. Geen volledige browser-IDS-audit, IFC-modelcontrole of universele omzettingsclaim.",
        "next_step": "Praktijkacceptatie van 1.11.2: controleer de getoonde toepassingsfilters, waarde-eisen, namen/datatypes en voorgestelde Revit-koppelingen voordat je toevoegt. Bronproblemen met de IDS-opsteller beoordelen. Niet-propertyroutes, quantity sets en niet ondersteunde formaten/aantallen blijven broninformatie. Volledige semantische browseraudit is nog geen productfunctie; de officiële auditroute is wel als ontwikkelreferentie beschikbaar. Aanvullende native proef van bronversievergelijking blijft mogelijk. De collega-aansluiting blijft op Jaspers verzoek apart uitgesteld."
      },
      "after": {
        "evidence": "UDPS 1.11.3 herstelt de eerste klik na Revit-invoer, onderscheidt verschillende expliciete specificatie-ID’s in de bronvergelijking en bevestigt bronopslag pas na het opslagresultaat. Code 2d6b71815375e393b5d64990e858993897ba5a12. Syntaxcontrole en 278 tests geslaagd, inclusief het corpus van 334 officiële IDS-bestanden. Edge 157 in een apart profiel met twee synthetische versies bevestigde muis- en toetsenbordbediening, XSD, één ongewijzigde, gewijzigde, nieuwe en vervallen eis, en overname van alleen de ongewijzigde keuze. Drie bestaande exportregels en twee exacte XML-bronnen bleven behouden. Dubbele schrijffout gaf een herstelmelding en een JSON-backup met de conceptkeuzes. De laatste geldige opslag bleef intact. Bij geweigerde IndexedDB-toegang is de verouderde reservekopie geblokkeerd. De werkelijke JSON-download is exact teruggeïmporteerd en opnieuw geopend vanuit de beperkte browseropslag.",
        "next_step": "Praktijkacceptatie van 1.11.3 met een representatieve IDS. Beoordeel toepassingsfilters, waarde-eisen, namen, datatypes en voorgestelde Revit-koppelingen. Bespreek inhoudelijke bronproblemen met de IDS-opsteller. Voor volledige inhoudsaudit is de ontwikkelreferentie beschikbaar. De collega-aansluiting blijft een aparte taak."
      }
    }
  ],
  "evidence": [
    "Code en contracten op https://github.com/Stefan-van-Dijk/UDPS/commit/2d6b71815375e393b5d64990e858993897ba5a12 .",
    "Syntaxcontrole en 278 tests geslaagd. Gerichte regressies dekken expliciete en ontbrekende specificatie-ID’s, focuswissels en vertraagde opslag.",
    "Edge 157.0.4341.60 herhaalde vergelijking, eerste muisklik na naamwijziging, Tab/Spatie, behoud van focus, geweigerde opslag en exacte JSON-terugimport. Beide synthetische IDS-bronnen doorliepen de lokale XSD-controle.",
    "Bij een opslagfout is het actuele concept beschikbaar in de download en blijft de laatste geslaagde browserkopie intact. Herstel vanuit JSON blijft ook met een gecontroleerde IndexedDB-storing mogelijk.",
    "Praktijkacceptatie met een bedrijfs-IDS en inhoudelijke afspraken blijven open."
  ]
}
```
