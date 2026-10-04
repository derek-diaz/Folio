import { useEffect, useState } from 'react';
import type { Capabilities, FitMode, ViewState } from '../core/types';
import { Icon, type IconName } from './Icon';
import { ToolbarMenu } from './ToolbarMenu';

function Tool({ icon, label, onClick, disabled, pressed }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <button className="icon-button" title={label} aria-label={label} disabled={disabled} aria-pressed={pressed} onClick={onClick}><Icon name={icon} /></button>;
}
export function Toolbar({ capabilities: caps, state, zoom, fit, canOpenWith, printBusy, onOpen, onPage, onZoom, onFit, onSearch, onPrint, onOpenWith }: {
  capabilities?: Capabilities; state: ViewState; zoom: number; fit: FitMode; canOpenWith: boolean; printBusy: boolean;
  onOpen: () => void; onPage: (page: number) => void; onZoom: (zoom: number) => void; onFit: (mode: FitMode) => void; onSearch: () => void; onPrint: () => void; onOpenWith: () => void;
}) {
  const [page, setPage] = useState(String(state.page));
  useEffect(() => setPage(String(state.page)), [state.page]);
  const submitPage = () => { const value = Number(page); if (Number.isInteger(value) && value >= 1 && value <= state.pages) onPage(value); else setPage(String(state.page)); };
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const modes = [
    ...(caps?.fit === 'width' ? [{ label: 'Fit width', action: () => onFit('width'), checked: fit === 'width' }] : []),
    ...(caps?.fitPage ? [{ label: 'Fit page', action: () => onFit('page'), checked: fit === 'page' }] : []),
    ...(caps?.fit === 'window' ? [{ label: 'Fit to window', action: () => onFit('window'), checked: fit === 'window' }] : []),
    { label: 'Actual size (100%)', action: () => onZoom(1), checked: !fit && zoom === 1 },
  ];
  const modeLabel = fit === 'width' ? 'Fit width' : fit === 'page' ? 'Fit page' : fit === 'window' ? 'Fit to window' : 'View';
  const overflow = [
    ...(compact && caps?.print ? [{ label: 'Print…', action: onPrint, disabled: state.busy || printBusy }] : []),
    ...(canOpenWith ? [{ label: 'Open With…', action: onOpenWith }] : []),
  ];
  return <div className="toolbar" role="toolbar" aria-label="Document tools">
    <div className="toolbar-start"><button className="open-button" onClick={onOpen} title="Open file (Ctrl+O)" aria-label="Open file (Ctrl+O)"><Icon name="open" /><span>Open</span></button></div>
    <div className="toolbar-view" role="group" aria-label="Viewing controls">
      {caps?.pagination && <div className="tool-group page-tools" role="group" aria-label="Page navigation">
        <Tool icon="left" label="Previous page" disabled={state.page <= 1 || state.busy} onClick={() => onPage(state.page - 1)} />
        <label className="page-control"><input aria-label="Page number" inputMode="numeric" value={page} onChange={event => setPage(event.target.value)} onBlur={submitPage} onKeyDown={event => { if (event.key === 'Enter') submitPage(); }} /><span>/ {state.pages || '—'}</span></label>
        <Tool icon="right" label="Next page" disabled={state.page >= state.pages || state.busy} onClick={() => onPage(state.page + 1)} />
      </div>}
      {caps?.zoom && <div className="tool-group zoom-tools" role="group" aria-label="Zoom">
        <Tool icon="minus" label="Zoom out (Ctrl+-)" disabled={zoom <= 0.25} onClick={() => onZoom(zoom - 0.1)} />
        <button className="zoom-value" title="Actual size (Ctrl+0)" aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to actual size`} onClick={() => onZoom(1)}>{`${Math.round(zoom * 100)}%`}</button>
        <Tool icon="plus" label="Zoom in (Ctrl++)" disabled={zoom >= 3} onClick={() => onZoom(zoom + 0.1)} />
      </div>}
      {caps?.fit && <ToolbarMenu label={modeLabel} name="Viewing mode" items={modes} />}
    </div>
    <div className="tool-group document-actions" role="group" aria-label="Document actions">
      {caps?.search && <Tool icon="search" label="Find in document (Ctrl+F)" onClick={onSearch} />}
      {caps?.print && !compact && <Tool icon="print" label="Print (Ctrl+P)" onClick={onPrint} disabled={state.busy || printBusy} />}
      {canOpenWith && !compact && <button className="open-with" onClick={onOpenWith} title="Choose another application" aria-label="Open With…"><Icon name="external" width="16" height="16" /><span>Open With…</span></button>}
      {compact && overflow.length > 0 && <ToolbarMenu label="More" name="More document actions" items={overflow} className="actions-overflow" />}
    </div>
  </div>;
}
