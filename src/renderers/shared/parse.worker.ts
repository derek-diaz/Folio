import { decodeText } from '../../core/detect';
import { inspectDocx } from '../../core/zipGuard';
import type { ParseRequest, ParsedDocument } from './parse';

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  try {
    const { kind, bytes } = event.data;
    if (bytes.byteLength > (kind === 'markdown' ? 8 : 32) * 1024 * 1024) throw new Error(`This ${kind} file exceeds the renderer's ${kind === 'markdown' ? 8 : 32} MB limit.`);
    let result: ParsedDocument;
    if (kind === 'docx') {
      if (!inspectDocx(bytes)) throw new Error('The file is not a valid DOCX container.');
      const mammoth = (await import('mammoth/mammoth.browser')).default;
      const converted = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer }, {
        externalFileAccess: false,
        includeEmbeddedStyleMap: false,
        styleMap: ['u => u'],
        idPrefix: 'docx-',
        convertImage: mammoth.images.imgElement(async image => {
          if (!/^image\/(png|jpeg|gif|webp)$/.test(image.contentType)) return { src: '', alt: 'Unsupported embedded image' };
          return { src: `data:${image.contentType};base64,${await image.read('base64')}` };
        }),
      });
      result = { html: converted.value, notice: 'Reading layout · Word pagination and some formatting may differ.' };
    } else {
      const { text, encoding } = decodeText(bytes);
      if (kind === 'markdown') {
        const { marked } = await import('marked');
        result = { html: await marked.parse(text, { gfm: true, breaks: false }), notice: '' };
      } else if (kind === 'csv') {
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimitersToGuess: [',', ';', '\t'] });
        if (parsed.errors.some(error => error.type === 'Quotes')) throw new Error('The table contains an unclosed or invalid quoted field.');
        const columns = Math.max(0, ...parsed.data.slice(0, 1000).map(row => row.length));
        if (columns > 250 || parsed.data.some(row => row.length > 250)) throw new Error('This table exceeds the 250 column limit.');
        if (parsed.data.length > 500001) throw new Error('This table exceeds the 500,000 row limit.');
        result = { rows: parsed.data, notice: `${Math.max(0, parsed.data.length - 1).toLocaleString()} rows · ${encoding} · ${parsed.meta.delimiter === '\t' ? 'Tab' : parsed.meta.delimiter === ';' ? 'Semicolon' : 'Comma'} separated` };
      } else {
        const lines = text.split(/\r\n|\n|\r/);
        if (lines.length > 1000000 || lines.some(line => line.length > 1000000)) throw new Error('This text exceeds the 1,000,000 line or characters-per-line limit.');
        result = { text, lines, notice: encoding };
      }
    }
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
