# UDPS
Webapp voor het beheren van Revit-parameterkoppelingen en het genereren van User Defined Property Sets (UDPS) voor IFC-export. Gebaseerd op de Excel-generator van Jasper Kempen en Stefan van Dijk.

## Gebruik

De webapp staat in `web/` en heeft geen buildstap of externe JavaScript-afhankelijkheden.

- De 59 bronregels zijn ingeladen; 58 staan aan.
- `IfcWindowsw` is gecorrigeerd naar `IfcWindow`, met behoud van de koppelingen.
- Bewerk Revit-parameter, IFC-property, propertyset en datatype direct in de tabel.
- Selecteer per regel de IFC-entiteiten. Filters beperken alleen de weergave, niet de export.
- Bekijk de definitie en download een tabgescheiden UTF-8 `.txt` (BOM en CRLF).
- Bewaar een JSON-project om wijzigingen over te zetten of te archiveren.
- Importeer JSON of een `.xlsx`/`.xlsm` met de tabel `ILS_Gevel`. VBA wordt niet uitgevoerd.

De app verwerkt bestanden lokaal in de browser. Er is geen uploadserver, account of synchronisatie tussen apparaten. Browseropslag kan worden gewist; bewaar daarom een projectbestand.

## Lokaal starten

Met Python 3 en Node.js 22:

```sh
npm start
# Open http://localhost:8080
npm run check
npm test
```

Open de HTML niet rechtstreeks via `file://`: JavaScriptmodules vereisen een webserver.

## Publiceren op GitHub Pages

Ga naar **Settings → Pages → Build and deployment**. Voor een eenvoudige branch-publicatie kun je de inhoud van `web/` als website plaatsen. De meegeleverde `pages.yml` gebruikt GitHub Actions: kies **Source: GitHub Actions** en start daarna de workflow **Publiceer webapp** via **Actions → Run workflow**. De workflow test de code voor publicatie. GitHub toont de uiteindelijke website-URL bij Pages en de deployment.

Je kunt de bestanden `index.html`, `style.css`, `app.js`, `core.js`, `excel.js` en daarnaast `data.js` uit `web/` ook samen naar een eigen webserver uploaden. `initial.json` is de leesbare bronkopie.

## Verschillen ten opzichte van de Excelmacro

De selectievoorwaarden (`x`), volgorde van propertysets/entiteiten en de parameterregels volgen de macro. De standaardexport bevat 50 blokken en 416 koppelingen, met `I/T`. De commentaarheader is aangepast voor de webversie. Lege blokken overslaan is optioneel. Propertysetnamen worden exact vergeleken, zodat gelijkende namen niet samenvallen zoals bij een substringcontrole.

De bron bevat twee mappings met dezelfde IFC-property `3.7 Materiaal` binnen `ILS Ontwerp en Engineering` (materiaal binnen en buiten). Beide blijven behouden; de app waarschuwt hiervoor. Beoordeel deze mappings voor gebruik in Revit.

Een browser kan de automatische netwerkmap- en Excel-opslaghandelingen uit VBA niet overnemen. Downloads en projectback-ups vervangen deze stappen. Type-export kan IFC-type-entiteiten vereisen, afhankelijk van de gebruikte exporter. Validatie is geen volledige IFC-schemavalidatie en daadwerkelijke Revit-export moet in je eigen omgeving worden gecontroleerd.

## Herkomst en licentie

Gebaseerd op de generator van Jasper Kempen en Stefan van Dijk, Rollecate. De repository gebruikt de bestaande MIT-licentie. De huidige copyrightvermelding is ongewijzigd behouden; laat de rechthebbende organisatie en exacte juridische naam vaststellen voordat deze worden aangepast.
