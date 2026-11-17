# IDS 1.0: beperkte import van parameterkoppelingen

Deze route leest een lokaal IDS-bestand als bron voor voorgestelde parameterkoppelingen. Zij vervangt het bestaande project niet, maakt geen Revit-parameters aan, controleert geen IFC-model en is geen volledige IDS-audit of XSD-validatie.

## Ondersteunde selectie

- Eén letterlijke IFC-entiteit per specificatie, zonder aanvullende toepassingsfilters. De naam moet exact overeenkomen met een entiteit uit de geladen catalogus, na omzetting van de hoofdletters die IDS voorschrijft.
- Een `property`-eis met cardinaliteit `required` (ook de door IDS gedefinieerde standaard), een letterlijke propertyset en propertynaam en een expliciet ondersteund IFC-datatype. De letterlijke IDS-tekst blijft exact behouden: begin-/eindspaties en besturingstekens in uitvoernamen worden niet weggehaald, maar sluiten de eis uit omdat UDPS die identiteit niet betrouwbaar kan bewaren.
- `minOccurs="0"` op een specificatie betekent dat de objecten optioneel voorkomen. Dat maakt de vereiste property op eventuele overeenkomende objecten niet optioneel. De app bewaart de opgegeven aantallen, maar controleert geen aantallen in een model.
- De oorspronkelijke IFC-versies staan bij de specificatie. Een gevonden naam in de huidige IFC 4.3-catalogus is geen bewijs van schema- of exportercompatibiliteit. Controleer de voorgestelde koppelingen voor de werkelijk gebruikte IFC-export.

Niet beschikbare eisen blijven zichtbaar, met een reden en de oorspronkelijke XML. Onder andere: extra toepassingsfacetten, predefined types, optionele of verboden property-eisen, naamrestricties, waarde-eisen, quantities en niet ondersteunde datatypes. Een gedeeltelijke selectie wordt als gedeeltelijke import benoemd. Voor zulke eisen wordt niets stilzwijgend omgezet of verbreed.

Nieuwe regels blijven op `Mapping_pending` staan totdat de gebruiker een Revit-parameter koppelt. Bestaande actieve koppelingen met dezelfde uitvoeridentiteit en hetzelfde datatype worden behouden en krijgen alleen de IDS-bronverwijzing erbij. Afwijkende datatypes of reeds dubbele uitvoeridentiteiten wijzen de gehele selectie af; de projectgegevens blijven dan ongewijzigd.

## Herkomst en bewaren

`idsImports` bewaart per oorspronkelijk bestand één SHA-256-identiteit, bestandsnaam, de volledige oorspronkelijke XML en de geselecteerde eis-ID's. De bestaande JSON-validatie bewaart deze gegevens bij heropenen. Ook niet geïmporteerde eisen blijven zo beschikbaar in het oorspronkelijke bestand. De dialoog kan een bewaarde bron opnieuw tonen.

`IDS_requirements` verwijst per exportregel afzonderlijk naar document, specificatie en eis. IDS-eisen krijgen geen verzonnen bSDD-`Source_uri` en worden niet als bevestigde bSDD-relatie weergegeven. Nieuwe centrale identiteiten zijn lokale IDS-identiteiten. Deze metadata en de ruwe XML zijn passieve broninformatie, geen uitvoerbare instructies.

Grenzen: 2 MiB per IDS, 200 specificaties, 2000 eisen, 20.000 XML-elementen, 64 nestniveaus, maximaal 20 bewaarde documenten en samen 10 MiB oorspronkelijke XML. Een import mag de bestaande grens van 10.000 projectregels niet overschrijden. DTD, eigen XML-entiteiten, onbekende elementnamespaces, ongeldige XML en andere expliciet vermelde IDS-versies worden afgewezen. De app haalt geen XSD's of externe XML-bronnen op.

## Proefbestand en officiële bronnen

[`web/examples/required-property.ids`](../web/examples/required-property.ids) en de identieke testkopie zijn **ongewijzigde** kopieën van buildingSMARTs [officiële testcase](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/ImplementersDocumentation/TestCases/property/pass-a_required_facet_checks_all_parameters_as_normal.ids), opgehaald op 17 november 2026. De proef bevat `IFCWALL`, `Foo_Bar`, `Foo`, `IFCLABEL` en de IFC-versies `IFC2X3 IFC4`. Dit is gecontroleerde openbare proefinvoer, geen bedrijfsspecifieke IDS of daadwerkelijke Revit-acceptatie.

© buildingSMART International Ltd. Het officiële proefbestand valt onder [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/), overeenkomstig de [bronlicentie](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/LICENSE), en niet onder de MIT-licentie van de app.

- [Officieel IDS 1.0-XSD](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Schema/ids.xsd): namespaces, letterlijke waarden, datatypes en cardinaliteiten.
- [Specificaties en cardinaliteit](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/UserManual/specifications.md): toepassing en eisen zijn afzonderlijk.
- [Propertyfacet](https://github.com/buildingSMART/IDS/blob/870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3/Documentation/UserManual/property-facet.md): naam, propertyset, datatype, waarden en quantities.

## Verificatiegrenzen

De Node-tests voeren de werkelijke importplanning, atomische toepassing, bronbewaring, JSON-roundtrip en UI-handlers uit. De UI gebruikt daarbij een herkenbare DOM-adapter; die bewijst geen native browserwerking.

De XML-route is aanvullend uitgevoerd met een tijdelijke, afzonderlijke xmldom 0.9.12-testadapter, zonder runtimeafhankelijkheid aan de app toe te voegen. De officiële proef en een optionele specificatie werden ondersteund. Optionele/verboden properties, extra toepassingsfilters, predefined types, ontbrekende datatypes, waarde-eisen, dubbele propertyset-/propertynamen en naamrestricties werden uitgesloten. Verkeerde/ontbrekende namespaces, oudere versies en ongeldige XML werden afgewezen. Dit is XML-adapterbewijs, geen browser- of volledig IDS-validatiebewijs.

De lokale native Chromium-proef kon niet starten: de runtime blokkeerde de proces-socket voordat de app werd geladen. Native browser- en publicatiebewijs wordt afzonderlijk bij de bestaande taak geregistreerd; het bestaan van een executable is geen geslaagde browsercontrole.
