# UDPS generator

Webapp van Jasper Kempen en Stefan van Dijk voor Revit-parameterkoppelingen en User Defined Property Sets voor IFC-export. Webversie 1.6.1.

## Werkwijze

1. **Bronnen & bibliotheken** — selecteer bSDD-woordenboeken of laad eigen bibliotheken. Versies worden per bronnaam gegroepeerd. Updates staan hier, niet ook in het menu.
2. **Koppelingen** — kies **Via IFC & bronnen**, selecteer één of meerdere IFC-entiteiten en bronnen, laad bronklassen en haal de eigenschappen op. Selecteer afzonderlijke eigenschappen of alle zoekresultaten. Vul de Revit-parameters direct of later per regel in.
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

Eigenschappen worden via gerelateerde bronklassen opgehaald. Alleen enkelvoudige eigenschappen met propertyset worden aangeboden. De app neemt geen eigenschappen van bovenliggende klassen over als bSDD die niet aan de geselecteerde klasse publiceert. Een bron zonder passende IFC-relaties levert geen eigenschappen op. Meerdere bronnen kunnen in dezelfde toevoeging worden gebruikt. Mislukte bronaanvragen worden apart gemeld.

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
