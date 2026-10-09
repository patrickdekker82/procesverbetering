// Dutch number formatting for the formulas shown on screen.

const integer = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function fmtNumber(value: number): string {
  return Number.isInteger(value) ? integer.format(value) : decimal.format(value);
}

export function fmtEuro(value: number): string {
  return `€ ${integer.format(Math.round(value))}`;
}

export function fmtScore(value: number): string {
  return decimal.format(Math.round(value * 100) / 100);
}
