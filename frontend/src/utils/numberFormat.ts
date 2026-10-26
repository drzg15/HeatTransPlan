/** German number style for the economic analysis: "." groups thousands, ","
 *  marks decimals (3.222.575 / 0,07), whatever the UI language. */

export function formatDe(value: number, maxDigits = 0, grouping = true): string {
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: maxDigits,
    useGrouping: grouping,
  }).format(value);
}

/** Reads what a user typed in either style. A comma is always the decimal
 *  mark; a dot is a thousands separator only in a "1.234.567" pattern, so a
 *  price typed as 0.07 or 0.075 still reads as a decimal. */
export function parseDe(text: string): number {
  const s = text.trim().replace(/\s/g, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}
