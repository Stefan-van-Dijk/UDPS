# UDPS: contracten en verificatie

Historische nulmeting: main `8dd81cff62c4d060d235945b5f79ba7ce1537657`, versie 1.8.0. Herstelrelease: 1.8.1. Gedeelde taken, besluiten en actuele acceptatiestatus staan in het [wijzigingenlog](change-notes/) en worden volgens de [samenwerkingswerkwijze](collaboration/README.md) in ieders eigen Notion-project bijgehouden. Het [bestaande dossier in Digitaal Bouwen](https://app.notion.com/p/41a0dde84cc181479445d9417177cf27) blijft behouden; dit technische document is geen tweede takenlijst.

## Bestaande verantwoordelijkheden

| Bestanden | Verantwoordelijkheid |
| --- | --- |
| `app.js`, `*-ui.js`, `index.html` | Bediening, selectie, meldingen en koppeling met de domeinfuncties. |
| `core.js`, `mapping.js`, `uniform.js`, `libraries.js` | Projectvalidatie, export, identiteit, toepassingen, centrale afspraken en bibliotheekformaat. |
| `bsdd.js`, `sources.js`, `products.js`, `linked-data.js`, `property-loader.js` | Openbare broncontracten, paginering, bronrelaties en normalisatie. |
| `source-store.js` | Lokale bibliotheken, bronkeuzes en broncaches; updatevoorstellen worden pas na toepassen actief. |
| `excel.js` | Lokale OOXML-import zonder macro-uitvoering. |
| `ids-document.js` | Begrensd decoderen en lezen van IDS-documenten, alle zes facetten, restricties en oorspronkelijke XML. |
| `ids.js`, `ids-workflow.js`, `ids-ui.js` | Exacte parameterwerklaag, koppelkeuzes, wijzigingspreview, atomische import, bronbewaring en bediening. |
| `ids-loader.js`, `ids-worker.js` | Achtergrondverwerking van bestandsbytes en XML met echte annulering. |
| `ids-revisions.js` | Inhoudelijke bronvergelijking en beperkt hergebruik van aantoonbaar ongewijzigde keuzes. |
| `ids-audit.js`, `vendor/ids-audit/` | Werkelijke lokale XSD-controle met vastgezette engine/schema's; geen volledige browser-IDS-audit of IFC-modelcontrole. |
| `project-storage.js` | IndexedDB-projectopslag, geordende momentopnamen, behoud van legacy-opslag en expliciete fallback. |

Deze grenzen zijn bruikbaar. Er is bij de gerichte nulmeting geen noodzaak aangetoond voor een frameworkmigratie, backend of algemene herbouw.

Vanaf 1.9.0 kan IDS als passieve projectmetadata worden bewaard. De route in
1.11.0 scheidt bron lezen/controleren, gegroepeerde parameters koppelen en de
werkelijke projectwijzigingen controleren/toepassen. [IDS-import](ids-import.md)
beschrijft koppelkeuzes, bronvergelijking, opslag, grenzen en testdekking;
[Raam/Dakraam](bsdd-window-mapping.md) bezit het concrete bSDD-brononderzoek.
Bestaande bron- en IFC-validaties blijven van toepassing.

## Contracten die behouden moeten blijven

- Een bron-URI bepaalt bronidentiteit. Gelijke namen bewijzen geen gelijke betekenis; samenbrengen vraagt een inhoudelijke onderbouwing.
- IDS lezen vereist geen directe UDPS-vertaling: alle zes facetten, restricties,
  exacte tekst en onbekende/meervoudige inhoud blijven beschikbaar. De volledige
  bron kan zonder nieuwe projectregels worden bewaard. Niet-propertyfacetten
  en quantities blijven ter beoordeling in de bron; zij worden geen gewone
  UDPS-properties of bSDD-bronrelaties.
- IDS-koppelingen beschrijven parameterdefinities voor gekozen IFC-entiteiten.
  Extra toepassingsfilters of handmatige doelen vragen expliciete bevestiging
  van deze vlakke toepassing; waardevoorwaarden vragen afzonderlijke bevestiging.
  Een eindige entiteitsenumeratie levert de vereniging van alle bekende doelen;
  onbekende doelen worden niet weggelaten. Patronen worden niet als JavaScript-
  regex uitgevoerd. Namen blijven exact en ontbrekende datatypes vragen een
  handmatige keuze. Verboden eigenschappen/toepassingen en niet ondersteunde
  aantallen leveren geen positieve koppeling op; ook de standaardwaarde
  `maxOccurs=1` blijft alleen als bron beschikbaar. Optionele eigenschappen
  vragen een expliciete keuze.
- De IDS-parameterwerklaag groepeert exacte propertyset/naam/datatype-definities.
  Alle afzonderlijke eisen, IFC-toepassingen en scope-/waardecontexten blijven
  bereikbaar. Verschillende datatypes blijven apart; groeperen bewijst geen
  semantische gelijkheid en voegt bestaande centrale groepen niet automatisch samen.
  Nieuwe IDS-regels van dezelfde definitie binnen één bron delen een centrale
  identiteit, met afzonderlijke toepassingen en herkomstverwijzingen.
- Revit-namen kunnen tijdens import worden gekozen, met uitzonderingen per
  entiteit. Bestaande ingevulde namen blijven behouden. Alleen een lege pending
  regel met precies één IFC-entiteit kan via deze route worden ingevuld;
  historische lege of gedeelde regels blijven behouden. Nieuwe lege namen
  blijven pending en blokkeren export zolang de regels actief zijn.
- Preview en toepassen gebruiken dezelfde geïndexeerde importplanning. Nieuw,
  hergebruik, conflicten, overslaan en het invullen van bestaande pending regels
  worden vooraf getoond. Conflicten en limietoverschrijdingen wijzen de gehele
  mutatie af; vlak vóór toepassen moet de actuele planning nog overeenkomen met
  het getoonde overzicht. Teruggaan en annuleren wijzigen geen mappings.
  Ongedaan maken is alleen beschikbaar voor de laatste IDS-toevoeging in dezelfde
  appsessie zolang hetzelfde project daarna ongewijzigd bleef.
- Extra toepassings- en waardevoorwaarden vragen afzonderlijke bevestiging per
  inhoudelijke voorwaardengroep. Een bevestiging geldt niet ongemerkt voor alle
  properties of nieuwe/gewijzigde voorwaarden. Niet-uitgevoerde voorwaarden
  houden een exportwaarschuwing na JSON-heropenen.
- Bronvergelijking gebruikt unieke identifiers en gecontroleerde inhoud, geen
  bestandsnaam of eispositie als bewijs. Alleen aantoonbaar ongewijzigde bekende
  contexten kunnen keuzes overnemen. Veranderde scope/waarden/datatype en
  ambiguïteit vragen herbeoordeling; vervallen eisen verwijderen geen exportregels.
  Een bewust gekozen voorganger wordt als `previousDocumentId` bewaard en moet
  bestaan; bronhistorie mag geen zelfverwijzing of cyclus bevatten.
- De volledige gedecodeerde XML, bronidentiteiten en vastgelegde keuzes/
  eisverwijzingen overleven bewaren en heropenen. Een oudere app kan nieuwe
  keuzemetadata of bronhistorie verwijderen; vóór 1.9.0 blijft ook `idsImports`
  niet behouden. Bewaar een projectbackup voordat je terugvalt.
  Bestandsbytes en XML in UTF-8 zijn elk begrensd op 10 MiB; maximaal 20 bronnen
  gebruiken samen 16 MiB JSON-projectgegevens. IDS-toevoegen toetst maximaal
  50.000 verwijzingen op projectregels. Bewaren/toevoegen toetst ook de volledige
  opgemaakte project-JSON aan 32 MiB; JSON-heropenen heeft dezelfde bestandsgroottegrens.
- Bytes, decodering en XML-parsing gebeuren in een worker met de vastgezette
  parserbundel. Annuleren beëindigt de worker; een laat resultaat mag geen ander
  project vullen. Een ontbrekende/geblokkeerde worker geeft een fout in plaats
  van een stilzwijgende hoofdthreadfallback. XML wordt pas op bronverzoek getoond.
- De browser voert echte XSD-validatie uit met lokale libxml2-WASM en vastgezette
  ondersteunende schema's, zonder schema-URL's uit invoer op te halen. Ongeldige
  XSD blokkeert toevoegen, niet het bewaren van de bron. Een onbeschikbare controle
  blijft zichtbaar en geeft geen successtatus. XSD-geldigheid is geen volledige
  IDS-audit of modelconformiteit. De officiële .NET-documentaudit is een afzonderlijke
  ontwikkelreferentie via `scripts/ids-audit-reference.py`; de browser voert die niet uit.
- IndexedDB bewaart projectmomentopnamen in volgorde; legacy `localStorage` wordt
  gemigreerd zonder de oude kopie te verwijderen. Fallback of opslagfalen wordt
  zichtbaar gemeld met een JSON-backupadvies. Een nieuwere onbereikbare versie mag
  geen oudere kopie stilzwijgend actueel maken. Dit is lokale opslag, geen
  serversynchronisatie. JSON-backups blijven nodig voor overdracht en herstel.
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
npm ci
npm run check
npm test
```

De regressies gebruiken de echte domeinfuncties en apphandlers. DOM-adapters en opgeslagen API-antwoorden zijn herkenbaar als geautomatiseerde tests; zij bewijzen geen live netwerk- of browseracceptatie. De exportcontrole omvat dubbele definities, ontbrekende Revit-koppelingen, lege projecten en geldige uitvoer. De Excel-controle gebruikt echte gecomprimeerde ZIP-bytes en controleert de grens vóór XML-parsing.

De IDS-leestest controleert 334 ongewijzigde officiële IDS-bestanden op
SHA-256, volledige XML en behoud van alle facetten en restricties. Aanvullende
tests controleren alle zes toepassingsfacetten, ontbrekende entiteiten,
prefixes, coderingen, gegroepeerde definities, directe Revit-keuzes, conflicten,
bronvergelijking, geordende opslag en gegevensbehoud. Zie het
[herkomstmanifest](../tests/fixtures/ids/official-provenance.json).

De XSD-tests voeren de werkelijk meegeleverde libxml2-WASM-engine uit; een
geldig voorbeeld en ongeldige structuren geven verschillende resultaten.
Worker- en IndexedDB-tests gebruiken herkenbare Node-adapters en bewijzen geen
native browseracceptatie. De labels `pass`/`fail`/`invalid` in het upstream corpus
zijn geen parseracceptatielabels: leesbaarheid bewijst geen geldige IDS.

De afzonderlijke officiële ontwikkelreferentie is uitvoerbaar met een aanwezige
.NET 8-runtime/SDK:

```sh
python3 scripts/ids-audit-reference.py --self-test
```

Het script controleert de vastgezette pakketdigest en onderscheidt geldige,
XSD-ongeldige en XSD-geldige maar inhoudelijk ongeldige IDS-invoer. Een ontbrekende
runtime is een onbeschikbare controle, geen geslaagde audit. Inputbestanden worden
niet naar een externe dienst gestuurd. Browser-XSD-controle, volledige
IDS-documentaudit en feitelijke IFC-modelcontrole blijven afzonderlijke bewijsvragen.

## Werkelijke gebruikersacceptatie

Gebruik een afzonderlijke browserorigin en gecontroleerde testdata, zodat bestaande projecten behouden blijven. Leg bij de Notion-taak revisie, browser/omgeving, invoer, handeling en verwacht/werkelijk resultaat vast.

1. Open een project met een exportconflict: beide uitvoeracties moeten blokkeren. Corrigeer of deactiveer het conflict: geldige uitvoer moet weer beschikbaar zijn.
2. Kies een bouwproduct/IFC-entiteit, selecteer eigenschappen, koppel Revit-parameters en controleer de export. Herhaal toevoegen: bestaande mappings mogen niet worden overschreven.
3. Bewaar centrale defaults en een afwijking per entiteit; wijzig de standaard zonder afwijkingen te vervangen. Bewaar/heropen het project en controleer identiteit en uitzonderingen.
4. Controleer bronnen op updates, importeer daarna een eigen bibliotheek of wijzig de bronkeuze en pas de update toe. De tussentijdse gebruikerskeuzes moeten blijven bestaan.
5. Controleer netwerkfouten en herstel. Benoem het gebruik van opgeslagen brondata en gedeeltelijke antwoorden; een mislukte bron mag geslaagde resultaten niet verbergen.
6. Controleer de gepubliceerde releaseversie en module-URL's na herladen. Een CI-resultaat bewijst alleen de betrokken revisie en uitgevoerde checks.
7. Laad een IDS met dezelfde property in meerdere specificaties en entiteiten. De parameterlijst toont één exacte definitie en alle onderliggende eisen blijven bereikbaar. Kies een standaard Revit-naam en een entiteitsafwijking; vergelijk preview en werkelijke regels/herkomst.
8. Herhaal een import met ingevulde bestaande namen, een lege single-entity pending regel en een historische/gedeelde lege regel. Alleen de bedoelde pending koppeling mag worden ingevuld. Een datatypeconflict wijst de hele toevoeging af. Test annuleren en Ongedaan maken; een latere projectwijziging moet onveilig terugzetten blokkeren.
9. Vergelijk bewust gekozen bronversies met herschikte eisen en gewijzigde scope/waarden. Alleen uniek ongewijzigde keuzes mogen worden overgenomen. Verifieer `previousDocumentId`, behoud van oude XML en zichtbaarheid van betrokken exportregels; vervallen eisen mogen niets automatisch verwijderen.
10. Controleer een XSD-geldig en XSD-ongeldig document in de browser. Ongeldig blokkeert toevoegen terwijl bronbewaring werkt. Controleer een onbeschikbare controle en de expliciete grens tussen XSD, IDS-inhoudsaudit en IFC-modelcontrole.
11. Open een legacy-project, wijzig/bewaar/herlaad via IndexedDB en download/heropen JSON. Test opslagfalen en behoud van de oudere kopie. Een nieuwere onbereikbare projectversie mag niet als een succesvolle oude herstelactie worden gepresenteerd.
12. Start verwerking en sluit of vervang het project tijdens lezen/controleren. De worker moet stoppen en een laat antwoord mag geen ander project vullen. Geen percentages tonen zonder gemeten voortgang; responsiviteit bij grote bestanden is afzonderlijk te meten.

Voor live bSDD-aanvragen moet buildingSMART de browserorigin van de website toelaten via CORS. Volgens de [officiële API-instructies](https://technical.buildingsmart.org/services/bsdd/using-the-bsdd-api/) moet een website of SPA hiervoor zijn URL aanmelden. Voor deze publicatie is de origin `https://stefan-van-dijk.github.io` en de app-URL `https://stefan-van-dijk.github.io/UDPS/`. Een HTTP 200 buiten de browser bewijst deze toegang niet; controleer live ophalen vanuit de gepubliceerde app. Opgeslagen brondata en eigen bibliotheken bewijzen geen actuele live broninhoud.

## Revit buiten deze opdracht

Op verzoek van Jasper op 16 november 2026 is testen in Revit uit deze opdracht verwijderd. De [bestaande taak](https://app.notion.com/p/41a0dde84cc181e99551df37cf00cd86) is als vervallen afgesloten. Er is geen Revit-test uitgevoerd; de browser- en generatortests bewijzen geen feitelijke Revit-/IFC-export. Revit vormt geen blokkade voor afronding van deze opdracht.

Alleen bij een later expliciet gevraagde Revit-proef: gebruik een gecontroleerde kopie van een model met deur en raam. Leg Revit-versie, IFC-exporterversie, taal, IFC-schema, exportinstellingen, bronmodel en apprevisie vast. Geef testparameters vooraf bekende tekst-, lengte- en booleaanse waarden; neem een bewuste afwijking per entiteit en een historische lege Revit-naam mee. Genereer de TXT, selecteer die bij de door de gebruiker gedefinieerde propertysets en inspecteer de werkelijke IFC-entiteiten, propertyset-/propertynamen, waarden, datatype en eenheden. Bewaar de feitelijke resultaten bij de dan geldende taak.

Primaire instructies: [Autodesk Revit 2025](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-0968B3FF-832B-4155-8B36-E848ACC97B95.htm) en [IFC-exportinstellingen Revit 2024](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm). Het gedrag voor instance/type en gelokaliseerde parameternamen moet met de werkelijk gebruikte exporter worden vastgesteld; deze release wijzigt de bestaande I/T-keuze niet.

## Publicatie en herstel

De bestaande GitHub Pages-workflow controleert syntax en tests vóór publicatie. Versie-URL's worden met `npm run version:app -- X.Y.Z` gelijkgetrokken; de regressietest controleert de volledige moduleketen. Het JSON-projectformaat behoudt versie 1 en optionele IDS-metadata wordt uitgebreid; browseropslag gebruikt IndexedDB met behoud van de legacy-kopie. Oudere apps kunnen nieuwe keuzes of bronhistorie verwijderen. Maak voor een praktijktest een JSON-projectbackup en bewaar eigen bibliotheken apart.

Terugvalbasis is de ongewijzigde release 1.8.0 op `8dd81cff`. Een terugval naar de oude app herintroduceert de beschreven gebreken; behoud de huidige bestanden en leg de reden bij de taak vast. Er is geen daadwerkelijke rollback van gebruikersdata uitgevoerd of als getest aangemerkt.
