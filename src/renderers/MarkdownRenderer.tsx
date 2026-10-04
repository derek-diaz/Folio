import type { RendererProps } from '../core/types';
import { HtmlView } from './shared/HtmlView';
import { useParsed } from './shared/parse';
export default function MarkdownRenderer(props: RendererProps) {
  const result = useParsed('markdown', props);
  return result ? <HtmlView {...props} html={result.html ?? ''} /> : null;
}
