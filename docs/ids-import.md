# IDS lezen, bewaren en parameterkoppelingen voorbereiden

De import leest een lokaal IDS-document, toont de toepassing en eisen en kan de volledige bron in het project bewaren. Daarna kan de gebruiker geschikte `property`-eisen omzetten naar UDPS-koppelvoorstellen. Dit maakt geen Revit-parameters aan en controleert geen IFC-model. Leesbaarheid is geen bewijs van IDS/XSD-geldigheid of modelconformiteit.

## Document en eisen bekijken

De lezer bewaart alle zes IDS-facetten in zowel toepassing als eisen: `entity`, `property`, `attribute`, `classification`, `material` en `partOf`. Letterlijke tekst blijft exact behouden. Restricties bewaren hun basis, operatoren, waarden en XML; dit geldt ook voor enumeraties, patronen, grenzen en lengtes. Onbekende of meervoudige inhoud blijft beschikbaar. Waarschuwingen markeren onder meer onbekende facetten, waardevormen en een onduidelijke documentstructuur. Er wordt geen eerste waarde gekozen om de rest te vervangen.

De dialoog toont de oorspronkelijke eis en toepassings-XML, zoeken, filters en pagina's. Een ontbrekende `entity` sluit het lezen niet uit. Een XML-prefix, ontbrekende `schemaLocation` of lokale/relatieve schemaverwijzing bepaalt niet of een eis kan worden gelezen. `schemaLocation` wordt als aanwijzing bewaard; er wordt geen schema opgehaald. Een auteursversie in `info/version` is geen IDS-formaatversie. Een expliciet historisch of toekomstig IDS-formaat blijft leesbaar met waarschuwing, maar is alleen als bron te bewaren. Ook een onduidelijke verplichte documentstructuur blokkeert het omzetten.

## Van eis naar platte parameterdefinitie

UDPS.txt beschrijft parameterdefinities voor concrete IFC-entiteiten. Daarom zijn lezen, beoordelen en toevoegen afzonderlijke stappen:

| IDS-inhoud | Gedrag in UDPS |
| --- | --- |
| Vereiste `property`, exacte namen, bekend datatype, ondersteunde toepassingsaantallen en een eenvoudige bekende entiteit | Direct koppelvoorstel; de gebruiker kiest welke voorstellen worden toegevoegd. |
| Zuivere eindige enumeratie van entiteitsnamen met XML Schema-`string` als basis | Alle genoemde entiteiten moeten bekend zijn en vormen samen de doelen. Anders zijn concrete handmatige keuzes nodig. Er worden geen doelen weggelaten of subklassen afgeleid. |
| Patroon, ontbrekende entiteit of extra toepassingsvoorwaarden, zoals predefined type | Kies zo nodig concrete IFC-doelen en bevestig dat de parameterdefinitie voor de gekozen entiteiten geldt. UDPS voert de filters niet uit. |
| Waarde-eis of waarderestrictie | Alleen toevoegen na bevestiging dat de waardevoorwaarden afzonderlijk worden gecontroleerd. UDPS vult geen waarden in en dwingt deze niet af. |
| Naamrestrictie of ontbrekend/niet vertaald datatype | Kies een exacte propertyset, eigenschapsnaam en ondersteund UDPS-datatype. Ontbrekende informatie wordt niet geraden. |
| Optionele property | Alleen toevoegen na expliciete keuze om deze parameterdefinitie voor te bereiden. |
| Verboden property of verboden toepassing | Geen positieve parameterkoppeling; de bron blijft beschikbaar. |
| Andere toepassingsaantallen dan `minOccurs` 0 of 1 met `maxOccurs="unbounded"`, of een onbekende eiscardinaliteit | Bekijken en bewaren; omzetten naar een positieve parameterdefinitie is niet beschikbaar. |
| `entity`, `attribute`, `classification`, `material`, `partOf` als eis, of een quantity set (`Qto_`) | Bekijken en bewaren; deze routes worden niet omgezet naar gewone UDPS-properties. |

Bij een ontbrekende `maxOccurs` gebruikt de lezer de standaardwaarde 1. Ook die specificatie blijft hier alleen als bron beschikbaar; een bevestiging van toepassingsfilters heft deze aantallengrens niet op.

XML Schema-patronen worden niet uitgevoerd als JavaScript-reguliere expressies. Een patroon wordt dus niet gebruikt om automatisch IFC-entiteiten of propertynamen te raden. Handmatige keuzes veranderen uitsluitend het koppelvoorstel; de oorspronkelijke IDS blijft behouden. Keuzes en bevestigingen worden bij de bron en de toegevoegde koppelingen vastgelegd.

Propertyset- en propertynamen worden niet getrimd of anders geschreven. Begin-/eindspaties en besturingstekens sluiten de uitvoeridentiteit uit; de gebruiker moet een exacte bruikbare naam kiezen. De oorspronkelijke tekst blijft in de bron staan. De IFC-versies uit de specificatie blijven zichtbaar. Een naam in de geladen IFC-catalogus bewijst geen schema- of exportercompatibiliteit.

Nieuwe regels krijgen `Mapping_pending` totdat een Revit-parameter is gekoppeld. Bestaande actieve koppelingen met dezelfde uitvoeridentiteit en hetzelfde datatype behouden hun Revit-naam en krijgen de bronverwijzing erbij. Een datatypeconflict, dubbele actieve uitvoeridentiteit of onbruikbare selectie wijst de gehele toevoeging af. Als niet alle eisen als bruikbaar voorstel beschikbaar zijn, benoemt de dialoog dit als gedeeltelijke import. Het aantal geselecteerde eisen staat apart vermeld.

