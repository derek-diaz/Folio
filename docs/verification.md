# Implementation verification

## 0.1.4 toolbar and viewing modes

Verified locally on 2026-09-21:

- TypeScript strict checking and all 16 unit/UI tests pass. All 28 Chromium/WebKit end-to-end tests pass against the production frontend, including PDF fit-page/fit-width resizing, per-tab mode/zoom/scroll state, image scale, contextual controls, toolbar grouping, keyboard menus, disabled controls, and both themes. Existing opening, search, print preparation, appearance, and About checks also pass.
- Windows Rust tests (2) and Clippy with warnings denied pass after adding explicit native Fit Width / Fit to Window and Fit Page menu commands.
- Inspected toolbar layouts at 1280 and 620 CSS pixels. Enabled controls have separate color tokens from metadata and disabled actions. At narrow widths, Print and Open With share a labeled More menu; controls remain 34 CSS pixels high. The home screen, About dialog, icon, document styles, and text defaults are unchanged.
- A WebKit focus-loss issue during menu clicks and a PDF measurement/scroll-restoration race were found by the new tests and corrected. PDF fitting measures the available content viewport, preserves the current page through resizing, and reports scale relative to the renderer's normal 100% size. No document content is restyled and no parser scan is added for footer metadata.
- Native Windows/WebView2 smoke passes at the host's actual 144 DPI / 150% scaling. It exercises OS Fit Page dispatch, actual native-window resizing, keyboard overflow including Open With, themes, existing document flows, restricted IPC, and native print preparation with the final print dialog stubbed. A separate test application identifier allows this check alongside the user's development instance; the distributable uses the normal identifier. The resize helper explicitly matches the app's DPI awareness.
- Native Ubuntu 24.04/WebKitGTK smoke passes under Xvfb at 100% scaling, including actual window resizing, fit page, keyboard overflow, Appearance/About/Find accelerators, theme switching, CLI/single-instance delivery, and Markdown/DOCX/PDF/CSV/SVG rendering. Native screenshots at wide/narrow sizes on both platforms were inspected. WSL's software-rendering workaround is test-only.
- Remaining manual acceptance: physical printer output, Open With chooser completion, desktop picker/drag-and-drop, installer/default-app integration, Ubuntu Wayland and additional desktop scaling configurations. Browser previews are supplementary to the native checks above.
- Version 0.1.4 packages built successfully: Windows NSIS, Ubuntu `.deb`, and AppImage. SHA-256 checksums are recorded in `artifacts/SHA256SUMS.txt`. No installer was run on the user's desktop.

## 0.1.3 visual polish

Verified locally on 2026-09-21:

- TypeScript strict checking, 15 unit/UI tests, and all 22 Chromium/WebKit end-to-end tests pass. After correcting PDF/image fit measurements, the six affected rendering and print-preparation checks pass again, including new narrow-window overflow assertions.
- Inspected dark/light home views, recent-file rows, document views, and a narrow window with many tabs. Tabs and contextual tools share a compact surface, active tabs use a subtle fill, secondary controls appear on hover/focus, and document/status regions lose unnecessary dividers. Native menus and keyboard behavior are retained.
- Recent rows retain the complete file path for opening and the tooltip while presenting an abbreviated parent folder and extension. Appearance choices remain saved Dark, Light, and System preferences; the dark choice no longer carries an IDE name.
- PDF and image fitting now use the ResizeObserver content size directly rather than subtracting padding twice. Production-bundle visual checks in Chromium and WebKit confirmed fitting at both narrow and wide sizes.
- Windows NSIS, Ubuntu `.deb`, and AppImage packages build successfully as 0.1.3; checksums are recorded alongside them. The native Linux smoke check passes for Appearance/About/Find accelerators, theme changes, CLI/single-instance delivery, and Markdown/DOCX/PDF/CSV/SVG rendering. Windows native smoke was not repeated during this pass while the user's development instance remained running.

## 0.1.2 empty-view cleanup

Verified locally on 2026-09-21:

