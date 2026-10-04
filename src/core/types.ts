import type { ComponentType, Ref } from 'react';

export type Format = 'pdf' | 'docx' | 'markdown' | 'text' | 'csv' | 'image' | 'rtf' | 'unknown';
export interface Detection { format: Format; mime: string; reason?: string }
export interface DocumentFile {
  id: string;
  name: string;
  path?: string;
  size: number;
  bytes: Uint8Array<ArrayBuffer>;
  detection: Detection;
}
export interface RecentFile { path: string; name: string; openedAt: number }
export type FitMode = 'width' | 'page' | 'window' | null;
export interface Capabilities {
  search: boolean;
  textSelection: boolean;
  zoom: boolean;
  fit: 'width' | 'window' | false;
  fitPage?: boolean;
  pagination: boolean;
  print: boolean;
}
export interface ViewState {
  page: number;
  pages: number;
  matches: number;
  searching: boolean;
  searchQuery: string;
  busy: boolean;
  notice: string;
  metadata: string;
  effectiveZoom?: number;
}
export const initialViewState: ViewState = { page: 1, pages: 0, matches: 0, searching: false, searchQuery: '', busy: true, notice: '', metadata: '' };
export interface RendererHandle { goToPage?(page: number): void; print(): Promise<void> }
export interface RendererProps {
  document: DocumentFile;
  zoom: number;
  fit: FitMode;
  query: string;
  matchIndex: number;
  onState: (state: Partial<ViewState>) => void;
  onError: (error: unknown) => void;
  ref?: Ref<RendererHandle>;
}
export interface RendererDefinition {
  id: Exclude<Format, 'unknown' | 'rtf'>;
  label: string;
  capabilities: Readonly<Capabilities>;
  load: () => Promise<{ default: ComponentType<RendererProps> }>;
}
