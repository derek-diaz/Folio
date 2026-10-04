# Folio

A local, read-only document viewer for Windows 11 and Ubuntu 24.04+. Open files, read, find text, copy a selection, and print. No account, network service, telemetry, or editing tools.

This is a first implementation, not a Word replacement or office suite. XLSX, PPTX, EPUB and other future formats are intentionally outside its scope.

## What works

| Format | Viewing | Search | Print |
| --- | --- | --- | --- |
| PDF | PDF.js, lazy pages, selectable text, page navigation, zoom / fit width / fit page | Text PDFs; no OCR | All pages, rendered at 144 dpi within the limits below |
| DOCX | Mammoth reading layout: headings, lists, tables, inline formatting, embedded raster images, links | Yes | Reading layout |
| Markdown | Sanitized GitHub-flavored Markdown, tables, task lists, fenced code | Yes | Yes |
| TXT | UTF-8, UTF-16, Windows-1252 fallback; virtualized large files | Matching lines | Up to 2 MB |
| CSV / TSV | Read-only table, sticky headers, horizontal scrolling, virtual rows; comma / semicolon / tab detection | Matching cells, including headers | Deferred |
| PNG, JPEG, WebP, GIF, SVG | Zoom, fit window, actual size; sanitized SVG | — | Yes |
| RTF | Detected with a helpful Open With fallback | — | — |

Files open through **File → Open**, the native picker, drag-and-drop, command-line paths and installer file associations. A second invocation opens tabs in the existing window. Tabs retain their zoom, search and scroll position while heavy renderers are released when inactive. Recent paths are stored locally, with individual removal and Clear history on the empty screen.

When no documents are open, the tab strip is hidden. The home view contains a small Folio identity, a drop hint, and an Open file action. Recent files show a filename, abbreviated folder path, and extension; hover a row for its full path.

**View → Appearance** (`Ctrl+,`) offers Dark, Light, and System. Dark is the default; your choice is saved locally. System follows live OS appearance changes. PDF and image colors are preserved, and printing uses a light page. **Help → About Folio** (`F1`) shows the installed version, Tabierto branding, and creator Derek Diaz Correa. File, View, and Help are native desktop menus. Tabs and the toolbar share one compact surface, with document controls grouped by purpose and shown according to the active renderer's capabilities.

DOCX prioritizes readability. Exact Word pagination, headers/footers, floating shapes, tracked changes, source fonts and detailed table styling are not promised. The viewer makes this clear and does not invent page counts. See [renderer decisions](docs/renderer-decisions.md) for the candidate comparison, licensing, size and RTF investigation.

The toolbar keeps Open on the left, viewing controls in the center, and document actions on the right. At narrow widths, Print and Open With move into the keyboard-accessible **More** menu. PDFs offer **Fit width** and **Fit page**; images offer **Fit to window**. The percentage shows the resulting scale, and manual zoom leaves fitting mode. **Actual size / 100%** means the renderer's normal scale, not guaranteed physical print size. Viewing modes and zoom are retained per open tab. The compact footer shows available document metadata without permanent read-only or virtualization labels.

## Development

Use Node.js **24.15+** and npm. Rust **1.94.0** is pinned in `rust-toolchain.toml`; rustup installs it when needed. Commit both lockfiles when changing dependencies.

Windows prerequisites: Visual Studio Build Tools with **Desktop development with C++**, Windows SDK, and WebView2 (normally included with Windows 11).

Ubuntu prerequisites:

```sh
sudo apt update
sudo apt install build-essential pkg-config curl libwebkit2gtk-4.1-dev \
  libxdo-dev libssl-dev librsvg2-dev patchelf
```

On either platform:

```sh
npm ci
npm run tauri dev
```

`npm run dev` runs the frontend in a browser for renderer development. It uses the browser's file picker and drag-and-drop; native history, Open With and OS integration require Tauri. No renderer needs a server after packaging. PDF workers, fonts, CMaps and WASM assets are copied locally by `postinstall`.

## Build and package

Build each target on its own OS:

```sh
# Windows: per-user NSIS installer
npm run tauri build -- --bundles nsis

# Ubuntu: Debian package and AppImage
npm run tauri build -- --bundles deb,appimage

# Compile the executable without an installer
npm run tauri build -- --no-bundle
```

Outputs are in `src-tauri/target/release/bundle/`. Builds are unsigned; signing and public release distribution are not configured. AppImage is larger because it includes native runtime libraries. On build hosts without FUSE, set `APPIMAGE_EXTRACT_AND_RUN=1` for the packaging tools. AppImages built on Ubuntu 24.04 target that distribution's glibc baseline and newer systems.

Packaging gathers dependency license notices into the application resources; see [third-party components](THIRD_PARTY.md). Folio's own application license has not been selected.

Install a `.deb` with `sudo apt install ./Folio_0.1.4_amd64.deb`. The command is `folio`. An AppImage can be made executable with `chmod +x` and launched directly. It does not automatically install its desktop entry into your user profile.

```sh
folio ~/Documents/report.docx
folio "a file with spaces.pdf" notes.md
```

Windows paths work the same way: `folio.exe "C:\Users\User\Documents\report.docx"`.

### OS integration

Tauri's installer owns Windows file-type registration. Normal launches do not modify file associations or the registry. Use Explorer's **Open with** or Windows Settings to choose Folio as your default. Folio's **Open With…** uses the native Windows application chooser and does not silently select a default.

