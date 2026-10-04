import { invoke } from '@tauri-apps/api/core';
import { native } from './files';

let printing = false;
let previousCleanup: (() => void) | undefined;
export async function printContent(content: HTMLElement, title: string): Promise<void> {
  if (printing) throw new Error('A print operation is already in progress.');
  previousCleanup?.();
  printing = true;
  const host = document.createElement('div');
  host.id = 'print-root';
  host.className = 'prose';
  host.append(content);
  document.body.append(host);
  const oldTitle = document.title;
  document.title = title;
  const cleanup = () => {
    host.remove(); host.replaceChildren(); document.title = oldTitle; printing = false;
    window.removeEventListener('afterprint', cleanup);
    if (previousCleanup === cleanup) previousCleanup = undefined;
  };
  previousCleanup = cleanup;
  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    await document.fonts.ready;
    await Promise.all(Array.from(host.querySelectorAll('img')).map(img => img.decode().catch(() => undefined)));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (native) await invoke('print_document'); else window.print();
    // Keep the prepared tree for asynchronous native print UIs. A subsequent print
    // also cleans it up because not all WebKitGTK versions dispatch afterprint.
    if (!native) cleanup();
    printing = false;
  } catch (error) { cleanup(); throw error; }
}
