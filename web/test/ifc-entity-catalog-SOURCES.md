# IFC entity catalog: sources and notices

The offline index in `ifc-entity-catalog.js` was generated on 2026-11-26 from official buildingSMART **release** EXPRESS schemas. It contains exact entity identifiers and their EXPRESS `ABSTRACT` status, not copied entity descriptions or a replacement IFC specification.

## Pinned source snapshots

Publisher: **buildingSMART International Ltd.** Repository: <https://github.com/buildingSMART/Standards-builds>. All three source files were retrieved and checked at commit `e135492835eaf3bbd42a5bc5bb85ab6c92c1fb6a`.

| UI version | Exact release | EXPRESS schema | All schema entities | Indexed targets | Abstract targets | Source Git blob SHA-1 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| IFC2x3 | TC1, 2.3.0.1 | IFC2X3 | 653 | 233 | 39 | `736b6d5f843c5dcb4c504c157ae2ca7ac189a9c0` |
| IFC4 | ADD2 TC1, 4.0.2.1 | IFC4 | 776 | 353 | 45 | `c455f1cc48997c4d672228d58ec41d12504cb685` |
| IFC4.3 | ADD2, 4.3.2.0 | IFC4X3_ADD2 | 876 | 415 | 49 | `6b43be0b805a324e948d00e64945a63c64c20dce` |

Immutable source URLs:

- IFC2x3 TC1: <https://github.com/buildingSMART/Standards-builds/blob/e135492835eaf3bbd42a5bc5bb85ab6c92c1fb6a/IFC/RELEASE/IFC2x3/TC1/EXPRESS/IFC2X3_TC1.exp>
- IFC4 ADD2 TC1: <https://github.com/buildingSMART/Standards-builds/blob/e135492835eaf3bbd42a5bc5bb85ab6c92c1fb6a/IFC/RELEASE/IFC4/ADD2_TC1/EXPRESS/IFC4.exp>
- IFC4.3 ADD2: <https://github.com/buildingSMART/Standards-builds/blob/e135492835eaf3bbd42a5bc5bb85ab6c92c1fb6a/IFC/RELEASE/IFC4_3/HTML/IFC4X3_ADD2.exp>

Publication and scope references:

- Official release directory: <https://standards.buildingsmart.org/>
- IFC specification/version database: <https://technical.buildingsmart.org/standards/ifc/ifc-schema-specifications/>
- Official IFC4.3 IfcObjectDefinition definition: <https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcObjectDefinition.htm>

## Extraction and API

1. Read each pinned EXPRESS file separately; remove EXPRESS block comments and line comments.
2. Read every `ENTITY` declaration, its immediate `SUBTYPE OF` parents and its `ABSTRACT` keyword. Check that all referenced parents exist in that same schema.
3. Include `IfcObjectDefinition` and every entity whose transitive parent chain reaches it. Exclude unrelated resource, geometry, relationship and property-definition entities. Keep abstract ancestors and label them with `abstract: true`.
4. Sort the exact identifiers within each version. Do not add aliases, guessed translations or classes from another version. The trailing `*` in the compact source tokens encodes the abstract flag and is removed from the public `code`.

`UDPSIfcCatalog.versions` contains frozen version objects `{id,label,entities:[{code,abstract}]}`. IDs are `IFC2X3`, `IFC4`, and `IFC4X3`. `search(versionId, query)` returns a new array containing only that snapshot's matches; it ignores query case and surrounding whitespace and accepts multiple search words. An unknown version returns no results.

The version is a search filter. This module does not write project records or infer an export schema. An existing project may contain an entity outside the current search filter; the caller retains it. The catalog does not claim that every schema entity is emitted by every Revit exporter or Model View Definition. Abstract entries denote target classes rather than directly instantiable entities. Whether an entity already occurs in the table is calculated from the caller's project, not stored in the catalog.

## Copyright and licensing

Copyright belongs to buildingSMART International Ltd. The IFC2x3 and IFC4 source-file notices identify buildingSMART International Ltd./Limited, 1996–2020. Their source notices remain available at the pinned URLs above. This index preserves the published identifiers and abstract status; it does not alter the technical specification.

The publisher's repository states that final IFC releases use **Creative Commons Attribution–NoDerivatives 4.0 International (CC BY-ND 4.0)**. See the pinned publisher notice: <https://github.com/buildingSMART/Standards-builds/blob/e135492835eaf3bbd42a5bc5bb85ab6c92c1fb6a/README.md#license> and the license: <https://creativecommons.org/licenses/by-nd/4.0/>. Keep this attribution and the source links with redistributed catalog data. No third-party implementation code was copied into the catalog helper.

## Separate Revit datatype check

The entity dataset is independent of Revit UDPS datatype codes. For the accompanying read-only datatype check, the primary source was Autodesk's `revit-ifc` repository at commit `7fe314fddf1a6052823bf41ce8cfeeca935efae1`:

- `PropertySetEntry.cs`, the `PropertyType` enum: <https://github.com/Autodesk/revit-ifc/blob/7fe314fddf1a6052823bf41ce8cfeeca935efae1/Source/Revit.IFC.Export/Exporter/PropertySet/PropertySetEntry.cs>
- `PropertyMap.cs`, `FirstIfcPropertyTypeOrDefault` uses a case-insensitive enum parse: <https://github.com/Autodesk/revit-ifc/blob/7fe314fddf1a6052823bf41ce8cfeeca935efae1/Source/Revit.IFC.Export/Utility/PropertyMap.cs#L328>
- `ExporterInitializer.cs` defaults unrecognized user-defined property types to Text: <https://github.com/Autodesk/revit-ifc/blob/7fe314fddf1a6052823bf41ce8cfeeca935efae1/Source/Revit.IFC.Export/Exporter/ExporterInitializer.cs#L479>
- Official user-defined-property template: <https://github.com/Autodesk/revit-ifc/blob/7fe314fddf1a6052823bf41ce8cfeeca935efae1/Install/Program%20Files%20to%20Install/DefaultUserDefinedParameterSets.txt#L10>

At the audit baseline, 33 of the application's 35 offered datatype names matched this enum. `ElectricalCurrent` and `ElectricalVoltage` did not; the official codes are `ElectricCurrent` and `ElectricVoltage`. The enum's 132 members also include internal or reference-valued types, so its full contents should not automatically become a UI list of supported simple UDPS choices. No datatype dataset or application change is part of this catalog module.
