# IDS-import: parameters koppelen met behoud van alle eisen

De IDS-route leest een lokaal IDS-document, bewaart de volledige bron en maakt geschikte `property`-eisen beschikbaar als UDPS-parameterdefinities. De gebruiker kan Revit-namen direct koppelen en de projectwijzigingen vóór toevoegen controleren. De app maakt geen Revit-parameters aan en controleert geen IFC-model.

## Starten met een IDS

Met **Nieuw project uit IDS** bij de projectnaam open je het IDS-overzicht voor een leeg project. Kies alleen het IDS-bestand om alle eisen en de beschikbare parametervoorstellen te bekijken. Met **Project uit IDS bewaren** open je het nieuwe project met de IDS-bron en je keuzegegevens. Na controle kun je ook **Nieuw project openen met selectie** kiezen om direct exportregels toe te voegen.

Bij een gevuld huidig project vraagt UDPS om bevestiging van de projectwissel. Met **Huidig project downloaden** kun je vooraf vanuit de IDS-dialoog een JSON-backup maken. Een project met alleen bewaarde IDS-bronnen opent bij **Koppelingen**. Daar kun je de bron heropenen en later de echte Revit-namen toevoegen. De TXT-export wordt beschikbaar zodra de actieve exportregels geldige koppelingen hebben.

## Drie onderdelen in de dialoog

1. **Bestand en controle** — bekijk het resultaat van de lokale XSD-controle, open een bewaarde bron of vergelijk met een zelfgekozen eerdere bronversie. Boven het overzicht kun je een IDS kiezen en bron en keuzes bewaren.
2. **Parameters koppelen** — werk in een compacte parameterlijst met zoeken, statusfilter en pagina's. De gekozen parameter heeft een detailpaneel voor namen, datatypes, IFC-doelen, Revit-uitzonderingen en onderliggende eisen.
3. **Wijzigingen controleren** — bekijk per concrete IFC-koppeling wat nieuw is, wordt hergebruikt, een conflict heeft of niet kan worden toegevoegd. Pas daarna wordt de gecontroleerde selectie toegepast.

Teruggaan of de dialoog sluiten past geen mappings toe. **Alleen bron en keuzes bewaren** is een afzonderlijke schrijfactie en werkt ook zonder een koppelvoorstel. XML verschijnt pas na een expliciete bronactie. Andere IFC-routes en specificaties zonder losse eisen hebben een eigen overzicht; een materiaaleis krijgt daar geen niet-oplosbare melding over ontbrekende propertynaam of datatype.

## Parameterdefinities en afzonderlijke eisen

De parameterwerklaag groepeert dezelfde exacte propertyset, eigenschapsnaam en uitvoerdatatype. Verschillende datatypevoorstellen blijven afzonderlijk. Nog niet opgeloste naamrestricties worden niet als gelijke concrete namen behandeld. Deze groepering vermindert herhaald koppelen; zij voegt geen IDS-betekenissen samen.

Het aantal parameterdefinities is daarom niet het aantal broneisen. Een overzicht met bijvoorbeeld 49 definities kan nog steeds 419 afzonderlijke eisen bevatten. Elke eis, specificatie, IFC-toepassing en toepassings-/waardevoorwaarde blijft herleidbaar. Iedere toegevoegde exportregel bewaart de bijbehorende eisverwijzingen; er worden geen voorwaarden verwijderd om een groep eenvoudiger te maken.

- De standaard Revit-parameter geldt voor nieuwe koppelingen. Namen uit bestaande mappings zijn herkenbare voorstellen; zij worden niet als nieuwe keuze verzonnen.
- Per IFC-entiteit kan een andere Revit-naam worden gekozen. Nieuwe regels van dezelfde exacte definitie binnen één IDS-bron delen een centrale `Uniform_id`, met behoud van hun afzonderlijke toepassingen en herkomst.
- Bestaande ingevulde Revit-namen blijven behouden. Bestaande groepen worden niet automatisch samengevoegd.
- Een bestaande lege, als pending gemarkeerde regel kan direct worden ingevuld als die regel precies één IFC-entiteit gebruikt. Historische lege namen en gedeelde regels met meerdere entiteiten blijven behouden; bewerk zulke toepassingen gericht bij de exportregels.
- Nieuwe koppelingen zonder Revit-naam blijven `Mapping_pending` en blokkeren uitvoer zolang ze actief zijn. Een leeggelaten keuze betekent niet dat een naam is afgeleid.

