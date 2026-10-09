import type { Measure } from '../../core/diagram';

/** Same font stack for canvas measuring and for rendering, so wrapping matches what is shown. */
export const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

let context: CanvasRenderingContext2D | null | undefined;

export const measureText: Measure = (text, fontSize) => {
  if (context === undefined)
    context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!context) return text.length * fontSize * 0.55;
  context.font = `${fontSize}px ${FONT_FAMILY}`;
  return context.measureText(text).width;
};
