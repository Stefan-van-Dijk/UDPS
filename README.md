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

Je kunt de bestanden `index.html`, `style.css`, `app.js`, `core.js`, `excel.js`, `sources.js`, `sources-ui.js`, `catalog.json` en `data.js` plus de map `assets/` uit `web/` ook samen naar een eigen webserver uploaden. `initial.json` is de leesbare bronkopie.

## Verschillen ten opzichte van de Excelmacro

De selectievoorwaarden (`x`), volgorde van propertysets/entiteiten en de parameterregels volgen de macro. De export bevat 45 gevulde blokken en 416 koppelingen, met vaste toepassing `I/T` en bestandsnaam `UDPS.txt`. De commentaarheader is aangepast voor de webversie. Lege blokken worden altijd overgeslagen. Propertysetnamen worden exact vergeleken, zodat gelijkende namen niet samenvallen zoals bij een substringcontrole.

De bron bevat twee mappings met dezelfde IFC-property `3.7 Materiaal` binnen `ILS Ontwerp en Engineering` (materiaal binnen en buiten). Beide blijven behouden; de app waarschuwt hiervoor. Beoordeel deze mappings voor gebruik in Revit.

Een browser kan de automatische netwerkmap- en Excel-opslaghandelingen uit VBA niet overnemen. Downloads en projectback-ups vervangen deze stappen. Type-export kan IFC-type-entiteiten vereisen, afhankelijk van de gebruikte exporter. Validatie is geen volledige IFC-schemavalidatie en daadwerkelijke Revit-export moet in je eigen omgeving worden gecontroleerd.

## Herkomst en licentie

Gebaseerd op de generator van Jasper Kempen en Stefan van Dijk, Rollecate. De repository gebruikt de bestaande MIT-licentie. De huidige copyrightvermelding is ongewijzigd behouden; laat de rechthebbende organisatie en exacte juridische naam vaststellen voordat deze worden aangepast.


## Bronnen en updates (webversie 1.1)

IFC-kolommen linken op exacte `code` naar de URI uit het buildingSMART IFC 4.3-woordenboek. Er worden geen IFC-versies automatisch omgezet. ILS-klassen en -eigenschappen komen uit `https://digitalbuildingdata.tech/ils-ontwerp-en-engineering-2` via de bSDD Dictionary API. De meegeleverde momentopname is opgehaald op 12 november 2026: IFC 4.3, ILS 2.0.1; beide bronnen melden status Preview. ILS bevat 308 klassen en 127 eigenschappen. Alle 2163 IFC-bronrecords zijn opgehaald met paginering (de API geeft maximaal 1000 records per pagina).

Klik **Koppel ILS** op een parameterregel en selecteer de bron-eigenschap. De URI is de identiteit; code en bronversie worden meegenomen in het JSON-project. Namen, datatype en Revit-mapping worden nooit automatisch veranderd. De oude Excelnamen worden niet op basis van een gelijkenis automatisch aan ILS 2.0 gekoppeld. Klassen zijn doorzoekbaar als referentie; een klasse is geen eigenschap en kan niet als propertybinding worden gekozen.

**Controleren op updates** haalt de drie volledige collecties opnieuw op en toont toegevoegde, gewijzigde en verdwenen records. **Bronupdate toepassen** vervangt uitsluitend de lokale broncatalogus. Mislukte, gedeeltelijke of tijdens het ophalen veranderde antwoorden worden niet toegepast. Bij een verdwenen gekoppelde URI verschijnt “Niet meer in bron”; de mapping blijft behouden. Updates gelden voor dezelfde opgegeven dictionary-URI. Een nieuwe versie onder een andere URI vereist een bewuste migratie.

De bronlijsten worden lokaal gecachet. Openbare bSDD-verzoeken bevatten geen projectdata. Bij netwerk-/CORS-problemen blijft de meegeleverde of laatst opgeslagen catalogus beschikbaar en verschijnt een foutmelding. De live updatefunctie moet in de gebruikte browser toegang tot api.bsdd.buildingsmart.org hebben.

Brondata en logo vallen niet onder de MIT-softwarelicentie: IFC vermeldt CC BY-ND 4.0; ILS vermeldt “No license (rights reserved)”. Bronvermeldingen: buildingSMART International en digiGO. Het Rollecate-logo is afkomstig van https://www.rollecate.nl/img/logo-rollecate.svg. De stylesheet gebruikt de kleuren en typografie van rollecate.nl. Montserrat wordt via Google Fonts geladen, met lokale fallback.

Publicatie via GitHub Pages start vanaf deze versie automatisch na een push op main. De workflow blijft ook handmatig te starten.

### Broninvoer (1.3)

Via **+ Broneigenschap** kies je eerst een IFC-entiteit, vervolgens een bSDD-woordenboek en een daaraan gerelateerde bronklasse. Alleen de enkelvoudige eigenschappen die bSDD voor die klasse publiceert, met een propertyset, worden aangeboden. De eigenschap-URI, bronklasse, bronwoordenboek en versie blijven in het JSON-project bewaard. Naam, propertyset en datatype volgen de klasse-eigenschap; de gebruiker vult de Revit-parameter in. Een datatypevertaling en exportdetails blijven aanpasbaar. Bestaande invulling blijft zichtbaar. Andere IFC-entiteiten of Revit-parameters kunnen via een aanvullende regel worden gekoppeld.

**Bronnen beheren** laat woordenboeken uit de publieke bSDD-lijst toevoegen/verbergen. ILS O&E en IFC zijn standaard beschikbaar. De lijst kan worden vernieuwd. Eigenschappen en relaties worden pas bij selectie opgehaald en lokaal gecachet. Verbergen verwijdert geen projectdata. **Updates** vergelijkt de IFC-catalogus en geladen klasserelaties van ingeschakelde bronnen, waarna de gebruiker de update kan toepassen; projectkoppelingen worden nooit overschreven.

De gedeeltelijke momentopname in `web/relations.json` bevat de bSDD-woordenboekenlijst en enkele geverifieerde ILS-klasserelaties. Niet opgenomen klassen worden live geladen. Een mislukte aanvraag (netwerk, CORS of HTTP 429) toont een fout en verzint geen relaties of lege successen. Niet alle bronnen hebben IFC-relaties of UDPS-geschikte eigenschappen. Klassen erven in bSDD niet automatisch eigenschappen van hun bovenliggende klasse; de app voegt zulke eigenschappen ook niet zelf toe. Brondata houden de eigen licenties; de MIT-licentie van de app geldt niet voor die data.

Nieuwe bronkoppelingen worden bij toevoegen en bij aanvinken van extra IFC-entiteiten tegen de gepubliceerde klassekoppeling gecontroleerd. Bestaande eigen/geïmporteerde regels worden niet automatisch semantisch heringedeeld. **+ Entiteit** blijft beperkt tot IFC-codes uit de geladen bSDD-catalogus. Dubbele properties binnen dezelfde propertyset en entiteit blokkeren export; het oorspronkelijke bestand bevat zo'n conflict voor `3.7 Materiaal` op negen entiteiten en wordt niet automatisch aangepast.

Validatie: `npm test` en `npm run check`. Browsercontrole: ILS → IfcWindow → Raam → eigenschap toevoegen, bestaande invulling, bronregistratie en netwerkfoutafhandeling. De testbrowser kon nieuwe live relaties niet laden (`Failed to fetch`); API-opvragingen leverden deels gegevens en deels HTTP 429. Daardoor is de live route voor alle andere woordenboeken niet volledig bevestigd.
