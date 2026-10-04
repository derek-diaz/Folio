import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { native } from './files';

export type DocumentAction = 'find' | 'print' | 'open-with' | 'zoom-in' | 'zoom-out' | 'actual-size' | 'fit' | 'fit-page';
export type MenuAction = DocumentAction | 'open' | 'close' | 'appearance' | 'about';
export interface DocumentMenuState { find: boolean; print: boolean; openWith: boolean; zoom: boolean; fit: boolean; fitPage: boolean; fitWindow: boolean }
export const emptyMenuState: DocumentMenuState = { find: false, print: false, openWith: false, zoom: false, fit: false, fitPage: false, fitWindow: false };
export interface MenuState extends DocumentMenuState { document: boolean; modal: boolean }
export function useNativeMenu(onAction: (action: MenuAction) => void, state: MenuState, reportError: (error: unknown) => void) {
  const action = useRef(onAction);
  useEffect(() => { action.current = onAction; }, [onAction]);
  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<MenuAction>('menu-action', event => action.current(event.payload)).then(stop => {
      if (disposed) stop(); else unlisten = stop;
    }).catch(reportError);
    return () => { disposed = true; unlisten?.(); };
  }, [reportError]);
  const { document, modal, find, print, openWith, zoom, fit, fitPage, fitWindow } = state;
  useEffect(() => {
    if (native) void invoke('sync_menu', { state: { document, modal, find, print, openWith, zoom, fit, fitPage, fitWindow } }).catch(reportError);
  }, [document, modal, find, print, openWith, zoom, fit, fitPage, fitWindow, reportError]);
}