## Document en voorwaarden lezen

De lezer behoudt alle zes IDS-facetten in zowel toepassing als eisen: `entity`, `property`, `attribute`, `classification`, `material` en `partOf`. Letterlijke tekst blijft exact. Restricties bewaren hun basis, operatoren, waarden en XML, inclusief enumeraties, patronen, grenzen en lengtes. Onbekende en meervoudige inhoud blijft broninformatie; er wordt geen eerste waarde gekozen om de rest te vervangen.

Een ontbrekende `entity` sluit lezen niet uit. Een XML-prefix, ontbrekende `schemaLocation` of lokale/relatieve schemaverwijzing bepaalt niet of het document leesbaar is. `schemaLocation` is een aanwijzing; de app haalt de opgegeven URL niet op. `info/version` is een auteursversie en geen IDS-formaatversie. Expliciete historische/toekomstige formaten blijven alleen als bron beschikbaar. Een onduidelijke verplichte documentstructuur blokkeert omzetting.

| IDS-inhoud | Voorstel voor UDPS |
| --- | --- |
| Vereiste `property`, exacte namen, bekend datatype, ondersteunde aantallen en eenvoudige bekende entiteit | Direct koppelvoorstel. De gebruiker selecteert welke voorstellen worden toegevoegd. |
| Zuivere eindige enumeratie van entiteitsnamen met XML Schema-`string` als basis | Alle genoemde entiteiten moeten bekend zijn en vormen samen de doelen. Geen weggelaten doelen of afgeleide subklassen. |
| Patroon, ontbrekende entiteit of aanvullende toepassing, zoals classificatie/predefined type | Zo nodig concrete IFC-doelen kiezen en de entiteitbrede parameterdefinitie bewust bevestigen. UDPS voert de filters niet uit. |
| Waarde-eis of waarderestrictie | Afzonderlijk bevestigen dat de waarden buiten de UDPS-definitie worden gecontroleerd. De app vult deze waarden niet in. |
| Naamrestrictie of ontbrekend/niet vertaald datatype | Een concrete naam en ondersteund UDPS-datatype kiezen. Er wordt niets geraden. |
| Optionele property | Expliciet kiezen om deze parameterdefinitie voor te bereiden. |
| Verboden property of verboden toepassing | Geen positieve parameterkoppeling; de bron blijft beschikbaar. |
| Andere aantallen dan `minOccurs` 0 of 1 met `maxOccurs="unbounded"`, of onbekende eiscardinaliteit | Bekijken en bewaren; geen positieve parameterdefinitie toevoegen. |
| `entity`, `attribute`, `classification`, `material`, `partOf` als eis, of een quantity set (`Qto_`) | Andere IFC-route; bekijken en bewaren, niet als gewone UDPS-property verzinnen. |

Bij een ontbrekende `maxOccurs` leest de parser de standaardwaarde 1. Ook die specificatie blijft hier alleen als bron beschikbaar; een scopebevestiging heft deze aantallengrens niet op. XML Schema-patronen worden niet uitgevoerd als JavaScript-reguliere expressies om namen of entiteiten te raden.

Toepassingsbevestigingen gelden voor de expliciet getoonde groep van gelijke voorwaarden en betrokken parameters. Gezamenlijke toepassingsgroepen kunnen meerdere parameters omvatten; waardevoorwaarden en optionele eigenschappen blijven per parameter te beoordelen. Verschillende voorwaarden blijven afzonderlijk te beoordelen. Onbekende inhoud wordt geen stilzwijgend goedgekeurde keuze. Beoordeelde voorwaarden en doelen blijven bij de bron en de exportverwijzingen bewaard. Niet-uitgevoerde toepassingsvoorwaarden en waarde-eisen geven blijvende exportwaarschuwingen.

Propertyset- en propertynamen worden niet automatisch getrimd of anders geschreven. Begin-/eindspaties en besturingstekens sluiten een bruikbare uitvoeridentiteit uit; een bewuste naamkeuze verandert alleen het voorstel. De oorspronkelijke tekst blijft staan. De weergegeven IFC-versies en een bekende naam in de catalogus bewijzen geen compatibiliteit met de werkelijk gebruikte IFC-exporter.

## Wijzigingsoverzicht, toepassen en herstel

