import type { RendererProps } from '../core/types';
import { HtmlView } from './shared/HtmlView';
import { useParsed } from './shared/parse';
export default function DocxRenderer(props: RendererProps) {
  const result = useParsed('docx', props);
  return result ? <HtmlView {...props} html={result.html ?? ''} /> : null;
}
