import { FONT_SIZE, LINE_HEIGHT, MAX_LINES, MIN_FONT_SIZE, TEXT_PADDING, type ShapeKind } from './types';

// Text fitting inside shapes (SPEC §2.2a): one font size for the whole drawing, wrap on words,
// hyphenate overlong words, grow the shape if allowed, otherwise shrink to the minimum and finally
// truncate with an ellipsis. Measurement is injected so this stays testable without a browser.

export type Measure = (text: string, fontSize: number) => number;

export interface FittedText {
  lines: string[];
  fontSize: number;
  /** True when text was cut off with "…". */
  truncated: boolean;
  /** Height the text block needs at the chosen font size. */
  height: number;
}

/** Usable text area of a shape: minus padding; a diamond only has its inscribed rectangle. */
export function textBox(kind: ShapeKind, width: number, height: number): { width: number; height: number } {
  let w = width;
  let h = height;
  if (kind === 'decision') {
    w = width / 2;
    h = height / 2;
  } else if (kind === 'start' || kind === 'end') {
    w = width - height / 2;
  } else if (kind === 'document') {
    h = height * 0.8;
  } else if (kind === 'manual') {
    h = height * 0.8;
  } else if (kind === 'subprocess') {
    w = width - 16;
  } else if (kind === 'wait') {
    w = width - height / 2;
  } else if (kind === 'data') {
    h = height * 0.7;
  }
  return { width: Math.max(10, w - 2 * TEXT_PADDING), height: Math.max(10, h - 2 * TEXT_PADDING) };
}

/** Splits a word that is wider than the line into hyphenated pieces. */
function breakWord(word: string, width: number, fontSize: number, measure: Measure): string[] {
  const pieces: string[] = [];
  let rest = word;
  while (measure(rest, fontSize) > width && rest.length > 1) {
    let cut = rest.length - 1;
    while (cut > 1 && measure(`${rest.slice(0, cut)}-`, fontSize) > width) cut--;
    pieces.push(`${rest.slice(0, cut)}-`);
    rest = rest.slice(cut);
  }
  pieces.push(rest);
  return pieces;
}

export function wrapText(text: string, width: number, fontSize: number, measure: Measure, allowBreak = true): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const raw of paragraph.split(/\s+/).filter(Boolean)) {
      for (const word of allowBreak ? breakWord(raw, width, fontSize, measure) : [raw]) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || measure(candidate, fontSize) <= width) {
          line = candidate;
        } else {
          lines.push(line);
          line = word;
        }
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [''];
}

function blockHeight(lineCount: number, fontSize: number): number {
  return lineCount * fontSize * LINE_HEIGHT;
}

/**
 * Fits text into a box. With `canGrow`, the font size stays at FONT_SIZE and the caller grows the
 * shape to `height` (see `grownHeight`). Without, the font shrinks to MIN_FONT_SIZE and then truncates.
 */
export function fitText(
  text: string,
  box: { width: number; height: number },
  measure: Measure,
  options: { canGrow?: boolean } = {},
): FittedText {
  if (options.canGrow) {
    const lines = wrapText(text, box.width, FONT_SIZE, measure);
    return { lines, fontSize: FONT_SIZE, truncated: false, height: blockHeight(lines.length, FONT_SIZE) };
  }
  // First try to fit without splitting words (a smaller font beats "Comple-et?"), then with.
  for (const allowBreak of [false, true]) {
    for (let size = FONT_SIZE; size >= MIN_FONT_SIZE; size--) {
      const lines = wrapText(text, box.width, size, measure, allowBreak);
      const fitsWidth = lines.every((l) => measure(l, size) <= box.width);
      if (fitsWidth && blockHeight(lines.length, size) <= box.height) {
        return { lines, fontSize: size, truncated: false, height: blockHeight(lines.length, size) };
      }
    }
  }
  const maxLines = Math.max(1, Math.floor(box.height / (MIN_FONT_SIZE * LINE_HEIGHT)));
  const lines = wrapText(text, box.width, MIN_FONT_SIZE, measure).slice(0, maxLines);
  let last = lines[lines.length - 1] ?? '';
  while (last.length > 0 && measure(`${last}…`, MIN_FONT_SIZE) > box.width) last = last.slice(0, -1);
  lines[lines.length - 1] = `${last.trimEnd()}…`;
  return {
    lines,
    fontSize: MIN_FONT_SIZE,
    truncated: true,
    height: blockHeight(lines.length, MIN_FONT_SIZE),
  };
}

/** Shape height needed to show the text at FONT_SIZE (task-like shapes grow, in grid steps). */
export function grownHeight(
  kind: ShapeKind,
  text: string,
  width: number,
  currentHeight: number,
  measure: Measure,
  grid = 10,
): number {
  const probe = textBox(kind, width, 1000);
  const lines = wrapText(text, probe.width, FONT_SIZE, measure);
  const needed = blockHeight(lines.length, FONT_SIZE);
  const inner = textBox(kind, width, currentHeight).height;
  if (needed <= inner) return currentHeight;
  // Solve for the height whose inner text height fits; iterate in grid steps.
  let h = currentHeight;
  while (textBox(kind, width, h).height < needed && h < currentHeight + 40 * grid) h += grid;
  return h;
}

/** Number of lines at the base font size, for the "label te lang" check. */
export function lineCount(kind: ShapeKind, text: string, width: number, height: number, measure: Measure): number {
  return wrapText(text, textBox(kind, width, height).width, FONT_SIZE, measure).length;
}

export const TOO_MANY_LINES = MAX_LINES;
