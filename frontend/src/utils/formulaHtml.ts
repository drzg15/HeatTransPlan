/** A plain-text formula written with real indices, as HTML:
 *  P_el → P<sub>el</sub>, Σ_{t=1..k} → Σ<sub>t=1..k</sub>, (1 + i)^t → (1 + i)<sup>t</sup>.
 *  The text is escaped first, so any string is safe to render. */
export function formulaHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\^(\([^)]*\)|[-−]?[\p{L}\p{N}_]+(?:\.\p{N}+)?)/gu, (_, s: string) => `<sup>${s.replace(/^\((.*)\)$/, '$1')}</sup>`)
    .replace(/_(\{[^}]*\}|[\p{L}\p{N}_]+(?:,[\p{L}\p{N}_]+)*)/gu, (_, s: string) => `<sub>${s.replace(/^\{(.*)\}$/, '$1')}</sub>`);
}
