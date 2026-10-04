import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { RendererProps } from '../core/types';
import { findMatches, MAX_MATCHES } from '../core/search';
import { printContent } from '../platform/print';
import { focusDomMatch, highlightDom } from './shared/domSearch';
import './pdf.css';

GlobalWorkerOptions.workerSrc = pdfWorker;
interface PdfHit { page: number; index: number }

export default function PdfRenderer(props: RendererProps) {
  const { document: file, onState, onError } = props;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  useEffect(() => {
    let cancelled = false;
    const task = getDocument({
      data: file.bytes.slice(),
      cMapUrl: new URL('/pdf/cmaps/', location.href).href,
      standardFontDataUrl: new URL('/pdf/standard_fonts/', location.href).href,
      wasmUrl: new URL('/pdf/wasm/', location.href).href,
      useWorkerFetch: false,
      enableXfa: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      maxImageSize: 32000000,
    });
    task.promise.then(document => {
      if (cancelled) return;
      if (document.numPages > 2000) { onError(new Error('This PDF exceeds the 2,000 page limit.')); return; }
      setPdf(document); onState({ pages: document.numPages, busy: false });
    }).catch(error => { if (!cancelled) onError(error); });
    return () => { cancelled = true; void task.destroy(); };
  }, [file, onError, onState]);
  return pdf ? <PdfView {...props} pdf={pdf} /> : null;
}
function PdfView({ pdf, document: file, zoom, fit, query, matchIndex, onState, onError, ref }: RendererProps & { pdf: PDFDocumentProxy }) {
  const scroll = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const activePage = useRef(1);
  const anchor = useRef(0);
  const scales = useRef(new Map<number, number>());
  const [hits, setHits] = useState<PdfHit[]>([]);
  const cache = useRef(new Map<number, string>());
  useLayoutEffect(() => {
    const parent = scroll.current;
    if (!parent) return;
    // Measure before the workspace restores its saved scroll position. Waiting
    // for the observer's first delivery can otherwise reset a reopened tab.
    const style = getComputedStyle(parent);
    const resize = (width: number, height: number) => {
      width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
      setViewport(old => old.width === width && old.height === height ? old : { width, height });
    };
    resize(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), parent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      resize(width, height);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  const goToPage = useCallback((page: number) => {
    const parent = scroll.current;
    const target = parent?.querySelector<HTMLElement>(`[data-page="${Math.min(pdf.numPages, Math.max(1, page))}"]`);
    if (parent && target) parent.scrollTo({ top: target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - parseFloat(getComputedStyle(parent).paddingTop) });
  }, [pdf.numPages]);
  // Keep the current page in place as fitting recomputes or manual zoom changes.
  // Page-fit starts at its gutter so the complete page remains visible.
  useLayoutEffect(() => {
    const parent = scroll.current;
    const target = parent?.querySelector<HTMLElement>(`[data-page="${activePage.current}"]`);
    if (!parent || !target) return;
    const gutter = parseFloat(getComputedStyle(parent).paddingTop);
    parent.scrollTop = target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - gutter + (fit === 'page' ? 0 : anchor.current * target.offsetHeight);
  }, [fit, zoom, viewport.width, viewport.height]);
  const reportScale = useCallback((page: number, scale: number) => {
    scales.current.set(page, scale);
    if (activePage.current === page) onState({ effectiveZoom: scale });
  }, [onState]);
  useEffect(() => {
    let cancelled = false;
    setHits([]); onState({ matches: 0, searching: Boolean(query), searchQuery: query });
    if (!query) { onState({ notice: '' }); return; }
    void (async () => {
      const found: PdfHit[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        if (cancelled) return;
        let text = cache.current.get(number);
        if (text === undefined) {
          const page = await pdf.getPage(number);
          const content = await page.getTextContent();
          text = content.items.map(item => 'str' in item ? item.str : '').join('');
          cache.current.set(number, text);
        }
        findMatches(text, query, MAX_MATCHES - found.length).forEach((_, index) => found.push({ page: number, index }));
        if (found.length >= MAX_MATCHES) break;
        if (number % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (!cancelled) { setHits(found); onState({ matches: found.length, searching: false, searchQuery: query, notice: found.length >= MAX_MATCHES ? 'Showing the first 10,000 matches' : '' }); }
    })().catch(error => { if (!cancelled) onError(error); });
    return () => { cancelled = true; };
  }, [pdf, query, onState, onError]);
  const selected = hits[matchIndex];
  useEffect(() => { if (selected) goToPage(selected.page); }, [selected, goToPage]);
  useImperativeHandle(ref, () => ({
    goToPage,
    print: async () => {
      if (pdf.numPages > 100) throw new Error('PDF printing is limited to 100 pages. Use Open With for this document.');
      const content = window.document.createElement('div');
      let pixels = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        onState({ notice: `Preparing page ${number} of ${pdf.numPages} for printing…` });
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: 2 });
        pixels += viewport.width * viewport.height;
        if (pixels > 100000000) throw new Error('This PDF exceeds the print memory limit. Use Open With to print it.');
        const canvas = window.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport, intent: 'print' }).promise;
        const img = new Image(); img.src = canvas.toDataURL('image/png'); img.className = 'print-pdf-page';
        content.append(img); canvas.width = 0; canvas.height = 0;
      }
      onState({ notice: '' });
      await printContent(content, file.name);
    },
  }), [pdf, goToPage, file.name, onState]);
  const updatePage = () => {
    const parent = scroll.current;
    if (!parent) return;
    const top = parent.getBoundingClientRect().top;
    for (const page of parent.querySelectorAll<HTMLElement>('[data-page]')) {
      if (page.getBoundingClientRect().bottom > top + 80) {
        const number = Number(page.dataset.page);
        activePage.current = number;
        anchor.current = (top + parseFloat(getComputedStyle(parent).paddingTop) - page.getBoundingClientRect().top) / page.offsetHeight;
        onState({ page: number, effectiveZoom: scales.current.get(number) });
        break;
      }
    }
  };
  return <div className="document-scroll pdf-scroll" tabIndex={0} aria-label="PDF document" ref={scroll} onScroll={updatePage}>
    {Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={i} pdf={pdf} number={i + 1} zoom={zoom} fitWidth={fit ? viewport.width : undefined} fitHeight={fit === 'page' ? viewport.height : undefined} query={query} selected={selected?.page === i + 1 ? selected.index : -1} onError={onError} onScale={reportScale} />)}
  </div>;
}