## Bron bewaren en heropenen

**Volledige IDS-bron bewaren** werkt ook zonder een koppelvoorstel te selecteren. Zo blijven bijvoorbeeld classificatie- en materiaaleisen beschikbaar voor beoordeling. Deze actie voegt geen projectregels toe. Een bewaarde bron kan vanuit de dialoog opnieuw worden geopend.

`idsImports` bewaart de volledige gedecodeerde XML-tekst, bestandsnaam, SHA-256-documentidentiteit, geselecteerde eis-ID's en geldige vastgelegde keuzes. Bij bestandsinvoer worden ook de herkende tekencodering en SHA-256 van de oorspronkelijke bytes bewaard. De documentidentiteit is gebaseerd op de XML-tekst in UTF-8; de byte-identiteit onderscheidt bijvoorbeeld verschillende coderingen. De oorspronkelijke bestandsbytes worden niet als afzonderlijk bestand in de project-JSON opgenomen.

`IDS_requirements` verwijst per exportregel naar document, specificatie en eis en bewaart zo nodig de beoordeelde doelen en voorwaarden. Er wordt geen bSDD-`Source_uri` of bevestigde bSDD-relatie verzonnen. De XML en metadata blijven passieve broninformatie. Bewaren en heropenen van de project-JSON behoudt deze gegevens. Een oudere app kan nieuwe keuzemetadata verwijderen; versies vóór 1.9.0 bewaren `idsImports` niet. Bewaar een projectbackup voordat je terugvalt.

## Coderingen en grenzen

De bestandsroute decodeert UTF-8 en UTF-16 LE/BE, met herkenning van BOM of UTF-16-bytevolgorde. Andere expliciet gedeclareerde coderingen werken alleen wanneer de browserdecoder ze ondersteunt. Ongeldige bytes, een tegenstrijdige declaratie/BOM en UTF-32 leveren een foutmelding op.

| Grens | Maximum |
| --- | --- |
| Oorspronkelijke bestandsbytes | 10 MiB |
| Gedecodeerde XML-tekst, gemeten in UTF-8 | 10 MiB |
| Specificaties per document | 5.000 |
| Facetten per document, inclusief geneste entiteitsfacetten | 50.000 |
| XML-elementen / nestniveaus | 250.000 / 64 |
| Bewaarde documenten per project | 20 |
| Bewaarde IDS-bronnen samen, als JSON-projectgegevens | 16 MiB |
| IDS-verwijzingen op projectregels samen na IDS-toevoegen | 50.000 |
| Projectregels na toevoegen | 10.000 |
| Volledige opgemaakte project-JSON bij IDS bewaren/toevoegen | 32 MiB |
| Inkomend JSON-projectbestand bij heropenen | 32 MiB |

Ongeldige XML, een andere root/IDS-namespace, DTD en eigen XML-entiteiten worden afgewezen. De import haalt geen XSD's of externe XML-bronnen op. Binnen deze grenzen is brede leesbaarheid het doel; er is geen garantie voor ieder bestaand of toekomstig IDS-bestand.

## Testbewijs en officiële bronnen

De regressies lezen **334 ongewijzigde officiële IDS-bestanden, samen 380.272 bytes**, uit buildingSMART-broncommit `870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3`. Ze controleren hashes, volledige XML-tekst en alle toepassings-/eisfacetten en restricties. De set bevat 334 toepassingsfacetten en 333 eisfacetten. De oorspronkelijke namen en herkomst staan in het [manifest](../tests/fixtures/ids/official-provenance.json).

De officiële set gebruikt alleen `entity` bij toepassing. Aanvullende zelfgeschreven tests controleren daarom alle zes toepassingsfacetten, ontbrekende entiteiten, prefixes, schemaverwijzingen, coderingen en onbekende/meervoudige inhoud. Plannings- en UI-tests controleren keuzes, bevestigingen, bronbewaring, conflicten en JSON-heropenen. De XML-tests gebruiken `@xmldom/xmldom` 0.9.12 als ontwikkelafhankelijkheid; de app gebruikt de browserparser. Een DOM-adapter bewijst geen native browseracceptatie.

De labels `pass`, `fail` en `invalid` in de officiële bestandsnamen horen bij de upstream testconfiguraties. Alle bestanden kunnen als XML worden gelezen; dat maakt ze niet allemaal geldige IDS en bewijst geen geslaagde IFC-controle. Er worden geen IFC-testmodellen meegenomen. Volledige XSD-validatie, IDS-audit, IFC-modelvalidatie en feitelijke Revit-export vallen buiten dit testbewijs.

© buildingSMART International Ltd. De officiële bestanden vallen onder [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/), overeenkomstig de [bronlicentie](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/LICENSE), en niet onder de MIT-licentie van de app. De bytes zijn ongewijzigd overgenomen.

- [Officieel IDS 1.0-XSD](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Schema/ids.xsd).
- [Specificaties en cardinaliteit](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/UserManual/specifications.md).
- [Propertyfacet](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/UserManual/property-facet.md).
- [Openbare proefinvoer](../web/examples/required-property.ids), eveneens ongewijzigd uit dezelfde officiële testset.
