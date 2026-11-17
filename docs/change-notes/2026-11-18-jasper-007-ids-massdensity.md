# UDPS 1.11.4 — MassDensity uit IDS

De IDS-import, opgeslagen projectkeuzes en TXT-uitvoer gebruiken dezelfde vertaling voor massadichtheid. Een browserproef bevestigt de volledige route met een synthetische bron.

```json
{
  "schema": 1,
  "change_id": "2026-11-18-jasper-007-ids-massdensity",
  "created_at": "2026-11-17T23:11:44.825Z",
  "actor": "jasper",
  "kind": "task-update",
  "summary": "UDPS 1.11.4 ondersteunt MassDensity uit een IDS tot en met TXT-export en JSON-herstel.",
  "depends_on": [
    "2026-11-17-jasper-006-ids-bronvergelijking-opslag"
  ],
  "operations": [
    {
      "entity_id": "UDPS-T009",
      "entity_type": "task",
      "base_revision": "2026-11-17-jasper-006-ids-bronvergelijking-opslag",
      "revision": "2026-11-18-jasper-007-ids-massdensity",
      "before": {
        "evidence": "UDPS 1.11.3 herstelt de eerste klik na Revit-invoer, onderscheidt verschillende expliciete specificatie-ID’s in de bronvergelijking en bevestigt bronopslag pas na het opslagresultaat. Code 2d6b71815375e393b5d64990e858993897ba5a12. Syntaxcontrole en 278 tests geslaagd, inclusief het corpus van 334 officiële IDS-bestanden. Edge 157 in een apart profiel met twee synthetische versies bevestigde muis- en toetsenbordbediening, XSD, één ongewijzigde, gewijzigde, nieuwe en vervallen eis, en overname van alleen de ongewijzigde keuze. Drie bestaande exportregels en twee exacte XML-bronnen bleven behouden. Dubbele schrijffout gaf een herstelmelding en een JSON-backup met de conceptkeuzes. De laatste geldige opslag bleef intact. Bij geweigerde IndexedDB-toegang is de verouderde reservekopie geblokkeerd. De werkelijke JSON-download is exact teruggeïmporteerd en opnieuw geopend vanuit de beperkte browseropslag.",
        "next_step": "Praktijkacceptatie van 1.11.3 met een representatieve IDS. Beoordeel toepassingsfilters, waarde-eisen, namen, datatypes en voorgestelde Revit-koppelingen. Bespreek inhoudelijke bronproblemen met de IDS-opsteller. Voor volledige inhoudsaudit is de ontwikkelreferentie beschikbaar. De collega-aansluiting blijft een aparte taak."
      },
      "after": {
        "evidence": "UDPS 1.11.4 vertaalt IFCMASSDENSITYMEASURE uit IDS naar MassDensity in het TXT-bestand voor de Revit IFC-exporter. De gekozen Revit-parameter en het datatype blijven bewaard in project-JSON. Autodesk-broncode van IFC_v24.3.40 en IFC_v25.4.40 bevestigt het type en het pad naar IfcMassDensityMeasure. Syntaxcontrole en 279 tests slagen. Edge 157 bevestigde XSD, het automatische voorstel, de TXT-download en bytegelijke TXT-uitvoer na het terugzetten van de werkelijke JSON-backup. De browserproef gebruikte een synthetische IDS en een proefparametertitel. Code 757c2704ba1f7534939f3cd8e1db3f54a4424bf3.",
        "next_step": "Beoordeel de toepassingsfilters, de echte Revit-parameternamen en de inhoudelijke bronpunten bij het bedrijfsbestand. Voor een massadichtheidseis moet de bron het juiste IDS-type declareren en de gekoppelde Revit-parameter een massadichtheidswaarde bevatten. De collega-aansluiting blijft een aparte taak."
      }
    }
  ],
  "evidence": [
    "Code en contracten op https://github.com/Stefan-van-Dijk/UDPS/commit/757c2704ba1f7534939f3cd8e1db3f54a4424bf3 .",
    "De Autodesk-broncode van de vastgelegde Revit IFC-exporters bevestigt MassDensity als uitvoertype. https://github.com/Autodesk/revit-ifc/blob/IFC_v24.3.40/Source/Revit.IFC.Export/Exporter/PropertySet/PropertySetEntryMap.cs#L629-L635 en https://github.com/Autodesk/revit-ifc/blob/IFC_v25.4.40/Source/Revit.IFC.Export/Exporter/PropertySet/PropertySetEntryMap.cs#L629-L635 .",
    "De regressie faalde bij het ontbrekende datatype en slaagt na het toevoegen van de vertaling. De volledige suite telt 279 geslaagde tests.",
    "Edge 157 testte synthetische IDS-invoer op alle 47 gecontroleerde webbestanden. Het werkelijke TXT-bestand bevat MassDensity en is bytegelijk na JSON-herstel. De controle liep tot aan het TXT-bestand."
  ]
}
```
