import { describe, expect, it } from 'vitest';
import {
  FONT_SIZE,
  fitText,
  grownHeight,
  lineCount,
  MIN_FONT_SIZE,
  textBox,
  wrapText,
  type Measure,
} from '../../../src/core/diagram';

// Monospace-like measure: each character is 0.6 × font size wide.
const measure: Measure = (text, size) => text.length * size * 0.6;

describe('text fitting', () => {
  it('wraps on words within the width', () => {
    const lines = wrapText('Controleer de aanvraag op volledigheid', 100, 10, measure);
    expect(lines).toEqual(['Controleer de', 'aanvraag op', 'volledigheid']);
    for (const l of lines) expect(measure(l, 10)).toBeLessThanOrEqual(100);
  });

  it('hyphenates long Dutch compound words', () => {
    const lines = wrapText('Arbeidsongeschiktheidsverzekering', 60, 10, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.slice(0, -1).every((l) => l.endsWith('-'))).toBe(true);
    for (const l of lines) expect(measure(l, 10)).toBeLessThanOrEqual(60);
    expect(lines.join('').replace(/-/g, '')).toBe('Arbeidsongeschiktheidsverzekering');
  });

  it('keeps the base font size when the shape can grow', () => {
    const r = fitText(
      'Een lange omschrijving van een taak die over meerdere regels loopt',
      { width: 120, height: 20 },
      measure,
      { canGrow: true },
    );
    expect(r.fontSize).toBe(FONT_SIZE);
    expect(r.truncated).toBe(false);
    expect(r.lines.length).toBeGreaterThan(2);
  });

  it('shrinks down to the minimum, then truncates with an ellipsis', () => {
    const short = fitText('Klopt het?', { width: 60, height: 40 }, measure);
    expect(short).toMatchObject({ fontSize: FONT_SIZE, truncated: false });
    const long = fitText(
      'Is de aanvraag volledig en ondertekend en zijn alle bijlagen aanwezig volgens de checklist?',
      { width: 60, height: 30 },
      measure,
    );
    expect(long.fontSize).toBe(MIN_FONT_SIZE);
    expect(long.truncated).toBe(true);
    expect(long.lines.at(-1)!.endsWith('…')).toBe(true);
    expect(long.height).toBeLessThanOrEqual(30);
    for (const l of long.lines) expect(measure(l, MIN_FONT_SIZE)).toBeLessThanOrEqual(60);
  });

  it('prefers a smaller font over splitting a word', () => {
    // "Compleet?" is 9 chars: 70.2 px at 13, 54 px at 10.
    const r = fitText('Compleet?', { width: 60, height: 40 }, measure);
    expect(r.lines).toEqual(['Compleet?']);
    expect(r.fontSize).toBe(11);
  });

  it('gives a diamond only its inscribed rectangle', () => {
    expect(textBox('decision', 140, 100)).toEqual({ width: 54, height: 34 });
    expect(textBox('task', 160, 70)).toEqual({ width: 144, height: 54 });
  });

  it('grows a task in grid steps until a 120-character label fits at the base size', () => {
    const label =
      'Controleer of de aanvraag volledig is, of alle bijlagen zijn meegestuurd en of de handtekening van de aanvrager klopt';
    expect(label.length).toBeGreaterThanOrEqual(115);
    const h = grownHeight('task', label, 160, 70, measure);
    expect(h).toBeGreaterThan(70);
    expect(h % 10).toBe(0);
    const fitted = fitText(label, textBox('task', 160, h), measure);
    expect(fitted).toMatchObject({ fontSize: FONT_SIZE, truncated: false });
    expect(grownHeight('task', 'Kort', 160, 70, measure)).toBe(70);
  });

  it('counts lines for the too-long check', () => {
    expect(lineCount('task', 'Kort', 160, 70, measure)).toBe(1);
    // Rounded shapes lose their ends, not their whole width.
    expect(lineCount('end', 'Einde', 110, 50, measure)).toBe(1);
  });
});
