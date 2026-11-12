# Onderzoek naar andere bSDD-bronnen

Gecontroleerd op 12 november 2026, voor UDPS 1.7.1. Dit is een gerichte steekproef van verschillende bronstructuren, geen certificering van alle klassen of dictionaries. Brondata kunnen veranderen.

| Bron | Onderzochte klasse | Gepubliceerde eigenschappen | IFC-relatie en betekenis voor de app |
|---|---|---|---|
| [ETIM 10.1](https://identifier.buildingsmart.org/uri/etim/etim/10.1) | EC000001 — Busbar terminal | 9: 7 Single en 2 Range; onder meer keuzewaarden | Deze klasse publiceert geen IFC-relatie. Bekijken kan, automatisch aan IFC koppelen niet. Range wordt met reden uitgesloten van enkelvoudige UDPS-mappings. |
| [NL-SfB Tabel 1, 2021](https://data.ketenstandaard.nl/publications/nlsfb/2021) | 00.0 — Indirecte projectvoorzieningen | 0 | Geen IFC-relatie in deze klasse. Een classificatiecode levert niet vanzelf een parameterlijst op. |
| [CCI Construction 1.0](https://identifier.buildingsmart.org/uri/molio/cciconstruction/1.0) | A-AAA — Room | HandicapAccessible, Boolean, in Pset_SpaceCommon | HasReference naar IFC 4.3 IfcSpace; de property zelf komt uit de IFC-dictionary. Volledige route tot UDPS getest. |
| [LCA indicators and modules 5](https://identifier.buildingsmart.org/uri/LCA/LCA/5) | acidification — Acidification | AP, Real, in Acidification, eenheid mol H+ eq | Dit is een GroupOfProperties, met HasReference naar IFC 4.3 IfcBuilding. Volledige route tot UDPS getest. |
| [Swedish materials 1](https://identifier.buildingsmart.org/uri/sbe/swedishmaterials/1) | AC-- — asfaltbetong | 0 | Dit is een Material; geen IFC-relatie in deze klasse. Een materiaalclassificatie is geen objectklasse met gegarandeerde properties. |

Voor ETIM, NL-SfB, CCI en Swedish materials zijn de eerste 100 klassen onderzocht om een concrete klasse te kiezen; hun volledige inhoud is niet inhoudelijk gecontroleerd. De LCA-index is volledig opgehaald: 47 records, waarvan 41 GroupOfProperties en 6 Class. De appverbinding met CCI/IfcSpace geeft 150 klassen terug; die met LCA/IfcBuilding 25. Niet al die klassen zijn afzonderlijk inhoudelijk beoordeeld.

## Gevonden oorzaken en aanpassingen

1. De productzoeker filterde de API op `ClassType=Class`. Daardoor waren eigenschapgroepen en materialen onzichtbaar. De index haalt nu alle soorten op en biedt een soortfilter. O&E blijft standaard op objectklassen staan; de actuele O&E-index bevat 287 Class en 21 Material.
2. LCA geeft in Class/Properties de klasse-URI in kleine letters terug, terwijl Class en de dictionary-index `LCA/LCA` gebruiken. De app bevestigt een uitsluitend in hoofdletters afwijkende URI opnieuw via Class/v1 en accepteert die alleen als bSDD exact dezelfde canonieke klasse teruggeeft. Andere afwijkende klassen worden nog steeds afgewezen.
3. Keuzewaarden, eenheden en gepubliceerde beperkingen zijn beschikbaar in uitklapbare eigenschapdetails. Bij toevoegen blijven ze in het JSON-project bewaard. Een UDPS-definitie dwingt keuzewaarden of andere bronvoorwaarden niet af. De eigen bibliotheekexport blijft het bestaande compacte schema voor UDPS-definities gebruiken.
4. Bronupdates vernieuwen ook bekeken klassen zonder IFC-relatie. Oudere caches van klasse-indexen en eigenschappen worden opnieuw opgehaald. Opgeslagen projectkoppelingen worden niet automatisch veranderd.

De app combineert niet op basis van een overeenkomstige naam. IFC-relaties worden gecontroleerd; de herkomst van de eigenschap blijft los van de dictionary van de bronklasse bewaard. Ouder-kindrelaties en HasPart voegen niet automatisch properties toe.

## Bewijs en controle

De ontvangen API-antwoorden voor de vijf voorbeelden staan in `tests/fixtures/other-sources.json`. Tests herhalen daarop de daadwerkelijke bronketens, de LCA-schrijfvariantcontrole, ontbrekende IFC-relaties, uitsluiting van Range en updates van alleen bekeken klassen. De O&E-regressietests bevestigen nog steeds 42 properties voor Deur en 24 voor Binnendeur. In totaal slagen 63 tests en alle syntaxcontroles.

De API is rechtstreeks bevraagd. Een nieuwe visuele browsercontrole kon door een blokkade in de werkomgeving niet worden uitgevoerd; de werking in Revit is hier niet getest.

Technische referentie: [officiële bSDD API-documentatie](https://github.com/buildingSMART/bSDD/blob/master/Documentation/bSDD%20API.md) en [OpenAPI-contract](https://github.com/buildingSMART/bSDD/blob/master/Documentation/bSDD%20OpenAPI.yaml).
