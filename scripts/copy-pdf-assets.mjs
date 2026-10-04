import { cp, mkdir } from 'node:fs/promises';
// PDF fonts, character maps and decoders must be available without a network.
await mkdir('public/pdf', { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(`node_modules/pdfjs-dist/${folder}`, `public/pdf/${folder}`, { recursive: true });
}
