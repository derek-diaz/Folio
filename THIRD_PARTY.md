# Third-party components

Folio's dependency selection is documented in [renderer decisions](docs/renderer-decisions.md). No application license has been selected for this private initial implementation; dependency licenses do not determine Folio's own license.

The packaging step runs `scripts/third-party-notices.mjs`. It gathers license/notice files from installed npm runtime packages and Cargo dependencies for the current target, then bundles `THIRD_PARTY_NOTICES.txt` beside the application resources. Do not remove those notices when redistributing a package. PDF fonts, CMaps and WASM directories also retain their upstream license files.

`src/renderers/pdf.css` adapts the PDF.js text-layer geometry styles. PDF.js is copyright Mozilla Foundation and its contributors and is licensed under Apache-2.0; its full license is included in the generated notices. Folio's temporary icon and all test fixtures are authored in this repository.
