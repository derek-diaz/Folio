import type { Capabilities, Format, RendererDefinition } from './types';

const reading: Capabilities = { search: true, textSelection: true, zoom: true, fit: false, pagination: false, print: true };
export const renderers: readonly RendererDefinition[] = [
  { id: 'text', label: 'Text', capabilities: reading, load: () => import('../renderers/TextRenderer') },
  { id: 'markdown', label: 'Markdown', capabilities: reading, load: () => import('../renderers/MarkdownRenderer') },
  { id: 'docx', label: 'Word document', capabilities: reading, load: () => import('../renderers/DocxRenderer') },
  { id: 'csv', label: 'CSV', capabilities: { ...reading, print: false }, load: () => import('../renderers/CsvRenderer') },
  { id: 'pdf', label: 'PDF', capabilities: { ...reading, fit: 'width', fitPage: true, pagination: true }, load: () => import('../renderers/PdfRenderer') },
  { id: 'image', label: 'Image', capabilities: { ...reading, search: false, textSelection: false, fit: 'window' }, load: () => import('../renderers/ImageRenderer') },
];
export function rendererFor(format: Format): RendererDefinition | undefined { return renderers.find(renderer => renderer.id === format); }
export function supports(format: Format, capability: keyof Capabilities): boolean { return Boolean(rendererFor(format)?.capabilities[capability]); }
