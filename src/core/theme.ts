import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { native } from '../platform/files';

export type ThemeMode = 'dark' | 'light' | 'system';
const storageKey = 'folio-theme';
export function readTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === 'dark' || value === 'light' || value === 'system') return value;
  } catch { /* The theme still works for this session without storage. */ }
  return 'dark';
}
export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
}
export function useTheme(reportError: (error: unknown) => void) {
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => applyTheme(theme);
    media.addEventListener('change', changed);
    try { localStorage.setItem(storageKey, theme); }
    catch { reportError('Your theme is applied for this session, but Folio could not save the preference.'); }
    if (native) void invoke('set_app_theme', { theme }).catch(reportError);
    return () => media.removeEventListener('change', changed);
  }, [theme, reportError]);
  return { theme, setTheme };
}
