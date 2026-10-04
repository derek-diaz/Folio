import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { RendererProps } from '../core/types';
import { printContent } from '../platform/print';
import { sanitizeSvg } from './shared/sanitize';

export default function ImageRenderer({ document: file, zoom, fit, onState, onError, ref }: RendererProps) {
  const [url, setUrl] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [container, setContainer] = useState({ width: 1, height: 1 });
  const scroll = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const previous = useRef<{ scale: number; width: number; height: number; left: number; top: number; viewWidth: number; viewHeight: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = useState(false);
  useEffect(() => {
    let url = '';
    try {
      const data = file.detection.mime === 'image/svg+xml' ? sanitizeSvg(new TextDecoder().decode(file.bytes)) : file.bytes;
      url = URL.createObjectURL(new Blob([data], { type: file.detection.mime }));
      setUrl(url);
    } catch (error) { onError(error); }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file, onError]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setContainer({ width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) }); });
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, []);
  useImperativeHandle(ref, () => ({ print: async () => {
    const img = new Image(); img.src = url; img.className = 'print-image';
    await img.decode(); await printContent(img, file.name);
  } }), [url, file.name]);
  const scale = fit ? Math.min(1, container.width / dimensions.width, container.height / dimensions.height) : zoom;
  useEffect(() => { if (dimensions.width) onState({ effectiveZoom: scale }); }, [scale, dimensions.width, onState]);
  useLayoutEffect(() => {
    const parent = scroll.current;
    const img = image.current;
    if (!parent || !img || !dimensions.width) return;
    const bounds = img.getBoundingClientRect();
    const viewport = parent.getBoundingClientRect();
    const next = { scale, width: bounds.width, height: bounds.height, left: bounds.left - viewport.left + parent.scrollLeft, top: bounds.top - viewport.top + parent.scrollTop, viewWidth: parent.clientWidth, viewHeight: parent.clientHeight };
    const old = previous.current;
    if (fit) parent.scrollTo({ left: 0, top: 0 });
    else if (old && old.scale !== scale && old.width && old.height) {
      parent.scrollTo({
        left: next.left + (parent.scrollLeft + old.viewWidth / 2 - old.left) / old.width * next.width - next.viewWidth / 2,
        top: next.top + (parent.scrollTop + old.viewHeight / 2 - old.top) / old.height * next.height - next.viewHeight / 2,
      });
    }
    previous.current = next;
  }, [scale, fit, dimensions.width, container.width, container.height]);
  const canPan = dimensions.width * scale > container.width || dimensions.height * scale > container.height;
  const endPan = () => { drag.current = null; setPanning(false); };
  return <div className="document-scroll image-scroll" ref={scroll} tabIndex={0} aria-label="Image document" data-pannable={canPan} data-panning={panning} title={canPan ? 'Drag to pan, or use the arrow keys to scroll' : undefined} onPointerDown={event => {
    if (!canPan || event.button !== 0 || event.pointerType === 'touch') return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId); setPanning(true);
  }} onPointerMove={event => {
    if (!drag.current) return;
    event.currentTarget.scrollTo({ left: drag.current.left + drag.current.x - event.clientX, top: drag.current.top + drag.current.y - event.clientY });
  }} onPointerUp={event => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    endPan();
  }} onPointerCancel={endPan} onLostPointerCapture={endPan}>
    {url && <img ref={image} className="image-document" src={url} alt={file.name} draggable={false} style={dimensions.width ? { width: dimensions.width * scale, height: dimensions.height * scale } : { maxWidth: '100%' }} onLoad={event => {
      const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
      if (width * height > 100000000) { onError(new Error('This image exceeds the 100 megapixel limit.')); return; }
      setDimensions({ width, height }); onState({ busy: false, metadata: `${width.toLocaleString()} × ${height.toLocaleString()} px` });
    }} onError={() => onError(new Error('The image is incomplete or could not be decoded.'))} />}
  </div>;
}
