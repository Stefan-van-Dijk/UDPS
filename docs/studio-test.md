# UDPS Studio in de testsubmap

De Studio staat onder `web/test/`. De bestaande app onder `web/` blijft behouden. `studio-root-baseline.json` bevat SHA256-hashes van alle 47 oorspronkelijke webbestanden uit commit `9a05876a33ab8d37543a393a8843f7c623c4ffc8`; de isolatietest controleert hun bytes en weigert extra rootbestanden buiten `web/test/`.

Start lokaal met `npm start` en open `http://localhost:8080/test/`. De submap is herkenbaar als **Testversie**. Dit voegt geen publicatie of wijziging aan de bestaande rootroute toe.

## Werkbladen en bedrijfsbasis

- Een lokale werkruimte bevat eigen projectwerkbladen en expliciet gepubliceerde versies van de bedrijfsstandaard.
- Een publicatie is een onveranderlijke momentopname in het werkruimtemodel. Een nieuwe versie vervangt de inhoud van eerdere publicaties niet.
- Een project bewaart zijn gekozen basisversie en basisinhoud. Publiceren werkt bestaande projecten niet automatisch bij; vergelijken en toepassen zijn afzonderlijke stappen.
- Projectwijzigingen en voorstellen voor een bedrijfsconcept blijven onderscheiden. Het concept wordt pas een bedrijfsversie na expliciet publiceren.
- Dit is lokale browserfunctionaliteit. Er is geen server, gedeeld bedrijfsregister, account, rechtenmodel of synchronisatie tussen apparaten. Onveranderlijkheid in het model is geen beveiligingsgrens.

## JSON en Studio-context

Een gewoon UDPS-project blijft het bestaande `version: 1`-formaat met `headers` en `rows`. Studio-bestanden kunnen daarnaast deze context dragen:

| Veld | Betekenis |
| --- | --- |
| `studioContext.schema` | Contextversie `1`. |
| `studioContext.bookId` | Identiteit van het projectwerkblad. |
| `studioContext.basisVersion` | Vastgelegde bedrijfsversie, of `null` voor een eigen werkblad. |
| `studioContext.baseProject` | Bijbehorende basisinhoud, of `null`; bevat onder meer `rows` en `standards`. |
| Kolom `Studio_application_ids` | Toepassingsidentiteiten per IFC-entiteit bij een Studio-projectexport. |

De context reist met het werkblad mee; de ontvanger hoeft daarvoor niet dezelfde lokale bedrijfsversies te hebben. De volledige werkruimteback-up is een ander JSON-object: `schema: 1`, `company` met publicaties/concept, en `books` met projectinhoud, basisinhoud en filters. Een werkruimte openen vervangt de lokale werkruimte; bewaar vooraf een back-up.

## Opslag en grenzen

- De testversie gebruikt `udps-studio-test-v1` voor haar eigen IndexedDB en eigen fallbackkeys. Ze neemt de bestaande rootprojectopslag niet over en schrijft daar niet naartoe.
- De opslagadapter bewaart een vastgelegde kopie per save-aanroep, in aanroepvolgorde. Een geslaagde IndexedDB-request geldt pas als bewaard na het voltooien van de transactie.
- Alleen expliciet onbeschikbare IndexedDB bij de eerste opening kan de beperkte localStorage-opslag activeren, met zichtbare waarschuwing. Een latere fout opent geen oudere reservekopie.
- Onleesbare opslag wordt niet gewist. Een laadfout is iets anders dan een lege werkruimte en mag niet leiden tot automatisch overschrijven met een leeg object.
- Werkruimte-JSON is begrensd op 32 MiB UTF-8. Projectbestanden behouden hun eigen limiet van 10.000 bronregels; bronimporten hebben aanvullende formaat- en groottegrenzen. Browserquota kunnen lager zijn: bewaar JSON-back-ups.

## Herkomst en vernieuwen

`web/test/studio-build.json` vermeldt de exacte Sites-broncommit, de bestaande productiebasiscommit, testmodus en opslagnamespace. Gekopieerde productiemodules hebben daarnaast hun eigen `web/test/production/provenance.json` en licentiebestanden. `tests/studio/sync-manifest.json` koppelt de gekopieerde tests aan hun broncommit en hashes.

Voer vanuit de repository uit, na het vastzetten van de Sites-bron:

```sh
node scripts/sync-studio-test.mjs --source /absolute/Sites/dist --source-commit EXACTE_40_TEKENS_SHA
node scripts/sync-studio-tests.mjs --source /absolute/Sites/tests
npm run check
npm test
```