Linux uses `src-tauri/platform/linux/folio.desktop` with `%F` and standard MIME types. The Debian package installs the desktop entry; Nautilus and other file managers discover it normally. To explicitly choose a default, use the file manager's properties or, for example, `xdg-mime default Folio.desktop application/pdf` (check the installed desktop filename first). Folio's **Open With…** uses GTK's application chooser, not `xdg-open` on the same file, which could recursively reopen Folio. GTK/WebKitGTK support Wayland and X11; GNOME/Nautilus and printer acceptance should still be checked on a full desktop before release.

## Architecture

```text
src/core/                 detection, ZIP admission limits, registry, tabs, recents, state
src/renderers/            independent, lazily imported format renderers
src/renderers/shared/     parsing worker, sanitized reading view, search helpers
src/ui/                   tabs, contextual toolbar, search, empty/error states
src/platform/             small Tauri bridge, printing and intentional links
src-tauri/src/documents.rs native file grants, size limits, local history
src-tauri/src/platform/   Windows / Linux application choosers
```

`RendererDefinition` declares a lazy component and capabilities. `RendererProps` supplies immutable bytes, zoom/fit/search settings and state/error callbacks. `RendererHandle` exposes printing and optional page navigation. The shell has no PDF or DOCX parsing logic. Add a renderer and registry entry to support another format; extend detection and tests independently.

React state handles tabs and preferences. Only the active renderer is mounted. Text, Markdown, CSV and DOCX parsing runs in a disposable worker with a 30-second timeout. CSV and large TXT use TanStack Virtual; row search yields between short batches. PDF.js uses its own worker and releases offscreen canvases.

## Security and privacy

Documents are untrusted. Native file selections and OS launch/drop events create revocable, opaque read handles. The WebView has no arbitrary-path read command, filesystem plugin permission, shell permission, save dialog permission, or asset-protocol filesystem access. Recent files can only reopen paths already in native history.

Markdown and DOCX output is sanitized before insertion. No document CSS, script, forms, iframe, remote image or relative filesystem resources are loaded. Embedded raster images work; local Markdown image resolution is deliberately deferred. SVG is sanitized and displayed as an image, never inserted into the app DOM. PDF document JavaScript, XFA and interactive annotation execution are not enabled. The app blocks WebView navigation and new windows; explicitly clicked HTTP(S)/mailto links go through a scheme-checked native browser action.

The production CSP allows app assets, document image blobs and local PDF decoders; it does not allow arbitrary network connections. Documents are never uploaded. History contains paths/names/timestamps in Tauri's app-data directory (`app.folio.viewer/recent.json`), not document content. No telemetry, analytics, crash service, accounts, cloud sync or AI features are present.

### Current limits

- 64 MB per opened file, 64 tabs, 256 MB of retained source bytes.
- Text/CSV/DOCX input: 32 MB; Markdown/SVG: 8 MB.
- DOCX: at most 5,000 ZIP entries, 32 MB per expanded entry, 96 MB total declared expansion; no encryption, macros, ZIP64 or traversal entries.
- PDF: 2,000 pages; print at most 100 pages / 100 million total raster pixels. Password-protected PDFs currently show the error/Open With flow. Scanned PDFs display normally but have no searchable text unless already OCR'd.
- CSV: 500,000 data rows / 250 columns; the first row is the header. Cell text is selectable; long content is also exposed in its tooltip. Resizing and printing are deferred.
- Large TXT: at most 1,000,000 lines / characters per line; fixed-height unwrapped virtual rows. Native selection covers rendered rows rather than the entire offscreen file.
- Search is case-insensitive literal text, capped at 10,000 matches; text counts lines and CSV counts cells. PDF searches extracted text without OCR or hyphenation normalization.
- Source changes are not watched. Close and reopen a file to refresh after editing it elsewhere.

These bounds reduce resource exhaustion; they are not a claim that every malicious document is harmless. Keep parsers, the OS WebView and lockfiles maintained.

## Tests

```sh
npm run check
npx playwright install chromium webkit
npm run test:e2e
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Unit tests cover signatures, encodings, renderer capability negotiation, recent-file validation, tab navigation, search, sanitization and toolbar behavior. Browser tests exercise the production bundle in Chromium and WebKit with valid PDF/DOCX/GFM/text/CSV/image fixtures, large-file virtualization and print preparation. See [fixtures](tests/fixtures/README.md).

Native smoke checks (after a release build):

```sh
# Windows, isolated app identity plus a temporary localhost-only WebView2 session
npm run tauri build -- --no-bundle --config tests/native/smoke.tauri.json
node tests/native/windows-smoke.mjs

# Ubuntu, actual WebKitGTK; no visible desktop or printer required
sudo apt install webkit2gtk-driver xvfb xauth dbus-x11
cargo install tauri-driver --locked
dbus-run-session -- xvfb-run -a python3 tests/native/linux-smoke.py
```

Native checks validate CLI opening, single-instance delivery, menu actions, real window resizing, fit-page behavior, keyboard overflow, and real WebView rendering. Windows also checks forbidden IPC calls and the print command through a stubbed final browser dialog call. The optional test identity lets Windows smoke checks run alongside a normal Folio instance; rebuild without the override before packaging a distributable. These checks do not install the app, change file defaults or print on a physical printer. Full desktop drag/drop, file picker, application chooser and printer output remain manual release checks. The CI workflow is configured to build both operating systems; a successful build does not replace those checks.
