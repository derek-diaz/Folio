# Fixtures

All fixtures are authored for Folio and contain no user data. `node scripts/generate-fixtures.mjs` regenerates the small, valid two-page PDF, WordprocessingML DOCX with formatting/table/link/embedded PNG, and PNG. These are functional documents, not placeholder binaries. Text, GFM, quoted/multiline CSV and SVG fixtures are checked in directly.

The Markdown file deliberately includes script, unsafe-link and remote-image attempts to exercise sanitization. They must not execute or fetch anything. Tests generate large tables/text in memory instead of committing large files. Add real-world Word/LibreOffice, scanned/CJK/encrypted PDF, and legacy encoding samples (with redistribution rights) as regressions are discovered.
