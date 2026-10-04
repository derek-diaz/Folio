import type { DocumentFile } from '../core/types';
import { Icon } from './Icon';

export function ErrorState({ document, error, onRetry, onOpenWith }: { document: DocumentFile; error: string; onRetry: () => void; onOpenWith?: () => void }) {
  return <section className="error-state" role="alert">
    <Icon name="warning" width="30" height="30" />
    <h1>Folio couldn’t open this file.</h1>
    <p className="error-filename">{document.name}</p>
    <p className="muted">{document.detection.reason || 'The file may be damaged, protected, or outside the supported limits.'}</p>
    <div className="error-actions"><button onClick={onRetry}>Try again</button>{onOpenWith && <button onClick={onOpenWith}>Open With…</button>}</div>
    <details><summary>Technical details</summary><p>Detected type: {document.detection.mime}</p><pre>{error}</pre></details>
  </section>;
}
