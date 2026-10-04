import type { Detection } from './types';
import { inspectDocx } from './zipGuard';

export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const supportedExtensions = ['pdf', 'docx', 'txt', 'md', 'markdown', 'csv', 'tsv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  else if (bytes.length > 4 && bytes[1] === 0 && bytes[3] === 0) encoding = 'utf-16le';
  else if (bytes.length > 4 && bytes[0] === 0 && bytes[2] === 0) encoding = 'utf-16be';
  try { return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes), encoding }; }
  catch { return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252 (assumed)' }; }
}
export function detectFile(name: string, bytes: Uint8Array, mime = ''): Detection {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const begins = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const raw = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (raw.includes('%PDF-')) return { format: 'pdf', mime: 'application/pdf' };
  if (begins(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10)) return { format: 'image', mime: 'image/png' };
  if (begins(0xff, 0xd8, 0xff)) return { format: 'image', mime: 'image/jpeg' };
  if (/^GIF8[79]a/.test(raw)) return { format: 'image', mime: 'image/gif' };
  if (raw.startsWith('RIFF') && raw.slice(8, 12) === 'WEBP') return { format: 'image', mime: 'image/webp' };
  if (begins(0x50, 0x4b, 3, 4)) {
    try {
      return inspectDocx(bytes) ? { format: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } : { format: 'unknown', mime: 'application/zip', reason: 'This ZIP archive is not a DOCX document.' };
    } catch (error) { return { format: 'unknown', mime: 'application/zip', reason: String(error instanceof Error ? error.message : error) }; }
  }
  if (raw.startsWith('MZ') || begins(0x7f, 0x45, 0x4c, 0x46) || begins(0xd0, 0xcf, 0x11, 0xe0)) return { format: 'unknown', mime: 'application/octet-stream' };
  const { text } = decodeText(bytes.subarray(0, Math.min(bytes.length, 8192)));
  if (/^\s*\{\\rtf/.test(text)) return { format: 'rtf', mime: 'application/rtf', reason: 'RTF viewing is not available in this release. Use Open With to read this document.' };
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return { format: 'image', mime: 'image/svg+xml' };
  const controls = text.match(/[\u0000-\u0008\u000e-\u001f]/g)?.length ?? 0;
  if (controls > Math.max(0, text.length * 0.005)) return { format: 'unknown', mime: 'application/octet-stream', reason: 'This file contains binary data.' };
  if (ext === 'md' || ext === 'markdown' || mime === 'text/markdown') return { format: 'markdown', mime: 'text/markdown' };
  if (ext === 'csv' || ext === 'tsv' || mime === 'text/csv' || mime === 'text/tab-separated-values') return { format: 'csv', mime: 'text/csv' };
  if (ext === 'txt' || ext === 'log' || mime === 'text/plain' || !name.includes('.')) return { format: 'text', mime: 'text/plain' };
  return { format: 'unknown', mime: mime || 'application/octet-stream', reason: 'This file format is not supported yet.' };
}
