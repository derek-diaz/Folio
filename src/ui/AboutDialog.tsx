import { author, publisher, version } from '../../package.json';
import { AppDialog } from './AppDialog';

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return <AppDialog title="About Folio" onClose={onClose}>
    <div className="dialog-body about-body">
      <div className="about-identity"><img src="/folio.svg" width="64" height="64" alt="" /><div><h3>Folio <span className="version-badge">{version}</span></h3><p>{publisher}</p></div></div>
      <p className="muted">Read-only document viewer.</p>
      <div className="about-credit"><span>Built by</span><strong>{author}</strong></div>
    </div>
  </AppDialog>;
}
