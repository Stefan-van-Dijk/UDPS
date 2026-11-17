# UDPS generator

Webapp van Jasper Kempen en Stefan van Dijk voor Revit-parameterkoppelingen en User Defined Property Sets voor IFC-export. Webversie 1.11.2.

Actuele IDS-bediening staat hieronder en in [IDS-import](docs/ids-import.md). De eerdere versiehoofdstukken beschrijven de ontwikkeling en het toen uitgevoerde controlebewijs; ze zijn geen actuele takenlijst.

## 1.11.4 — IDS-parameters koppelen en wijzigingen controleren

UDPS vertaalt IDS-datatype `IFCMASSDENSITYMEASURE` naar `MassDensity` in het TXT-bestand voor eigen IFC-propertysets. [Autodesk Revit IFC](https://github.com/Autodesk/revit-ifc/blob/master/Install/Program%20Files%20to%20Install/DefaultUserDefinedParameterSets.txt)

**IDS inladen** opent een werkoverzicht met unieke parameterdefinities en alle onderliggende eisen. Koppel een standaard Revit-parameter direct in de tabel of stel een uitzondering per IFC-entiteit in. Bestaande ingevulde namen blijven behouden. Een bestaande lege pending koppeling met één entiteit kan expliciet worden ingevuld; andere bestaande koppelingen blijven te bewerken bij de exportregels.

Gelijke toepassingsvoorwaarden kunnen per inhoudelijke groep worden beoordeeld. Verschillende filters, onbekende inhoud, waarden en optionele eisen blijven herkenbaar. Nieuwe gekoppelde regels voor dezelfde definitie delen een centrale identiteit, met behoud van alle afzonderlijke bronverwijzingen en Revit-uitzonderingen. Bestaande centrale groepen worden niet automatisch samengevoegd.

**Wijzigingen controleren** toont vooraf nieuw, hergebruik, conflict en overslaan. Hetzelfde importplan bepaalt de werkelijke wijziging. Conflicten of gewijzigde gegevens verhinderen toevoegen; annuleren verandert niets. De laatste toevoeging kan via de IDS-dialoog ongedaan worden gemaakt zolang het project daarna niet is gewijzigd.

Een eerder bewaarde bron kan expliciet met een nieuwe versie worden vergeleken. Alleen aantoonbaar ongewijzigde eisen kunnen hun keuzes overnemen; gewijzigde of onduidelijke eisen vragen nieuwe beoordeling. De voorganger blijft bij de bron bewaard. Vervallen eisen verwijderen geen bestaande exportregels.

De browser leest IDS in een achtergrondworker en voert een echte lokale **XSD-controle** uit met meegeleverde schema's. XML wordt pas op aanvraag getoond. Ongeldige XSD-invoer blijft leesbaar en bewaarbaar, maar kan niet worden toegevoegd. Onbeschikbare controle blijft expliciet zichtbaar. Dit is geen volledige IDS-inhoudsaudit of IFC-modelcontrole. De ontwikkelcontrole voert daarnaast de officiële, vastgezette buildingSMART-audit uit op positieve en negatieve referentiegevallen.

Projectopslag gebruikt IndexedDB en neemt bestaande localStorage-projecten over. De oude kopie blijft behouden; latere wijzigingen staan in de nieuwe opslag. Bewaar een actuele JSON-backup vóór terugvallen naar een oudere app: oudere versies lezen mogelijk alleen de oude browserkopie en ondersteunen de nieuwe keuzemetadata niet volledig. [IDS-contracten en grenzen](docs/ids-import.md) bevatten de volledige beschrijving.

Na het invullen van een Revit-naam opent de volgende klik meteen het gekozen parameterdetail. Bij bronvergelijking krijgen verschillende expliciete specificatie-ID's elk hun eigen resultaat. De dialoog bevestigt het bewaren van IDS-bron en keuzes pas na de reactie van de browseropslag. Bij een opslagfout zijn de wijzigingen via **Menu → Project bewaren** als JSON te downloaden.

## 1.10.0 — Algemene IDS-bronimport en bewuste koppelvoorstellen (historisch)

**IDS inladen** leest de zes IDS-facetten en hun restricties, ook zonder directe UDPS-koppeling. Bekijk en doorzoek alle eisen; bewaar desgewenst alleen de volledige bron. Heropenen vanuit het JSON-project behoudt de oorspronkelijke XML en je koppelkeuzes.

Exacte IFC-entiteiten en eindige entiteitenlijsten leveren parametervoorstellen op. Voor aanvullende toepassingsfilters, waarde-eisen en optionele eigenschappen vraagt de app een bewuste keuze. Namen met patronen, onbekende entiteiten en ontbrekende datatypes vragen een concrete invoer. Andere IFC-routes, zoals materiaal, classificatie, attributen, onderdeelrelaties en quantity sets blijven broninformatie: ze worden niet als gewone properties verzonnen.

UDPS voert deze toepassingsfilters en waarde-eisen niet uit. Bevestigde ruimere koppelingen houden daarom een waarschuwing bij de export. Deze import is geen volledige XSD-audit en controleert geen IFC-model. Expliciete historische en toekomstige formaatverwijzingen blijven alleen leesbaar. [Ondersteuning en grenzen](docs/ids-import.md) beschrijft het onderscheid.

Geautomatiseerde controles gebruiken 334 ongewijzigde officiële IDS-testbestanden plus gerichte regressies voor lezen, keuzes, gegevensbehoud en conflicten. Dit corpus bewijst geen universele IDS- of modelconformiteit. Bestanden worden lokaal verwerkt; er wordt geen schema of URL uit een IDS opgehaald.

Nieuwe koppelingen blijven export blokkeren zolang de Revit-naam ontbreekt. Bestaande Revit-namen blijven behouden en datatypeconflicten wijzen de hele selectie af. Bewaar het project vóór een terugval: versie 1.9.0 bewaart de nieuwe beoordelingskeuzes niet volledig en 1.8.1 bewaart geen IDS-bronnen.

## 1.9.0 — Bronklassen verkennen en eerste IDS-import (historisch)

De productkeuze toont nu de gepubliceerde hiërarchie en uitgaande klasserelaties,
ook voordat eigenschappen zijn toegevoegd. Open een verwante klasse om haar eigen
bron, eigenschappen en IFC-relatie te bekijken. De app neemt geen eigenschappen
automatisch over. [Raam en Dakraam](docs/bsdd-window-mapping.md) documenteert de
gecontroleerde bronroute en de verschillende vaste ObjectType-waarden.

**IDS inladen** bij stap 02 toont IDS 1.0-specificaties en hun eisen. Selecteer
ondersteunde verplichte properties met een letterlijke IFC-entiteit, propertyset,
propertynaam en ondersteund datatype. Koppel daarna de Revit-parameters bij de
exportregels. Voorwaarden die de UDPS-export niet kan uitvoeren blijven zichtbaar
met een reden; zij worden niet stilzwijgend verbreed. Het oorspronkelijke IDS-bestand
blijft bij toevoegen in het JSON-project bewaard en kan opnieuw worden bekeken.
Dit is geen volledige IDS-validator of bewijs van modelconformiteit. Zie
[ondersteuning, proefbestand en grenzen](docs/ids-import.md).

Nieuwe IDS-mappings blijven export blokkeren zolang een Revit-naam ontbreekt.
Bestaande koppelingen en hun Revit-namen blijven behouden; een datatypeconflict
wijst de hele selectie af. Bewaar het project vóór gebruik van een oudere appversie:
1.8.1 bewaart de nieuwe IDS-bronmetadata niet bij opnieuw opslaan.

## 1.8.1 — Gegevensbehoud en betrouwbare uitvoer

Bronupdates behouden tussentijds geïmporteerde bibliotheken en gewijzigde bronkeuzes. Kopiëren en downloaden gebruiken dezelfde exportblokkade. Centrale afspraken behouden expliciet lege standaarden en historische lege Revit-namen bij andere wijzigingen; samenbrengen controleert ook alle bewaarde broncontexten. Excelimport begrenst de werkelijk uitgepakte inhoud voordat XML wordt gelezen.

De [technische contracten en verificatie](docs/contracts-and-verification.md) beschrijven verantwoordelijkheden, regressiecontroles en browserroutes. Revit-testen is uit de huidige opdracht verwijderd. Gedeelde taken, besluiten en voortgang lopen via het [GitHub-wijzigingenlog](docs/change-notes/) naar ieders eigen Notion-project, volgens de [samenwerkingswerkwijze](docs/collaboration/README.md). Het [bestaande UDPS-dossier in Digitaal Bouwen](https://app.notion.com/p/41a0dde84cc181479445d9417177cf27) blijft behouden.

Voor de tweede deelnemer is er een [aansluitprompt voor de eigen ChatGPT](docs/collaboration/colleague-onboarding.md). De [vaste projectinstructie](docs/collaboration/project-instruction.md) borgt volgende opdrachten. Een gepubliceerde instructie bewijst nog geen aansluiting of gewijzigde ChatGPT-projectinstelling bij beide accounts.

## Werkwijze

1. **Bronnen & bibliotheken** — selecteer bSDD-woordenboeken of laad eigen bibliotheken. Versies worden per bronnaam gegroepeerd. Updates staan hier, niet ook in het menu.
2. **Koppelingen** — kies **Eigenschappen → Via IFC-entiteit**, selecteer één of meerdere IFC-entiteiten en bronnen, laad bronklassen en haal de eigenschappen op. Selecteer afzonderlijke eigenschappen of alle zoekresultaten. Vul de Revit-parameters direct of later per regel in.
3. **Exporteren** — kies sortering op propertyset, classification/bronklasse of IFC-entiteit, controleer de inhoud en download `UDPS.txt`.

Een gevuld project opent bij stap 02. **Menu → Opnieuw beginnen** maakt een leeg project na bevestiging; bronnen en eigen bibliotheken blijven beschikbaar. Bewaar het project vooraf om de huidige koppelingen te behouden. **Voorbeeldproject laden** opent de 59 regels uit het meegeleverde Excelbestand.

Het menu bevat project importeren, project bewaren, opnieuw beginnen, voorbeeldproject en uitleg. Importeer een JSON-project of een `.xlsx`/`.xlsm` met de tabel `ILS_Gevel`. VBA wordt niet uitgevoerd. `IfcWindowsw` wordt gecorrigeerd naar `IfcWindow`.

## Lijst en export

- Bewerk Revit-parameter, IFC-property, propertyset en datatype direct in de tabel.
- Propertyset- en IFC-filters zijn multiselecties: OR binnen één filter, AND tussen filters en zoektekst. Niet-geselecteerde IFC-kolommen worden verborgen. Filters veranderen de exportselectie niet.
- Foutregels zijn gearceerd, met toelichting in de tooltip. Verwijderen kan per regel; Ongedaan maken herstelt verwijderingen tijdens de sessie.
- Nieuwe bronregels zonder Revit-naam blijven zichtbaar maar blokkeren export zolang ze actief zijn. Bestaande historische lege namen behouden hun betekenis: de IFC-propertynaam gebruiken.
- Dezelfde eigenschap mag per IFC-entiteit een andere Revit-parameter gebruiken. Een reeds actieve propertyset/property/entiteit-combinatie wordt bij bulk toevoegen overgeslagen en gemeld. Er worden geen dubbele exportdefinities aangemaakt.
- Iedere nieuwe bronkoppeling wordt getoetst aan de bronklasse en de IFC-relatie. Bestaande eigen of geïmporteerde regels worden niet automatisch heringedeeld.

De export is tabgescheiden UTF-8 met BOM en CRLF, vaste toepassing `I/T` en bestandsnaam `UDPS.txt`. Lege blokken worden altijd overgeslagen. De header vermeldt de makers; hij bevat geen formaatvoorbeeld.

De sortering wijzigt de inhoud niet. Bij propertyset en entiteit worden complete blokken op de gekozen sleutel gesorteerd. Classification gebruikt `Classification`, indien aanwezig, anders `Source_class`. Een blok met meerdere bronklassen wordt op zijn alfabetisch eerste klasse geplaatst; de properties binnen dat blok worden op klasse gesorteerd. Blokken zonder klasse volgen achteraan. Zo blijft iedere propertyset/entiteit-combinatie één geldig blok.

Het meegeleverde project heeft 58 actieve regels, 416 koppelingen en 45 gevulde blokken. Twee regels gebruiken dezelfde IFC-property `3.7 Materiaal` voor materiaal binnen en buiten, op negen entiteiten. Deze conflicten blijven behouden en blokkeren export totdat de gebruiker ze oplost.

## Eigen bibliotheken

Onder stap 01 kun je een bibliotheek inladen, een geladen bibliotheek weer downloaden, een voorbeeld downloaden of het huidige project als bibliotheek exporteren. Een projectexport bevat alle regels met een IFC-relatie, ook uitgeschakelde regels; Revit-namen en actieve selecties blijven alleen in het projectbestand. Meerdere identieke eigenschapsdefinities worden samengevoegd. Conflicterende datatypes worden afgewezen.

Het JSON-formaat is:

```json
{
  "format": "udps-library",
  "schema": 1,
  "id": "rollecate-gevel",
  "name": "Rollecate Gevel",
  "version": "1.0",
  "classes": [{
    "code": "kozijn",
    "name": "Kozijn",
    "ifcEntities": ["IfcWindow", "IfcDoor"],
    "properties": [{
      "code": "Afwerking",
      "name": "Afwerking",
      "propertySet": "Pset_Gevel",
      "dataType": "Text"
    }]
  }]
}
```

IFC-entiteiten worden bij import gecontroleerd tegen de bSDD-catalogus. Klassecodes en propertyset/property-combinaties binnen een klasse moeten uniek zijn. Datatypes volgen de UDPS-lijst. Import accepteert maximaal 10 MB, 10.000 klassen en 10.000 eigenschapsdefinities. Een reeds ingeladen combinatie van id en versie wordt niet overschreven: gebruik voor wijzigingen een nieuwe versie. De nieuwe versie wordt geselecteerd; bestaande projectkoppelingen blijven bij de oude versie.

Eigen bibliotheken werken lokaal en krijgen `urn:udps:library:`-identiteiten. Ze doen zich niet voor als gepubliceerde bSDD-bronnen. Projectbestanden bewaren de koppelingen; neem eigen bibliotheekbestanden apart mee wanneer je op een ander apparaat verder wilt werken.

## bSDD-bronnen en updates

IFC-codes komen uit `https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3`; ILS uit `https://digitalbuildingdata.tech/ils-ontwerp-en-engineering-2`. De meegeleverde catalogus van 12 november 2026 bevat 2163 IFC-records en ILS 2.0.1 met 308 klassen en 127 eigenschappen. Alleen werkelijke IFC-entiteiten zijn selecteerbaar, geen voorgedefinieerde typen.

Eigenschappen worden via gerelateerde bronklassen opgehaald. Alleen enkelvoudige eigenschappen met propertyset worden aangeboden. De app neemt geen eigenschappen van bovenliggende klassen over als bSDD die niet aan de geselecteerde klasse publiceert. Zonder passende IFC-relatie zijn eigenschappen via de bronklasse te bekijken, maar niet automatisch aan een IFC-entiteit toe te voegen. Meerdere bronnen kunnen in dezelfde toevoeging worden gebruikt. Mislukte bronaanvragen worden apart gemeld.

**Updates** controleert de IFC-catalogus en de al geladen relaties van ingeschakelde bSDD-bronnen. Na controle kan de gebruiker de update toepassen. Projectkoppelingen worden niet overschreven. Eigen bibliotheken worden uitsluitend bijgewerkt via een nieuwe versie van hun bestand.

`web/relations.json` bevat een gedeeltelijke momentopname met de woordenboekenlijst en enkele geverifieerde ILS-relaties. Niet aanwezige relaties worden live geladen en gecachet. Netwerkfouten, CORS en HTTP 429 worden gemeld; de app verzint geen vervangende relaties. Live gebruik vereist toegang tot `api.bsdd.buildingsmart.org`.

## Opslag, licenties en verificatie

Bestanden worden lokaal in de browser verwerkt. Er is geen uploadserver, account of apparaatsynchronisatie. Browseropslag kan worden gewist; bewaar projecten en eigen bibliotheken als bestanden. Openbare bSDD-aanvragen gebruiken de geselecteerde IFC-code en bron-URI, niet je Revit-mappings.

De repository behoudt zijn bestaande MIT-licentie en copyrightvermelding. Brondata en logo hebben hun eigen rechten: IFC vermeldt CC BY-ND 4.0, ILS vermeldt “No license (rights reserved)”. Bronhouders zijn buildingSMART International en digiGO. Het Rollecate-logo komt van `https://www.rollecate.nl/img/logo-rollecate.svg`. Montserrat wordt via Google Fonts geladen met lokale fallback.

De app heeft geen buildstap of externe JavaScript-afhankelijkheden. Start met `npm start` en open `http://localhost:8080`. Open geen losse `file://`-URL: modules vereisen een webserver. Controleer met `npm run check` en `npm test`.

GitHub Pages publiceert automatisch na een push op main, na de controles in de workflow. Zelf hosten kan door de volledige map `web/` over te nemen.

Versie 1.6: 39 tests controleren onder meer bronrelaties, meervoudige koppelingen, library roundtrips, importvalidatie, lege projecten en exportvolgordes. De visuele browsercontrole kon in deze werkomgeving niet worden afgerond door een browserblokkade. Nieuwe live bSDD-relaties waren bij eerdere browsercontrole deels onbereikbaar (`Failed to fetch` / HTTP 429). Daadwerkelijke Revit-export is niet in deze omgeving beschikbaar; controleer de definitie in de gebruikte IFC-exporter.

## Ophaaldiagnose (1.6.1)

Het aparte blok Naar export is verwijderd; exporteren staat uitsluitend in stap 03. Eigenschappen worden volledig gepagineerd opgehaald via `Class/Properties/v1`; `IncludeClassProperties` wordt niet meer gebruikt. Oude eigenschapcaches worden bij gebruik opnieuw gecontroleerd. **Opnieuw uit de bron ophalen** ververst ook eerder geladen bronklassen en eigenschappen. Als de bron onbereikbaar is en opgeslagen data beschikbaar zijn, wordt expliciet gemeld dat actualiteit/volledigheid niet bevestigd is.

Een mislukte bronklasse verhindert niet meer dat andere geslaagde klassen in de keuzelijst verschijnen. Ophaalresultaten tonen per bronklasse het aantal eigenschappen, beschikbare resultaten, netwerkfouten en uitgesloten eigenschappen met reden (bijvoorbeeld geen propertyset, Range of Complex). Geen gerelateerde bronklassen wordt afzonderlijk gemeld.

Live API-controle op 12 november 2026: IFC 4.3 IfcWindow retourneert 230 eigenschappen, waarvan 219 Single en 11 Range/Complex. ILS 2.0.1 Raam retourneert twee eigenschappen: Name en Object Type. Verschillen tussen bronnen zijn niet automatisch een appfout. De generator verzint geen ontbrekende bronrelaties. De nieuwe endpoint is gecontroleerd met echte antwoorden; browserbereikbaarheid blijft afhankelijk van netwerk/CORS. Tests controleren paginering, onvolledige antwoorden, gedeeltelijke fouten, zichtbare uitsluitingsredenen en annuleren van achterhaalde selecties.

## O&E-bouwproducten en eigenschapsbronnen (1.6.2)

De selectie volgt IFC 4.3 → O&E-bouwproduct → klasse-eigenschap → propertydictionary. Kies O&E als bron om alle aan het bouwproduct gepubliceerde eigenschappen te krijgen, ook als deze uit bijvoorbeeld IFC komen; de propertydictionary hoeft niet als losse selectiebron ingeschakeld te zijn. De generieke ondersteuning geldt ook voor andere dictionaries.

Bij een hoofdentiteit worden de door IFC 4.3 gepubliceerde predefined-type-kinderen meegenomen in de bronzoekvraag. Er wordt met volledige IFC 4.3-URI's gezocht, niet met versie-onafhankelijke codes. Voorbeeld: de oude IfcDoor-zoekvraag vond 16 O&E-klassen, maar miste Binnendeur omdat die naar IfcDoorDOOR verwijst. De uitgebreide zoekvraag vindt 17. Deze route is gecontroleerd met live API-antwoorden van 12 november 2026 en opgenomen in een regressietest. Binnendeur levert 24 properties uit de O&E- en IFC-dictionaries.

De generator controleert de IFC-relatie opnieuw op de productdetails. Expliciete relaties naar een andere IFC-versie worden niet via een gelijkende codenaam alsnog geaccepteerd. Zonder versiegebonden ClassRelation kan een gepubliceerde RelatedIfcEntityNames-relatie worden gebruikt; het type van die relatie blijft vastgelegd.

Projectregels bewaren nu naast Source_dictionary (het productwoordenboek): Source_property_dictionary, Source_property_dictionary_name, Source_relation_uri en Source_ifc_references. De lijst toont de propertydictionary afzonderlijk. Eigenschappen met dezelfde URI op verschillende bouwproducten blijven afzonderlijk selecteerbaar; bestaande conflicterende UDPS-combinaties worden nog steeds overgeslagen, omdat een propertyset/property/entiteit maar één actieve mapping kan hebben.

Predefined typen zoals IfcDoorDOOR zijn bSDD-verwijzingen en worden niet als zelfstandige IFC-entiteit geëxporteerd. De UDPS-export gebruikt IfcDoor. Een product- of predefined-typeverwijzing vormt geen selectievoorwaarde in de UDPS-export; zulke broninformatie blijft in het project bewaard. Gebruik dus geen verschillende actieve Revit-mappings voor dezelfde propertyset/property op dezelfde hoofdentiteit.

HasPart-relaties worden in de broninformatie getoond, maar eigenschappen van bijvoorbeeld Kozijn worden niet stilzwijgend op Raam toegepast. Ook NL-SfB-verwijzingen voegen geen willekeurige eigenschappen toe. Er worden geen extra properties overgenomen uit een dictionary enkel omdat één eigenschap naar die dictionary verwijst.

Oude broncaches worden vernieuwd. Een nieuwer meegeleverd cacheformaat vervangt een ouder browsercacheformaat voor dezelfde bron, zonder de gekozen bronnen of projectregels te wijzigen. De meegeleverde O&E-momentopname is aangevuld met de geverifieerde IfcDoor-route en Binnendeur-details. De migratietest controleert dat ook met een oude lege cache de 17 producten en 24 Binnendeur-properties beschikbaar zijn.

## Bouwproduct als startpunt (1.7)

**Eigenschappen** opent nu standaard **Via bouwproduct**. Selecteer O&E, zoek op `deur` en kies **Deur**. De app haalt de properties van precies deze klasse op en leidt de IFC-entiteit af uit de gepubliceerde bronrelaties. De relatie wordt gecontroleerd met de IFC 4.3-bronlijst voordat eigenschappen aan het project kunnen worden toegevoegd. Via IFC-entiteit blijft de andere route voor meerdere bronnen en entiteiten.

Sinds 1.7.1 gebruikt de productzoeker de gepagineerde Dictionary Classes API zonder typebeperking. De meegeleverde O&E-index bevat 287 objectklassen en 21 materialen op 12 november 2026. O&E opent standaard met het filter objectklassen. Zoeken gebeurt op naam, code en bovenliggende klasse; een exacte naam staat bovenaan. Bij een gekozen product zijn de ouders en directe kinderen aanklikbaar. Bron vernieuwen ververst de productindex en daarna de opgevraagde details en IFC-koppelingen. Zonder bevestigde IFC-relatie zijn de properties wel te bekijken, maar niet te selecteren voor export.

Live geverifieerde inrichting: BOUWPRODUCT → Deur → Binnendeur, Roldeur, Liftdeur, Schuifpui en Tourniquet. Deur heeft 42 eigen gepubliceerde eigenschappen, verspreid over Attributes, ILS Ontwerp en Engineering, Pset_DoorCommon, Pset_ManufacturerTypeInformation en Qto_BodyGeometryValidation. De dictionary van de eigenschap kan IFC of O&E zijn. Voorbeelden: Brandcriteria, Kleur, Hang- en Sluitwerk, FireRating, AcousticRating, ThermalTransmittance, Manufacturer en ModelReference. Binnendeur heeft een eigen lijst van 24 eigenschappen. De app erft of combineert geen properties op basis van alleen de ouder-kindhiërarchie; bSDD verlangt dat bronbeheerders de gewenste klasse-eigenschappen expliciet publiceren.

De tests controleren zoeken, hiërarchie, beide deurvarianten, herkomst, toevoegen en UDPS-generatie, ongeldige relaties en paginering. De brondata zijn met live API-antwoorden gecontroleerd; visuele browsercontrole blijft in deze werkomgeving onbevestigd.

## Andere bronnen (1.7.1)

De bronverkenner ondersteunt objectklassen, eigenschapgroepen en materialen met een soortfilter. De definitie, eenheid, keuzewaarden en beperkingen van een eigenschap zijn uitklapbaar. Bronmetadata worden bij toevoegen bewaard in `Source_property_constraints` in het project; UDPS zelf legt geen keuzelijsten of validatieregels vast. Bronupdates controleren ook bekeken klassen zonder IFC-relatie.

ETIM, NL-SfB, CCI Construction, LCA en Swedish materials zijn met echte API-antwoorden onderzocht. De [onderzoeksnotitie](docs/bsdd-source-audit.md) bevat concrete voorbeelden, beperkingen en de gevonden LCA-URI-afwijking. De aangepaste verwerking is afgedekt door 63 tests, inclusief de bestaande O&E-route.

## Keuzebediening gecontroleerd (1.7.2)

De gepubliceerde app is in de browser doorlopen: Deur (42), Binnendeur (24), Raam (2), gefilterd selecteren, selecteren/wissen, toevoegen met Revit-naam en opnieuw toevoegen zonder overschrijven. Via IFC zijn IfcWindow en IfcDoor gecombineerd. De browser kon sommige live bSDD-aanvragen niet uitvoeren (`Failed to fetch`), waaronder de LCA-index; deze volledige live routes zijn dus niet als geslaagd aangemerkt. De succesvolle O&E-resultaten kwamen uit de meegeleverde momentopname. De tijdelijke toegevoegde testregel is weer verwijderd.

Verholpen: oude meldingen na een klassewissel, geblokkeerde ophaalknoppen bij wisselen/sluiten tijdens laden, oude soortaantallen bij een mislukte bronwissel en een onjuiste leegmelding wanneer het zoekfilter alle eigenschappen verbergt. Late antwoorden van eerdere keuzes worden genegeerd. Netwerk- en timeoutmeldingen zijn verduidelijkt.

72 tests slagen, waaronder acht tests van de daadwerkelijke UI-eventhandlers met een minimale DOM-adapter en gecontroleerd vertraagde antwoorden. Die tests zijn geen live browsercontrole. Ze omvatten meerdere bronnen en IFC-entiteiten, een gedeeltelijk mislukte bron, verschillende Revit-namen per entiteit, ontbrekende IFC-relaties en het behoud van bestaande koppelingen.

## Releasebestanden (1.7.3)

Tijdens controle na publicatie toonde de browser de nieuwe HTML-versie met oude JavaScript-bediening. De moduleverwijzingen en stylesheet krijgen daarom vanaf 1.7.3 allemaal dezelfde releaseversie in hun URL. `npm run version:app -- X.Y.Z` verhoogt deze consistent. Een regressietest controleert ook de volledige moduleketen. Alle 73 tests slagen.


## 1.8.0 — Centrale eigenschappen en bSDD-relaties

Stap 02 opent met één centrale eigenschap per bron-URI. De knop **Exportregels** behoudt de bestaande tabel. Gelijke namen uit verschillende bronnen worden nooit automatisch samengevoegd. Eigen regels krijgen een blijvende lokale identifier zodra ze in de app worden geopend.

Open een centrale eigenschap om een voorkeursnaam en standaard Revit-parameter, IFC-property, propertyset en datatype vast te leggen. Bestaande afwijkingen blijven behouden; **Ook alle afwijkende toepassingen vervangen** past de standaard bewust op alle toepassingen toe. Bewerken van één IFC-entiteit splitst zo nodig een oude regel met meerdere entiteiten. De overige toepassingen behouden hun waarden. Nieuwe bronkoppelingen van dezelfde centrale eigenschap nemen de opgeslagen Revit-voorkeur over wanneer geen andere Revit-naam is opgegeven; brongebonden propertysets blijven behouden.

**Entiteit toevoegen als eigen afspraak** maakt een expliciete eigen toepassing, ook zonder bevestigde bSDD-relatie. Ook een bronklasse zonder IFC-koppeling kan via de eigenschapsdialoog zo worden toegevoegd. De app registreert de herkomst als bSDD, eigen bibliotheek, eigen afspraak of eerdere koppeling. Controleer zelf of een standaard propertyset op de extra entiteit van toepassing is; een eigen afspraak bewijst geen IFC-conformiteit.

Bij **bSDD-relaties verkennen** worden de definitie, uitgaande én inkomende eigenschapsrelaties en gebruikende klassen via de gepagineerde API opgehaald. Klassen gebruiken het API-contract `uri` / `name`; deze worden voor de UI genormaliseerd. Via een gerelateerde klasse kunnen eigenschappen worden bekeken en toegevoegd. Klasserelaties zoals `HasPart`, `HasReference`, `IsEqualTo`, `IsSimilarTo` en IFC-representaties worden met uitleg getoond. Onderdelen, verwijzingen en vergelijkbare begrippen leiden niet tot automatische overname of gelijkstelling. Deelstoringen worden expliciet gemeld en geslaagde resultaten blijven zichtbaar. Er worden alleen gegevens opgevraagd wanneer de gebruiker relaties laadt.

**Andere projecteigenschap samenbrengen** vereist een eigen inhoudelijke onderbouwing en blokkeert verschillen in datatype, eenheid, keuzewaarden of toepassingsvoorwaarden. Ook bij `IsEqualTo` beslist de gebruiker. Deze controle is geen semantisch bewijs en voert geen conversie van waarden of eenheden uit. De bron-URI's, versies, klasse-eigenschapsrelaties en afzonderlijke exportregels blijven behouden. Inkomende relaties houden hun oorspronkelijke richting.

Alle afspraken en opgehaalde relatieresultaten gaan mee in **Menu → Project bewaren** en de browseropslag. De bestaande bibliotheekexport blijft een bronbibliotheek zonder Revit-namen; gebruik het projectbestand om de volledige parameterafspraken te hergebruiken. De app maakt geen parameters in Revit aan en wijzigt geen Revit-model. Het UDPS-bestand stuurt de IFC-export aan.

Validatie: `npm run check` en `npm test`. De nieuwe regressies behandelen uniformeren met behoud van uitzonderingen, splitsen per entiteit, expliciete eigen IFC-toepassingen, identiteitsbehoud, conflicten, JSON-herladen en volledige/partiële relatie-antwoorden. Live API-bereikbaarheid blijft afhankelijk van bSDD en de browserverbinding.