De twee syncscripts hebben afzonderlijke bestemmingen: `web/test/` en `tests/studio/`. Het testsyncscript leest eerst alle bronbestanden, vertaalt de verwijzingen van `dist` naar `web/test`, controleert de testsyntax en vervangt daarna zijn eigen doelmap. Fixtures worden bytegelijk meegenomen. Alleen `studio-werkblad-model.test.cjs` wordt uitgesloten: die hoort bij een ouder voorstel dat geen onderdeel is van deze testversie.

Gebruik voor een definitieve snapshot dezelfde broncommit voor app en tests, zonder ongecommitteerde testwijzigingen. De isolatietest bewaakt dat. Kopieën onder `tests/studio/` zijn gegenereerd; pas de Sites-brontests aan en synchroniseer opnieuw.

## Verificatie en IDS-status

`npm run check` behoudt de bestaande rootsyntaxchecks en voegt `scripts/check-studio.mjs` toe. `npm test` behoudt de bestaande roottests en voert de gekopieerde `.test.cjs`- en `.test.mjs`-bestanden uit. De bestaande ontwikkeldependencies `fake-indexeddb` en `@xmldom/xmldom` worden ook voor de Studio-tests gebruikt; er worden geen browserdependencies toegevoegd.

Alleen Studio controleren kan met `npm run check:studio` en `npm run test:studio`. Geautomatiseerde opslag-, model-, parser- en contracttests vervangen geen visuele of native browsercontrole. Leg daadwerkelijk uitgevoerde checks en hun broncommit apart vast.

De uitgebreidere IDS-route is in ontwikkeling. Lees haar actuele grenzen bij de vastgezette bron en de meegesynchroniseerde regressies. Een gekopieerde parser, worker of XSD-module bewijst op zichzelf geen afgeronde Studio-integratie, volledige IDS-inhoudsaudit of IFC-modelconformiteit.

## Bewezen eindkandidaat — 27 november 2026

Klikmodelbron `d998e5511903e2a428cf115aaef239a88f2af53a` (Site v36), publiek gecontroleerd in desktopbrowser 1363 × 936. Productkopie onder `web/test/` en tests hebben dezelfde broncommit; de isolatietest bewaakt dat. Alle 502 automatische tests en de volledige syntax-/assetcontrole slagen, zonder overgeslagen tests. De bestaande 47 webbestanden zijn bytegelijk aan de basis. De ongewijzigde CI controleert ook de bestaande officiële .NET-IDS-referentieroute; die is lokaal niet opnieuw uitgevoerd omdat .NET hier ontbreekt.

Werkelijk bediend:

- Bedrijfsbasis instellen, een project rechtstreeks als bestaande matrix openen, één parameter voor één IFC-entiteit wijzigen en alleen die wijziging publiceren. Bestaande projecten behielden hun basisversie.
- Basisupdate naar 1.2 met een onbewaarde exportkeuze: direct geopend, geen vervangvraag, eigen uitgeschakelde keuze behouden. Huidig onbewaard project via Home hervatten behoudt zijn live draft. Ook klik op de basiscel van de projectrij opent de tabel.
- Echt project-JSON gedownload en heropend met 59 bronregels / 416 toepassingen, vaste basis 1.1 en stabieleIDs; geen dubbelwerkblad. Indexversies van de veranderde scripts zijn bijgewerkt.
- Nieuw project uit UTF16-IDS via echte browserworker en lokale WASM-XSD. Projectnaam behouden, bronveld/datatype vergrendeld, ontbrekende Revitnaam gemarkeerd. Na invullen Test_Foo een echte BOM/CRLF UDPS.txt gedownload.
- Bewaarde IDS geopend en nieuwe versie vergeleken:1 gewijzigde eis, geen automatische regelwijziging. Voorganger bewust aangevinkt en alleen bron bewaard. Teruggelezen JSON heeft 2 bronnen, 1 projectregel, utf-16le en de correcte vorige-bronrelatie.
- Werkblad werkelijk als `udps-library` gedownload. Native formulier-ID-collision opgelost; bibliotheekexport en veldvalidatie opnieuw bediend. Gekopieerde bSDD-bronlijst werkelijk geopend; actuele live bSDD-inhoud is hiermee niet bewezen.

Browserbeelden en gecontroleerde proefdownloads staan in [studio-evidence](studio-evidence/). De tabelcapture is v34 vóór twee routefixes; de behouden matrixstructuur is niet opnieuw ontworpen. Homebeeld is v36. Dit bewijs is geen Windows/Revit-, fysieke telefoon- of screenreaderacceptatie.

De bestaande rootapp blijft de huidige werkende publicatie. Open nieuwe werkruimtebestanden met Studio: de oude app bewaart Studio-bedrijfscontext niet volledig. De testversie is lokaal per browser; overdracht gebeurt via JSON-bestanden.
