# UDPS: contracten en verificatie

Gecontroleerde basis: main `8dd81cff62c4d060d235945b5f79ba7ce1537657`, versie 1.8.0. Herstelrelease: 1.8.1. Operationele taken, besluiten en actuele acceptatiestatus staan in [Digitaal Bouwen](https://app.notion.com/p/41a0dde84cc181479445d9417177cf27); dit document is geen tweede takenlijst.

## Bestaande verantwoordelijkheden

| Bestanden | Verantwoordelijkheid |
| --- | --- |
| `app.js`, `*-ui.js`, `index.html` | Bediening, selectie, meldingen en koppeling met de domeinfuncties. |
| `core.js`, `mapping.js`, `uniform.js`, `libraries.js` | Projectvalidatie, export, identiteit, toepassingen, centrale afspraken en bibliotheekformaat. |
| `bsdd.js`, `sources.js`, `products.js`, `linked-data.js`, `property-loader.js` | Openbare broncontracten, paginering, bronrelaties en normalisatie. |
| `source-store.js` | Lokale bibliotheken, bronkeuzes en broncaches; updatevoorstellen worden pas na toepassen actief. |
| `excel.js` | Lokale OOXML-import zonder macro-uitvoering. |

Deze grenzen zijn bruikbaar. Er is bij de gerichte nulmeting geen noodzaak aangetoond voor een frameworkmigratie, backend of algemene herbouw.

## Contracten die behouden moeten blijven

- Een bron-URI bepaalt bronidentiteit. Gelijke namen bewijzen geen gelijke betekenis; samenbrengen vraagt een inhoudelijke onderbouwing.
- Elke actieve combinatie van IFC-entiteit, propertyset en property heeft maximaal één mapping. Conflicten blokkeren zowel downloaden als kopiëren; zonder koppelingen zijn beide acties uitgeschakeld.
- Bronrelaties, onderdelen en vergelijkbare begrippen leiden niet automatisch tot overname of gelijkstelling. Eigen IFC-afspraken blijven expliciet herkenbaar.
- Centrale standaardwijzigingen behouden afwijkende toepassingen, tenzij de gebruiker alle afwijkingen bewust vervangt. Een opgeslagen lege Revit-standaard is een waarde, geen ontbrekende instelling.
- Een historische lege Revit-naam behoudt de bestaande fallback op de IFC-propertynaam bij andere wijzigingen. Een nieuwe ontbrekende koppeling of bewust leeggemaakte naam blijft te koppelen.
- Samenbrengen toetst de mappingdatatypes, bekende genormaliseerde brondatatypes en primaire én alle bewaarde broncontexten op eenheden, keuzewaarden en voorwaarden. Nieuwe broncontexten bewaren zowel het oorspronkelijke als het genormaliseerde datatype. Oudere contexten zonder datatype kunnen niet achteraf worden bevestigd; ontbrekende metadata worden niet verzonnen. Afwijzing is atomair; er vindt geen waardenconversie plaats. Technische overeenstemming bewijst nog geen semantische gelijkheid.
- Een bronupdate past uitsluitend de gecontroleerde broncaches toe. Bibliotheken, register, bronkeuzes en overige tussentijdse caches blijven behouden. Het gekozen updatevoorstel is leidend voor de specifiek gecontroleerde caches.
- Een bibliotheekversie wordt niet stilzwijgend overschreven. Projecten bewaren koppelingen en metadata; bibliotheekbestanden worden afzonderlijk meegenomen.
- Excelimport leest geen macro's. De werkelijke uitvoer van elk ZIP-onderdeel is begrensd op 30 MiB en moet overeenkomen met de opgegeven grootte, voordat XML wordt geparseerd.
- UDPS.txt gebruikt UTF-8 met BOM, CRLF, tabs en de bestaande I/T-instelling. Een geldige generatortest bewijst geen feitelijke Revit-export.

## Uitvoerbare controles

```sh
npm run check
npm test
```

De regressies gebruiken de echte domeinfuncties en apphandlers. DOM-adapters en opgeslagen API-antwoorden zijn herkenbaar als geautomatiseerde tests; zij bewijzen geen live netwerk- of browseracceptatie. De exportcontrole omvat dubbele definities, ontbrekende Revit-koppelingen, lege projecten en geldige uitvoer. De Excel-controle gebruikt echte gecomprimeerde ZIP-bytes en controleert de grens vóór XML-parsing.

## Werkelijke gebruikersacceptatie

Gebruik een afzonderlijke browserorigin en gecontroleerde testdata, zodat bestaande projecten behouden blijven. Leg bij de Notion-taak revisie, browser/omgeving, invoer, handeling en verwacht/werkelijk resultaat vast.

1. Open een project met een exportconflict: beide uitvoeracties moeten blokkeren. Corrigeer of deactiveer het conflict: geldige uitvoer moet weer beschikbaar zijn.
2. Kies een bouwproduct/IFC-entiteit, selecteer eigenschappen, koppel Revit-parameters en controleer de export. Herhaal toevoegen: bestaande mappings mogen niet worden overschreven.
3. Bewaar centrale defaults en een afwijking per entiteit; wijzig de standaard zonder afwijkingen te vervangen. Bewaar/heropen het project en controleer identiteit en uitzonderingen.
4. Controleer bronnen op updates, importeer daarna een eigen bibliotheek of wijzig de bronkeuze en pas de update toe. De tussentijdse gebruikerskeuzes moeten blijven bestaan.
5. Controleer netwerkfouten en herstel. Benoem het gebruik van opgeslagen brondata en gedeeltelijke antwoorden; een mislukte bron mag geslaagde resultaten niet verbergen.
6. Controleer de gepubliceerde releaseversie en module-URL's na herladen. Een CI-resultaat bewijst alleen de betrokken revisie en uitgevoerde checks.

Voor live bSDD-aanvragen moet buildingSMART de browserorigin van de website toelaten via CORS. Volgens de [officiële API-instructies](https://technical.buildingsmart.org/services/bsdd/using-the-bsdd-api/) moet een website of SPA hiervoor zijn URL aanmelden. Voor deze publicatie is de origin `https://stefan-van-dijk.github.io` en de app-URL `https://stefan-van-dijk.github.io/UDPS/`. Een HTTP 200 buiten de browser bewijst deze toegang niet; controleer live ophalen vanuit de gepubliceerde app. Opgeslagen brondata en eigen bibliotheken bewijzen geen actuele live broninhoud.

## Revit buiten deze opdracht

Op verzoek van Jasper op 16 november 2026 is testen in Revit uit deze opdracht verwijderd. De [bestaande taak](https://app.notion.com/p/41a0dde84cc181e99551df37cf00cd86) is als vervallen afgesloten. Er is geen Revit-test uitgevoerd; de browser- en generatortests bewijzen geen feitelijke Revit-/IFC-export. Revit vormt geen blokkade voor afronding van deze opdracht.

Alleen bij een later expliciet gevraagde Revit-proef: gebruik een gecontroleerde kopie van een model met deur en raam. Leg Revit-versie, IFC-exporterversie, taal, IFC-schema, exportinstellingen, bronmodel en apprevisie vast. Geef testparameters vooraf bekende tekst-, lengte- en booleaanse waarden; neem een bewuste afwijking per entiteit en een historische lege Revit-naam mee. Genereer de TXT, selecteer die bij de door de gebruiker gedefinieerde propertysets en inspecteer de werkelijke IFC-entiteiten, propertyset-/propertynamen, waarden, datatype en eenheden. Bewaar de feitelijke resultaten bij de dan geldende taak.

Primaire instructies: [Autodesk Revit 2025](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-0968B3FF-832B-4155-8B36-E848ACC97B95.htm) en [IFC-exportinstellingen Revit 2024](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm). Het gedrag voor instance/type en gelokaliseerde parameternamen moet met de werkelijk gebruikte exporter worden vastgesteld; deze release wijzigt de bestaande I/T-keuze niet.

## Publicatie en herstel

De bestaande GitHub Pages-workflow controleert syntax en tests vóór publicatie. Versie-URL's worden met `npm run version:app -- X.Y.Z` gelijkgetrokken; de regressietest controleert de volledige moduleketen. Deze release verandert het project- of bibliotheekschema niet. Maak voor een praktijktest een JSON-projectbackup en bewaar eigen bibliotheken apart.

Terugvalbasis is de ongewijzigde release 1.8.0 op `8dd81cff`. Een terugval naar de oude app herintroduceert de beschreven gebreken; behoud de huidige bestanden en leg de reden bij de taak vast. Er is geen daadwerkelijke rollback van gebruikersdata uitgevoerd of als getest aangemerkt.
