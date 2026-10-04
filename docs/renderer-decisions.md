# Renderer decisions

Evaluated 2026-09-20. Versions are pinned in the lockfile. Package sizes below are npm's unpacked distribution size, **not** shipped JS size; the production build reports actual chunks.

## DOCX

| Candidate | Maintenance and license | Size / runtime | Fidelity and portability |
| --- | --- | --- | --- |
| [Mammoth](https://github.com/mwilliamson/mammoth.js) 1.12.3 | Release September 2026; BSD-2-Clause | 2.18 MB unpacked; browser build can run in a worker | Semantic headings, lists, tables, inline formatting, links, images, notes. Reflows instead of reproducing Word page layout. Standard HTML works in WebView2 and WebKitGTK. |
| [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) 0.4.0 | Release July 2026; Apache-2.0 | 0.97 MB unpacked, plus JSZip; DOM rendering on main thread | Better page geometry, headers and layout; browser pagination remains approximate. Generated styles/fonts and embedded resources require a larger security review and cross-WebView layout testing. |
| LibreOffice conversion | Large maintained office suite; MPL/LGPL | Very large native runtime, subprocess lifecycle and installation complexity | Better office fidelity; conflicts with the lightweight distribution goal. |

**Decision, before implementation:** use Mammoth's browser build in a dedicated, time-limited worker. Readability, semantic search and standard CSS take priority over paper-layout reproduction. Disable embedded style maps and external file access; map underline explicitly. Sanitize the generated HTML with DOMPurify and a small tag/attribute allowlist before attaching it. Only embedded raster images and safe, explicitly clicked links survive. Bound ZIP expansion and refuse encrypted, macro-enabled or oversized containers before conversion.

DOCX is a continuous reading sheet, with no invented page count. Word headers, footers, floating shapes, exact fonts, borders, tracked changes and pagination are not reproduced reliably. Printing prints the reading representation. These limits are visible in the viewer and documented in the README. A page-fidelity renderer can replace this implementation without changing the shell.

## RTF

[rtf.js](https://github.com/tbluemel/rtf.js) 3.0.9 is MIT licensed, last published July 2022, and 11.45 MB unpacked. It supports browser DOM rendering with optional WMF/EMF conversion and a bundled code-page dependency. It is viable for a later isolated renderer, but its older release, synchronous parsing and embedded metafile surface need dedicated fixtures, limits and WebKitGTK validation. **Defer RTF for this release.** Recognize it and offer Open With; do not misrender it as text or register Folio as its handler.

## Other dependencies

- [PDF.js](https://mozilla.github.io/pdf.js/) 6.3.289, Apache-2.0: mature Mozilla parser/rendering stack. Use its legacy browser build, separate worker, local fonts/CMaps/WASM, and never attach the scripting/annotation execution layer. The production CSP excludes JavaScript eval. Lazy canvas pages and selectable text. A native Ubuntu 24.04/WebKitGTK 2.52.6 smoke test passes alongside Chromium/WebKit browser tests; this does not establish compatibility with every older WebKitGTK patch release or complex PDF.
- [Marked](https://github.com/markedjs/marked), MIT: GFM parser in a worker. It does not sanitize; DOMPurify is mandatory afterward.
- [DOMPurify](https://github.com/cure53/DOMPurify), Apache-2.0/MPL-2.0: maintained HTML sanitizer. Explicit tag/attribute rules additionally strip styles, remote images, forms and active content.
- [Papa Parse](https://github.com/mholt/PapaParse), MIT: quote-aware CSV parsing and delimiter detection in a worker. No formula execution.
- [TanStack Virtual](https://github.com/TanStack/virtual), MIT: small headless virtualizer for large text/CSV; no table framework or editor runtime.
- Tauri 2 official plugins: native dialog and single instance, Rust-only. No general filesystem, shell or opener plugin is exposed to the WebView.

Tauri's [capability model](https://v2.tauri.app/security/capabilities/) and [CSP recommendations](https://v2.tauri.app/security/csp/) inform the native boundary. Install-time associations use [bundle configuration](https://v2.tauri.app/reference/config/); normal launches do not change defaults or registry associations.

## Measured production output

The initial shell is approximately 245 KB minified / 78 KB gzip. The DOCX worker's Mammoth chunk is 493 KB minified. PDF's renderer/library chunk is approximately 492 KB / 150 KB gzip, with a separate 1.32 MB worker and local font/CMap/decoder assets. These heavy chunks are absent from the initial module graph. `npm audit --omit=dev` reported zero known runtime advisories at implementation time; this is a point-in-time check, not a security guarantee.