- TypeScript builds and all eight affected Chromium/WebKit checks pass: opening and closing tabs, menu actions, theme preferences, and About details/focus.
- Inspected the empty view and About dialog. The empty tab strip, repeated Folio labels, privacy footer, and promotional copy are removed. File opening, the drop hint, recent files, and About's version/creator remain.
- Tests ran on a separate preview port while the existing development server remained running.
- Windows NSIS, Ubuntu `.deb`, and AppImage packages rebuilt successfully as 0.1.2.

## 0.1.1 appearance and desktop menus

Verified locally on 2026-09-21:

- 15 unit/UI tests, TypeScript strict checking, and all 22 Chromium/WebKit end-to-end tests pass. The new checks cover File-menu opening, capability-dependent actions, keyboard menu navigation, saved theme overrides, live System-theme changes, print colors, and About's version/creator and focus handling.
- Rust tests and Clippy with warnings denied pass on Windows and Ubuntu 24.04. Windows NSIS, Ubuntu `.deb`, and AppImage packages build as 0.1.1 with Tabierto as publisher and Derek Diaz Correa as author.
- Windows WebView2 smoke checks exercise the actual OS menu command IDs for Appearance, About, Zoom, and Find, as well as the existing renderer/IPC/print checks. Invalid theme values are rejected by the native command.
- Ubuntu WebKitGTK smoke checks exercise real GTK accelerators for Appearance (`Ctrl+,`), About (`F1`), and Find (`Ctrl+F`), switch light/dark themes, and verify the existing document flows. The test explicitly uses X11 under Xvfb and requires `xdotool`; production retains its normal desktop backend selection.
- Dark/light document views, Appearance, and About screenshots were inspected. The dark palette uses charcoal grays and blue accents. IntelliJ Dark is the default; Light and System remain explicit, saved choices.

## Initial implementation

Verified locally on 2026-09-20 with Node 24.15.0 and Rust 1.94.0.

- TypeScript strict build and 15 unit/UI tests pass.
- 16 end-to-end tests pass against the production bundle across Chromium and WebKit. Tests exercise every implemented renderer, sanitization, PDF search/text layers/page navigation, keyboard tabs, preserved zoom, 50,000-row CSV, 60,000-line TXT and complete print preparation.
- `cargo test` and Clippy with warnings denied pass on Windows and Ubuntu 24.04.
- Windows NSIS installer, Ubuntu `.deb`, and AppImage package generation succeed. Packages include dependency notices and configured file associations. No installer has been run on the user's Windows installation; existing defaults are untouched.
- Native WebView2 smoke tests pass: multiple launch arguments, second-instance delivery, Markdown/DOCX/PDF rendering under the production CSP, denied ungranted-file/recent-path requests, denied unsafe external scheme and denied save-dialog permission. Native print IPC and preparation also pass with the final `window.print()` dialog call stubbed.
- Native Ubuntu 24.04 / WebKitGTK 2.52.6 smoke tests pass under Xvfb: CLI and single-instance delivery, Markdown, DOCX, PDF text layer/canvas, CSV and SVG. WSL's software-rendered test display uses `WEBKIT_DISABLE_DMABUF_RENDERER=1`; this is a test-host setting, not an application default.
- Screenshots of light/dark Markdown, DOCX, PDF and both native environments were inspected. The UI keeps native window decorations, compact tabs/toolbars and a central reading surface.
- Runtime npm advisory audit returned zero known vulnerabilities.

Still requiring human acceptance before a public release: native drag-and-drop and file-picker interaction, choosing another app through Open With, installing/uninstalling packages and selecting default associations in Explorer/Nautilus, Wayland desktop interaction, accessibility with a screen reader, and printer output. Automated printing checks prepare all content without sending jobs to a printer. Complex real-world Word layouts, protected PDFs, multilingual font coverage and adversarial parser resource usage need a broader fixture corpus.

RTF rendering, CSV printing/resizing, local Markdown image resolution, password entry, code signing and macOS packaging are intentionally outside this first implementation. DOCX uses a reflowed reading view, not source pagination.
