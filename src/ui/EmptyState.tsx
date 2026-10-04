import type { RecentFile } from '../core/types';
import { Icon } from './Icon';
import { DocumentIcon } from './DocumentIcon';

function parentLocation(path: string) {
  const clean = path.replace(/^\\\\\?\\/, '');
  const separator = clean.includes('\\') ? '\\' : '/';
  const end = clean.lastIndexOf(separator);
  if (end < 0) return '';
  const parent = clean.slice(0, end);
  const parts = parent.split(separator).filter(Boolean);
  return parts.length > 3 || parent.length > 48 ? `…${separator}${parts.slice(-2).join(separator)}` : parent || separator;
}
function extension(name: string) {
  const suffix = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.') + 1) : '';
  return suffix && suffix.length <= 8 ? suffix.toUpperCase() : 'FILE';
}

export function EmptyState({ recents, onOpen, onRecent, onRemove }: { recents: RecentFile[]; onOpen: () => void; onRecent: (path: string) => void; onRemove: (path: string | null) => void }) {
  return <main className="empty-state">
    <section className="empty-content" aria-label="Open a document">
      <div className="empty-actions">
        <div className="home-identity"><img src="/folio.svg" alt="" width="36" height="36" /><h1>Folio</h1></div>
        <p>Drop a document here</p>
        <button className="primary-button" onClick={onOpen}><Icon name="open" />Open file<span className="shortcut">Ctrl+O</span></button>
      </div>
      {recents.length > 0 && <section className="recents" aria-label="Recent files">
        <div className="section-label"><h2>Recent</h2><button className="text-button" onClick={() => onRemove(null)}>Clear history</button></div>
        {recents.map(file => <div className="recent-row" key={file.path}>
          <button className="recent-file" title={file.path} onClick={() => onRecent(file.path)}><DocumentIcon name={file.name} size={20} /><span className="recent-details"><strong>{file.name}</strong><small>{parentLocation(file.path)}</small></span><span className="recent-type">{extension(file.name)}</span></button>
          <button className="icon-button recent-remove" title="Remove from history" aria-label={`Remove ${file.name} from history`} onClick={() => onRemove(file.path)}><Icon name="close" width="13" height="13" /></button>
        </div>)}
      </section>}
    </section>
  </main>;
}