Bij `IFCMASSDENSITYMEASURE` stelt UDPS het uitvoerdatatype `MassDensity` voor. De gekozen Revit-parametertitel en dit datatype worden samen in de TXT-regel opgenomen. Autodesk gebruikt dit datatype om een massadichtheidswaarde aan een IFC-property te koppelen. [Revit IFC-exporter](https://github.com/Autodesk/revit-ifc/blob/IFC_v25.4.40/Source/Revit.IFC.Export/Exporter/PropertySet/PropertySetEntryMap.cs#L629-L634)

Preview en toepassing gebruiken dezelfde geïndexeerde planning van concrete IFC-entiteit/propertyset/property-combinaties. Herhaalde eisen kunnen daardoor dezelfde exportkoppeling gebruiken en alle herkomstverwijzingen behouden. Het overzicht toont apart hoeveel nieuwe koppelingen ontstaan, bestaande koppelingen worden hergebruikt, conflicten bestaan en selecties niet bruikbaar zijn. Het vermeldt ook welke bestaande lege pending koppelingen worden ingevuld.

Een datatypeconflict, dubbele actieve uitvoeridentiteit, verschillende onverenigbare Revit-keuzes of overschreden limiet wijst de gehele toevoeging af. Het project blijft ongewijzigd. Vlak vóór toepassen wordt de planning opnieuw vergeleken met het getoonde overzicht; als het project veranderde, moet het vernieuwde overzicht opnieuw worden bekeken.

**Laatste IDS-toevoeging ongedaan** werkt binnen de huidige appsessie, zolang hetzelfde project sinds die toevoeging ongewijzigd is. De controle voorkomt dat later werk wordt teruggezet. De actie herstelt de eerdere headers, regels en IDS-bronnen van die toevoeging; het is geen blijvende versiegeschiedenis of vervanging van een JSON-backup.

## Lokale XSD-controle en afzonderlijke IDS-audit

De app voert een echte IDS 1.0-XSD-controle uit met libxml2 2.13.8 via `xmllint-wasm` 5.3.0 in een aparte worker. Het IDS-schema en zijn benodigde ondersteunende schema's zijn vastgezet en lokaal meegeleverd. Netwerkresolutie is uitgeschakeld; schema-URL's uit het ingeladen document worden niet gebruikt. [Herkomst, versies, hashes en licenties](../web/vendor/ids-audit/provenance.json) leggen de meegeleverde bestanden vast.

| Resultaat | Betekenis en bediening |
| --- | --- |
| XSD gecontroleerd | De XML voldoet aan het meegeleverde IDS 1.0-schema. Dit is geen volledige IDS-audit of IFC-modelcontrole. |
| Afwijking van XSD | Echte schemafouten met bronregel waar beschikbaar. Bron lezen/bewaren blijft mogelijk; de dialoog blokkeert toevoegen. |
| Controle niet beschikbaar of verlopen | Geen geldigheidsclaim. De zichtbare melding blijft staan; lezen/bewaren blijft beschikbaar en de beperkte mappingroute kan worden beoordeeld. |
| Ander expliciet formaat | De IDS 1.0-XSD-controle is daarvoor niet beschikbaar; de bron blijft leesbaar zonder omzettingsclaim. |

Tijdens de controle is toevoegen geblokkeerd. Een ongeldige IFC-entiteitsnaam kan technisch toch een XSD-string zijn; daarom is `XSD gecontroleerd` nooit gelijk aan volledige IDS-geldigheid.

Voor ontwikkelcontrole is er daarnaast een afzonderlijke route met de officiële buildingSMART-audittool: [`scripts/ids-audit-reference.py`](../scripts/ids-audit-reference.py). Die gebruikt het vastgezette NuGet-pakket `ids-tool.CommandLine` 1.0.124 met SHA-512-controle. De route vereist een .NET 8-runtime of SDK in de ontwikkelomgeving; de appgebruiker hoeft niets te installeren. Alleen het openbare toolpakket wordt opgehaald; IDS-inhoud blijft lokaal. De browser voert deze .NET-audit niet uit.

```sh
python3 scripts/ids-audit-reference.py --self-test
python3 scripts/ids-audit-reference.py pad/naar/bestand.ids
```

De zelftest onderscheidt een geldig voorbeeld, XSD-ongeldige invoer en XSD-geldige invoer met een onbekende IFC-entiteit. Ontbrekende runtime of een onbeschikbare audit geeft geen geslaagde controle. Dit blijft een documentaudit, geen controle van een IFC-model.

## Bronversies vergelijken

Een nieuwe XML-tekst heeft een eigen SHA-256-identiteit. De gebruiker kiest zelf welke bewaarde bron de vorige versie is; een bestandsnaam of positie-ID is daarvoor geen bewijs. Het overzicht onderscheidt ongewijzigde, gewijzigde, nieuwe, vervallen en niet-eenduidige eisen en kan de betrokken bestaande exportregels aanwijzen.

**Te beoordelen** opent met gewijzigde, nieuwe, vervallen en niet-eenduidige eisen, plus ongewijzigde properties met onbekende betekenis. Bij een niet-eenduidige groep zie je de betrokken specificaties, aantallen per versie en eventuele bestaande exportregels. Iedere eis telt mee in de bovenste aantallen. Kies **Alle eisen** om de eisen afzonderlijk te bekijken. **Bekijk parameter** opent de bijbehorende parameter en, indien aanwezig, zijn voorwaardengroep.

Verschillende expliciete specificatie-ID's gelden als verschillende specificaties. De eerdere eisen worden als vervallen getoond en de huidige eisen als nieuw. Bij een ontbrekende ID kan de vergelijking nog steunen op een unieke inhoudelijke overeenkomst.

Alleen een aantoonbaar unieke, ongewijzigde property-eis met dezelfde bekende document-, IFC-, toepassings- en waardecontext kan eerdere keuzes overnemen. Volgorde of namespace-prefix mag die vergelijking niet bepalen. Een gewijzigd datatype, andere scope, onbekende semantiek, dubbele identifier of onduidelijke voorganger vraagt herbeoordeling. Overnemen overschrijft geen huidige handmatige keuze.

Bij het bewust overnemen wordt `previousDocumentId` als bronrelatie bewaard. De voorganger moet in hetzelfde project bestaan; zelfverwijzingen en cycli zijn ongeldig. De oude brontekst blijft onder de eigen identiteit bewaard. Vervallen eisen verwijderen geen exportregels: de gebruiker beoordeelt het gevolg zelf. Een vergelijking bewijst geen inhoudelijke gelijkwaardigheid buiten de gecontroleerde contexten.

## Bronbewaring en browseropslag

`idsImports` bewaart de volledige gedecodeerde XML-tekst, bestandsnaam, SHA-256-documentidentiteit, geselecteerde eis-ID's, geldige keuzes en zo nodig de expliciet gekozen voorganger. Bij bestandsinvoer worden ook de tekencodering en SHA-256 van de oorspronkelijke bytes bewaard. De tekstidentiteit gebruikt UTF-8; de byte-identiteit onderscheidt bijvoorbeeld coderingen. De oorspronkelijke bestandsbytes worden niet als tweede bestand in JSON opgenomen.

`IDS_requirements` verwijst per exportregel naar document, specificatie en eis en bewaart zo nodig de beoordeelde doelen en voorwaarden. Er wordt geen bSDD-`Source_uri` of bevestigde bSDD-relatie verzonnen. Alle XML en metadata blijven passieve broninformatie. Bewaren en heropenen van de project-JSON behoudt deze gegevens.

Projecten worden automatisch in IndexedDB bewaard. Bestaande projectgegevens uit de oude `localStorage` worden gemigreerd terwijl de oude kopie behouden blijft. Opeenvolgende opslagacties bewaren hun eigen momentopname en worden op volgorde afgehandeld. Een beperkte opslagfallback meldt dat expliciet; bij mislukken vraagt de app een JSON-backup. Een nieuwere, tijdelijk onbereikbare projectversie wordt niet stilzwijgend vervangen door een oudere lokale kopie. Deze browseropslag is geen serversynchronisatie of gedeelde projectmap.

Bij **Alleen bron en keuzes bewaren** wacht de dialoog op het opslagresultaat. Wanneer opslaan mislukt, blijven de actuele keuzes in het geopende project beschikbaar om via **Menu → Project bewaren** een JSON-backup te maken.

Bewaar een JSON-projectbestand voor overdracht en herstel. Een oudere app kan nieuwe keuzes of bronhistorie verwijderen; versies vóór 1.9.0 behouden zelfs `idsImports` niet. De eerdere `localStorage`-kopie is niet automatisch een actuele backup nadat er in IndexedDB verder is gewerkt.

## Achtergrondverwerking, coderingen en grenzen

Bestandsbytes, decodering en XML-parsing worden in een moduleworker afgehandeld. De parserbundel is vastgezet op `@xmldom/xmldom` 0.9.12 en wordt alleen in die worker geladen. [Herkomst en hashes](../web/vendor/ids-parser/provenance.json) en [`scripts/build-ids-parser.mjs`](../scripts/build-ids-parser.mjs) maken de bundel controleerbaar. Voortgang benoemt echte verwerkingsfasen, geen verzonnen percentages.

Sluiten, een andere invoer kiezen of annuleren beëindigt de betrokken worker; een laat antwoord mag geen ander project vullen. Een ontbrekende of geblokkeerde worker geeft een duidelijke fout, zonder stilzwijgend alsnog op de hoofdinterface te parsen. De standaard maximale leestijd is één minuut. De XSD-controle heeft een eigen begrensde verwerkingstijd.

UTF-8 en UTF-16 LE/BE worden herkend via BOM of UTF-16-bytevolgorde. Andere gedeclareerde coderingen werken alleen wanneer de decoder ze ondersteunt. Ongeldige bytes, een tegenstrijdige declaratie/BOM en UTF-32 geven een foutmelding.

| Grens | Maximum |
| --- | --- |
| Oorspronkelijke bestandsbytes en gedecodeerde XML in UTF-8 | Elk 10 MiB |
| Specificaties / facetten per document | 5.000 / 50.000, inclusief geneste entiteitsfacetten |
| XML-elementen / nestniveaus | 250.000 / 64 |
| Bewaarde documenten per project | 20 |
| Bewaarde IDS-bronnen samen, als JSON-projectgegevens | 16 MiB |
| IDS-verwijzingen op projectregels samen na IDS-toevoegen | 50.000 |
| Projectregels na toevoegen | 10.000 |
| Volledige opgemaakte project-JSON bij IDS bewaren/toevoegen | 32 MiB |
| Inkomend JSON-projectbestand bij heropenen | 32 MiB |

Ongeldige XML, een andere root/IDS-namespace, DTD en eigen XML-entiteiten worden afgewezen. Binnen deze grenzen is brede leesbaarheid het doel; er is geen garantie voor ieder bestaand of toekomstig IDS-bestand.

## Testbewijs en officiële bronnen

De regressies lezen **334 ongewijzigde officiële IDS-bestanden, samen 380.272 bytes**, uit buildingSMART-broncommit `870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3`. Ze controleren hashes, volledige XML-tekst en alle toepassings-/eisfacetten en restricties. Het [manifest](../tests/fixtures/ids/official-provenance.json) vermeldt namen, aantallen en licentie.

Aanvullende tests controleren alle zes toepassingsfacetten, ontbrekende entiteiten, prefixes, schemaverwijzingen, coderingen, onbekende inhoud, groepering, directe Revit-koppelingen, conflicten, bronvergelijking, workerannulering en opslagmigratie. De XSD-tests voeren de werkelijke meegeleverde WASM-engine uit met geldige en ongeldige gevallen. De worker- en IndexedDB-tests gebruiken herkenbare Node-adapters; zij bewijzen geen native browseracceptatie. Native bediening en publicatiebewijs worden afzonderlijk bij de bestaande taak vastgelegd.

De upstream labels `pass`, `fail` en `invalid` zijn geen parseracceptatielabels. Leesbare XML bewijst geen geldige IDS, en een geldige XSD-controle bewijst geen volledig geldige IDS of feitelijke IFC-export. Er worden geen IFC-testmodellen meegenomen. Volledige IDS-semantiekcontrole en feitelijke Revit-/IFC-modelacceptatie vallen buiten de browserimport.

© buildingSMART International Ltd. De officiële IDS-bestanden en het ongewijzigde IDS-schema vallen onder [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/), overeenkomstig de [bronlicentie](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/LICENSE), niet onder de MIT-licentie van de app. Overige vendordelen hebben hun eigen meegeleverde licentieteksten en herkomstmanifesten.

- [Officieel IDS 1.0-XSD](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Schema/ids.xsd).
- [Specificaties en cardinaliteit](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/UserManual/specifications.md).
- [Propertyfacet](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/UserManual/property-facet.md).
- [Officiële buildingSMART-audittool](https://github.com/buildingSMART/IDS-Audit-tool).
- [Openbare proefinvoer](../web/examples/required-property.ids), ongewijzigd uit dezelfde officiële testset.
