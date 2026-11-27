# Production domain helpers used by the Studio test UI

These files are unchanged copies of `web/` from `Stefan-van-Dijk/UDPS` commit `9a05876a33ab8d37543a393a8843f7c623c4ffc8` (web 1.12.1). `provenance.json` records each source path and SHA-256. Keep the MIT `LICENSE` with these copies. Internal relative module imports retain the source release version.

`catalog.json` and `relations.json` are the entire bundled source snapshots, not newly verified live API responses. Their own source metadata and licenses remain in the files. The Studio UI marks cached results and failed refreshes explicitly. Live bSDD availability still depends on the browser, API and CORS; successful local tests do not establish live availability.

The Studio controller uses `bsdd`, `products`, `property-loader` and `mapping` for source relationships and import, `libraries.projectLibrary` for library export, and `excel.readExcel` for the existing bounded OOXML parser. It does not initialize the old DOM-bound UI or import the old global source store/storage keys.

The controller accepts `ElectricCurrent` and `ElectricVoltage` by adding these verified Revit names to this private copy's exported `core.types` array at initialization. The historical `ElectricalCurrent` and `ElectricalVoltage` aliases remain readable; project data and the copied source files are not rewritten. This permits the Studio's canonical datatype names in library export and bSDD normalization. It does not extend the independent IDS choice validator or introduce other datatypes.

Existing Studio project metadata is passed through as raw UDPS JSON. The production `core.validate()` is intentionally not used to replace that JSON because it retains only its known top-level fields. The original root application and its storage are separate from the new Studio controller.
