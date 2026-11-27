// Actieve gegevens uit het openbare UDPS-voorbeeldproject. De sleutel volgt de oorspronkelijke rij-index.
const UDPS_LARGE_EXAMPLE = [
  {
    key: "seed-0",
    name: "NL/SfB",
    propertySet: "IfcClassification",
    type: "Text",
    parameter: "AssemblyCode",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-1",
    name: "ObjectBreedte",
    propertySet: "IfcElementQuantities",
    type: "Length",
    parameter: "OverallWidth",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-2",
    name: "ObjectHoogte",
    propertySet: "IfcElementQuantities",
    type: "Length",
    parameter: "OverallHeight",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-3",
    name: "ObjectDiepte",
    propertySet: "IfcElementQuantities",
    type: "Length",
    parameter: "Thickness",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-4",
    name: "ObjectOppervlakte",
    propertySet: "IfcElementQuantities",
    type: "Area",
    parameter: "NetArea",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-5",
    name: "4.4 B Leverancier/ fabrikant",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "Manufacturer",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-6",
    name: "4.1 Dragend",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Boolean",
    parameter: "LoadBearing",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-7",
    name: "4.2 Uitwendig",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Boolean",
    parameter: "IsExternal",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-9",
    name: "4.4 B Luchtgeluidisolatie",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Integer",
    parameter: "AcousticRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-10",
    name: "4.3 A Brandwerendheid",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "FireRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-11",
    name: "4.4 A Brandklasse",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "FireRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-12",
    name: "4.4 B Nooduitgang",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Boolean",
    parameter: "FireExit",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-13",
    name: "4.4 B Weerstandsklasse",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "SecurityRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcObject"]
  },
  {
    key: "seed-14",
    name: "3.4 Entiteit",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "IFC Entity",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-15",
    name: "3.7 Materiaal",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "Materiaal binnen",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-16",
    name: "3.7 Materiaal",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "Materiaal buiten",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-17",
    name: "4.4 B Merk",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "Reference",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-18",
    name: "Q Breedte/Dikte",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Length",
    parameter: "OverallWidth",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-19",
    name: "Q Lengte",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Length",
    parameter: "OverallWidth",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-20",
    name: "Q Hoogte",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Length",
    parameter: "OverallHeight",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-21",
    name: "Q Dikte",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Length",
    parameter: "Thickness",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-22",
    name: "Q Omtrek",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Length",
    parameter: "Object omtrek",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-23",
    name: "Q Oppervlakte",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Area",
    parameter: "NetArea",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-24",
    name: "3.6 Codering - NL-SfB",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "AssemblyCode",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-25",
    name: "3.6 NL-SfB omschrijving",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "AssemblyBeschrijving",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-26",
    name: "3.3 Bouwlaag",
    propertySet: "ILS Ontwerp en Engineering",
    type: "Text",
    parameter: "Level",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-27",
    name: "Specificatie",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "Specification",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-28",
    name: "Leverancier",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "Manufacturer",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-29",
    name: "IsConstructief",
    propertySet: "Pset_ILS_Gevel",
    type: "Boolean",
    parameter: "LoadBearing",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcObject"]
  },
  {
    key: "seed-30",
    name: "IsBuiten",
    propertySet: "Pset_ILS_Gevel",
    type: "Boolean",
    parameter: "IsExternal",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcCovering","IfcObject"]
  },
  {
    key: "seed-31",
    name: "Geluidwering",
    propertySet: "Pset_ILS_Gevel",
    type: "Integer",
    parameter: "AcousticRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-32",
    name: "Brandklasse",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "FireRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-33",
    name: "Profielsysteem",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "ProfileSystem",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcMember","IfcObject"]
  },
  {
    key: "seed-34",
    name: "NL/SfB",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "AssemblyCode",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-35",
    name: "NL/SfB beschrijving",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "AssemblyBeschrijving",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-36",
    name: "Description",
    propertySet: "Pset_ILS_Gevel",
    type: "Text",
    parameter: "Description",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-37",
    name: "ElementID",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "ElementID",
    applications: ["IfcObject"]
  },
  {
    key: "seed-38",
    name: "ObjectType",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "ObjectType",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-39",
    name: "Description",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "Description",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-40",
    name: "Leverancier",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "Manufacturer",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-41",
    name: "IsConstructief",
    propertySet: "Rollecate",
    type: "Boolean",
    parameter: "LoadBearing",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcObject"]
  },
  {
    key: "seed-42",
    name: "IsBuiten",
    propertySet: "Rollecate",
    type: "Boolean",
    parameter: "IsExternal",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcCovering","IfcObject"]
  },
  {
    key: "seed-43",
    name: "Geluidwering",
    propertySet: "Rollecate",
    type: "Integer",
    parameter: "AcousticRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-44",
    name: "Brandklasse",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "FireRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcFlowTerminal","IfcObject"]
  },
  {
    key: "seed-45",
    name: "Weerstandsklasse omschrijving",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "SecurityRating",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcObject"]
  },
  {
    key: "seed-46",
    name: "Profielsysteem",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "ProfileSystem",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcMember","IfcObject"]
  },
  {
    key: "seed-47",
    name: "Breedte",
    propertySet: "Rollecate",
    type: "Length",
    parameter: "OverallWidth",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-48",
    name: "Hoogte",
    propertySet: "Rollecate",
    type: "Length",
    parameter: "OverallHeight",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-49",
    name: "Voorkant_stelkozijn_tot_achterkant_Kozijn",
    propertySet: "Rollecate",
    type: "Length",
    parameter: "Thickness",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-50",
    name: "ObjectOppervlakte",
    propertySet: "Rollecate",
    type: "Area",
    parameter: "NetArea",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-51",
    name: "NL/SfB",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "AssemblyCode",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-52",
    name: "NL/SfB beschrijving",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "AssemblyBeschrijving",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcFlowTerminal","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-53",
    name: "Verdieping",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "Level",
    applications: ["IfcWindow","IfcDoor","IfcCurtainWall","IfcPlate","IfcMember","IfcDiscreteAccessory","IfcCovering","IfcObject"]
  },
  {
    key: "seed-54",
    name: "Dagmaat stelkozijn breedte",
    propertySet: "Rollecate",
    type: "Length",
    parameter: "Dagmaat stelkozijn breedte",
    applications: ["IfcWindow","IfcDoor","IfcObject"]
  },
  {
    key: "seed-55",
    name: "Dagmaat stelkozijn hoogte",
    propertySet: "Rollecate",
    type: "Length",
    parameter: "Dagmaat stelkozijn hoogte",
    applications: ["IfcWindow","IfcDoor","IfcObject"]
  },
  {
    key: "seed-56",
    name: "Weerstandsklasse",
    propertySet: "Rollecate",
    type: "Boolean",
    parameter: "Weerstandsklasse",
    applications: ["IfcWindow","IfcDoor","IfcObject"]
  },
  {
    key: "seed-57",
    name: "Positie",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "Positie",
    applications: ["IfcObject"]
  },
  {
    key: "seed-58",
    name: "ComponentID",
    propertySet: "Rollecate",
    type: "Text",
    parameter: "ComponentID",
    applications: ["IfcObject"]
  }
];
