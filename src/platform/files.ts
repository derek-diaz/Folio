import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { detectFile, MAX_FILE_BYTES } from '../core/detect';
import { cleanRecents } from '../core/recent';
import type { DocumentFile, RecentFile } from '../core/types';

export const native = isTauri();
export interface NativeFile { id: string; path: string; name: string; size: number }
export interface OpenBatch { files: NativeFile[]; errors: string[] }
export async function readNative(file: NativeFile): Promise<DocumentFile> {
  const buffer = await invoke<ArrayBuffer>('read_document', { id: file.id });
  const bytes = new Uint8Array(buffer);
  return { ...file, bytes, detection: detectFile(file.name, bytes) };
}
export async function readBrowser(file: File): Promise<DocumentFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 64 MB file limit.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { id: crypto.randomUUID(), name: file.name, size: file.size, bytes, detection: detectFile(file.name, bytes, file.type) };
}
export const chooseFiles = () => invoke<OpenBatch>('choose_files');
export const takePending = () => invoke<OpenBatch>('take_pending');
export const releaseFile = (id: string) => native ? invoke<void>('release_document', { id }) : Promise.resolve();
export const openWith = (id: string) => invoke<void>('open_with', { id });
export const listRecents = async (): Promise<RecentFile[]> => native ? cleanRecents(await invoke('recent_files')) : [];
export const openRecent = (path: string) => invoke<OpenBatch>('open_recent', { path });
export const forgetRecent = (path: string | null) => invoke<void>('forget_recent', { path });
export const watchFiles = (handler: () => void) => listen('files-pending', handler);
export const watchDrag = (handler: (active: boolean) => void) => listen<boolean>('file-drag', event => handler(event.payload));
export async function openExternal(url: string) {
  const parsed = new URL(url);
  if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error('This link type is not supported.');
  if (native) await invoke('open_external', { url });
  else window.open(url, '_blank', 'noopener,noreferrer');
}
