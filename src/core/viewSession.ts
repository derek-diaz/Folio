import type { FitMode } from './types';

export interface ViewSession {
  zoom?: number;
  fit?: FitMode;
  query?: string;
  searchOpen?: boolean;
  matchIndex?: number;
  scrollTop?: number;
  scrollLeft?: number;
}
