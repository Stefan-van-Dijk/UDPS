# Raam en Dakraam: bronrelaties en mapping

Onderzocht op 17 november 2026 voor UDPS-T008. De exacte API-antwoorden,
aanvraag-URL's en controletijden staan in
[`tests/fixtures/oe-window-chain.json`](../tests/fixtures/oe-window-chain.json).
Dit zijn opgeslagen openbare bronantwoorden, geen bewijs van live browsertoegang.

## Waargenomen broninhoud

Dictionary: `https://digitalbuildingdata.tech/ils-ontwerp-en-engineering-2`,
versie 2.0.1; de onderzochte klassen vermelden `versionDateUtc` 27 oktober 2026.

| Klasse | URI-suffix | Bovenliggende klasse | Rechtstreeks gepubliceerde eigenschappen |
| --- | --- | --- | --- |
| Raam | `093a3c6b-133b-4ab3-a731-cbc2f81bf167` | BOUWPRODUCT | Name, ObjectType |
| Dakraam | `e741a31f-fd64-4b72-aac2-292f3a559e85` | Raam | Name, ObjectType |

De volledige URI is de dictionary-URI plus `/` en het suffix. Zowel
`parentClassReference` als `childClassReferences` bevestigt de relatie
Raam → Dakraam. De API levert daarnaast `hierarchy`. De app bewaart deze
velden afzonderlijk van `classRelations`.

De twee klassen verwijzen naar dezelfde IFC 4.3-eigenschap-URI's voor Name
en ObjectType. Hun klasse-eigenschapsrelaties zijn verschillend. ObjectType
heeft bij Raam de vaste waarde `Raam`, bij Dakraam `Dakraam`. Een gedeelde
eigenschap-URI maakt die klassevoorwaarden dus niet uitwisselbaar. Het project
bewaart beide contexten wanneer dezelfde uitvoercombinatie opnieuw wordt
toegevoegd; de bestaande Revit-koppeling wordt niet overschreven.

Dakraam publiceert onder andere HasReference naar IfcWindow en
IfcWindowSKYLIGHT, en HasPart naar Kierdichting, Kozijn, Luchtrooster en Paneel.
Die onderdelen blijven afzonderlijke klassen. NL-SfB-verwijzingen blijven
classificatierelaties. Geen van deze relaties bewijst dat alle eigenschappen
van de doelklasse op Dakraam van toepassing zijn.

## Betekenis van overerving

Volgens de [officiële bSDD-importdocumentatie](https://github.com/buildingSMART/bSDD/blob/master/Documentation/bSDD%20JSON%20import%20model.md#property-inheritance)
erven kindklassen geen eigenschappen van hun ouderklasse. De auteur van een
dictionary moet eigenschappen expliciet aan de kindklasse toekennen. De
Raam/Dakraam-antwoorden bevestigen hier eigen klasse-eigenschapsrelaties;
de app leidt geen ontbrekende eigenschappen af uit de hiërarchie.

De [OpenAPI-definitie](https://github.com/buildingSMART/bSDD/blob/master/Documentation/bSDD%20OpenAPI.yaml)
beschrijft de afzonderlijke Class/v1- en gepagineerde Class/Properties/v1-routes.
UDPS vraagt kindreferenties expliciet op en bewaart de gepubliceerde hiërarchie
in detailcacheversie 5. Oude caches blijven bij een netwerkfout bruikbaar met
een melding dat de volledigheid niet is bevestigd. De meegeleverde snapshot
bevat gecontroleerde gegevens voor Raam, Dakraam, Deur en Binnendeur.

## Bediening en controle

Via **Eigenschappen → Via bouwproduct / bronklasse** toont de gekozen klasse
zijn bron, URI, boven- en onderliggende klassen en inklapbare uitgaande relaties.
Een klik opent de doelklasse met de eigen dictionary, eigenschapslijst en
IFC-controle. Ook bij een mislukte dictionary-index kan een succesvol opgehaalde
doelklasse worden bekeken. Bekijken selecteert of voegt geen eigenschappen toe.
Een onzekere IFC-relatie vraagt de bestaande expliciete eigen toepassing.

De regressies toetsen de opgeslagen Raam/Dakraam-antwoorden, productspecifieke
voorwaarden, navigatie naar een andere dictionary, deelstoringen, oude caches
en late antwoorden na wijzigen of sluiten. De volledige suite en syntaxcontrole
worden bij de release uitgevoerd. De bestaande live bSDD-CORS-blokkade blijft
afzonderlijke acceptatie bij UDPS-T005; API-toegang buiten de browser heft die
blokkade niet op. Revit-runtimeacceptatie valt buiten deze opdracht.
