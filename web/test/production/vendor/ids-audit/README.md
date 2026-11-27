# Pinned local IDS XSD check

This directory contains unchanged runtime and schema bytes used by
`web/ids-audit.js`. `provenance.json` records every distributed file's size and
SHA-256. It is checked by the automated tests.

- **xmllint-wasm 5.3.0 / libxml2 2.13.8**, from the npm tarball whose SHA-512
  integrity appears in the manifest. MIT license: `COPYING-xmllint.txt`.
  The Node worker is renamed from `.js` to `.cjs`; its bytes are unchanged.
- **IDS 1.0 XSD**, unchanged from buildingSMART/IDS commit
  `870f9c4e6e8f414e737b4d84ca1aa9b46fc6c8f3`.
  CC BY-ND 4.0, not the application's MIT license. See `LICENSE-IDS.txt`.
- **XML Schema and XML support schemas**, unchanged from the official
  buildingSMART/IDS-Audit-tool commit
  `fdfc562f62c87dc8dce47a296b882e986f8e4443`.
  Their original W3C/Microsoft notices remain in the files. See also
  `LICENSE-audit-support.txt`. `XMLSchema.xsd` was named `xsdschema.xsd` upstream.

The worker receives only a fixed schema set and a validation copy of the IDS.
`--nonet` disables network resolution; the preloaded virtual `/schemas` path
resolves the trusted schema imports. The app never uses a schema URL found in
the user's IDS. `xsi` attributes are built into libxml2; a generated empty
namespace declaration satisfies the redundant import locally. Original IDS XML
and original byte metadata are not changed.

**A valid XSD result is not a complete IDS semantic audit, and is not IFC-model
validation.** The browser report keeps those two checks explicitly `not-run`.

A separate development reference, `scripts/ids-audit-reference.py`, uses the
pinned official buildingSMART `ids-tool.CommandLine` 1.0.124 package and a
.NET 8 runtime/SDK. It verifies the downloaded package's SHA-512 and runs locally.
Its self-test includes a structurally valid but semantically invalid IFC entity
name, which this XSD engine correctly cannot reject. No .NET runtime is shipped
to or required on the end user's computer.

The official CLI's batch/file route requires a recognised version hint in the
input; a missing hint may be reported as unsupported, not as an invalid IDS.
The reference runner distinguishes actual completed invalid-audit results from
unsupported versions, process signals and incomplete runs. Its negative
self-tests cannot pass merely because a tool crashed. Verified archives are
cached atomically; every invocation extracts its own DLLs so concurrent runs
cannot overwrite a running assembly.
