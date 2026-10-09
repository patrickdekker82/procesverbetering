import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

/** Renders the whole drawing (not just the visible part) to PNG or SVG data. */
export async function renderDrawing(
  container: HTMLElement,
  nodes: Node[],
  format: 'png' | 'svg',
): Promise<string> {
  const viewport = container.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) throw new Error('Geen tekening gevonden.');
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + 80);
  const height = Math.ceil(bounds.height + 80);
  const vp = getViewportForBounds(bounds, width, height, 0.2, 2, 0.05);
  const options = {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    },
    // Leave out editor chrome (handles, quick-add buttons, resize controls).
    filter: (el: HTMLElement) =>
      !(
        el.classList?.contains('react-flow__handle') ||
        el.classList?.contains('react-flow__resize-control') ||
        (el.tagName === 'BUTTON' && el.getAttribute('aria-label')?.includes('toevoegen'))
      ),
  };
  return format === 'png' ? toPng(viewport, options) : toSvg(viewport, options);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function svgDataUrlToText(dataUrl: string): string {
  const body = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return dataUrl.includes(';base64,') ? atob(body) : decodeURIComponent(body);
}
