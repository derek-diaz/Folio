import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Toolbar } from '../../src/ui/Toolbar';
import { initialViewState } from '../../src/core/types';
import { rendererFor } from '../../src/core/registry';
beforeEach(() => { vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows only image actions and resets to actual size through the percentage control', () => {
  const zoom = vi.fn();
  render(<Toolbar capabilities={rendererFor('image')!.capabilities} state={{ ...initialViewState, busy: false }} zoom={2} fit={null} canOpenWith={false} printBusy={false} onOpen={vi.fn()} onPage={vi.fn()} onZoom={zoom} onFit={vi.fn()} onSearch={vi.fn()} onPrint={vi.fn()} onOpenWith={vi.fn()} />);
  expect(screen.queryByLabelText('Page number')).toBeNull();
  expect(screen.queryByLabelText('Find in document (Ctrl+F)')).toBeNull();
  fireEvent.click(screen.getByText('200%')); expect(zoom).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole('button', { name: 'Viewing mode: View' }));
  expect(screen.getByRole('menuitemradio', { name: 'Fit to window' })).toBeTruthy();
  expect(screen.queryByRole('menuitemradio', { name: 'Fit page' })).toBeNull();
});

it('validates PDF page entry and disables navigation at document boundaries', () => {
  const page = vi.fn();
  render(<Toolbar capabilities={rendererFor('pdf')!.capabilities} state={{ ...initialViewState, page: 1, pages: 5, busy: false }} zoom={1} fit="width" canOpenWith={false} printBusy={false} onOpen={vi.fn()} onPage={page} onZoom={vi.fn()} onFit={vi.fn()} onSearch={vi.fn()} onPrint={vi.fn()} onOpenWith={vi.fn()} />);
  expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Page number'), { target: { value: '99' } }); fireEvent.blur(screen.getByLabelText('Page number'));
  expect(page).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Page number'), { target: { value: '4' } }); fireEvent.keyDown(screen.getByLabelText('Page number'), { key: 'Enter' });
  expect(page).toHaveBeenCalledWith(4);
});

it('keeps overflow actions keyboard accessible and calls the existing handoff', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const handoff = vi.fn();
  render(<Toolbar capabilities={rendererFor('pdf')!.capabilities} state={{ ...initialViewState, pages: 2, busy: false }} zoom={.65} fit="page" canOpenWith printBusy onOpen={vi.fn()} onPage={vi.fn()} onZoom={vi.fn()} onFit={vi.fn()} onSearch={vi.fn()} onPrint={vi.fn()} onOpenWith={handoff} />);
  const more = screen.getByRole('button', { name: 'More document actions: More' });
  fireEvent.keyDown(more, { key: 'ArrowDown' });
  expect((screen.getByRole('menuitem', { name: 'Print…' }) as HTMLButtonElement).disabled).toBe(true);
  const openWith = screen.getByRole('menuitem', { name: 'Open With…' });
  expect(document.activeElement).toBe(openWith);
  fireEvent.keyDown(openWith, { key: 'Escape' });
  expect(document.activeElement).toBe(more);
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Open With…' }));
  expect(handoff).toHaveBeenCalledOnce();
});