function PdfPage({ pdf, number, zoom, fitWidth, fitHeight, query, selected, onError, onScale }: { pdf: PDFDocumentProxy; number: number; zoom: number; fitWidth?: number; fitHeight?: number; query: string; selected: number; onError: (error: unknown) => void; onScale: (page: number, scale: number) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(number === 1);
  const [size, setSize] = useState({ width: 612, height: 792 });
  const [rendered, setRendered] = useState(0);
  const scale = fitWidth ? Math.min(fitWidth / size.width, fitHeight ? fitHeight / size.height : Infinity) : zoom * 96 / 72;
  useEffect(() => { onScale(number, scale * 72 / 96); }, [number, scale, onScale]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setNear(entries[0].isIntersecting), { rootMargin: '700px' });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) { root.current?.replaceChildren(); layer.current = null; return; }
    let cancelled = false;
    let render: RenderTask | undefined;
    let text: TextLayer | undefined;
    const canvas = window.document.createElement('canvas');
    const textContainer = window.document.createElement('div');
    textContainer.className = 'textLayer';
    root.current?.replaceChildren(canvas, textContainer);
    layer.current = textContainer;
    void (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setSize(old => old.width === base.width && old.height === base.height ? old : { width: base.width, height: base.height });
      const actualScale = fitWidth ? Math.min(fitWidth / base.width, fitHeight ? fitHeight / base.height : Infinity) : zoom * 96 / 72;
      const viewport = page.getViewport({ scale: actualScale });
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (viewport.width * viewport.height)));
      canvas.width = Math.ceil(viewport.width * density); canvas.height = Math.ceil(viewport.height * density);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      textContainer.style.setProperty('--total-scale-factor', String(actualScale));
      render = page.render({ canvas, viewport, transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0] });
      await render.promise;
      if (cancelled) return;
      text = new TextLayer({ textContentSource: await page.getTextContent(), container: textContainer, viewport });
      if (cancelled) return;
      await text.render();
      if (!cancelled) setRendered(value => value + 1);
    })().catch(error => { if (!cancelled && error?.name !== 'RenderingCancelledException') onError(error); });
    return () => { cancelled = true; render?.cancel(); text?.cancel(); layer.current = null; canvas.width = 0; canvas.height = 0; };
  }, [pdf, number, zoom, fitWidth, fitHeight, near, onError]);
  useEffect(() => {
    if (!layer.current) return;
    highlightDom(layer.current, query);
    focusDomMatch(layer.current, selected, false);
  }, [query, selected, rendered]);
  return <div className="pdf-page" data-page={number} aria-label={`Page ${number}`} ref={root} style={{ width: size.width * scale, height: size.height * scale }} />;
}
