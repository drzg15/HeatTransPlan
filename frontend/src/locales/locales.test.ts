/** Guards en/de from drifting apart.
 *
 *  Adding an English string without its German counterpart is the easy mistake
 *  to make, and silently degrades the German UI: i18next falls back to the
 *  English text, so nothing looks broken. These tests fail instead. */

import { describe, it, expect } from 'vitest';
import en from './en.json';
import de from './de.json';

/** Strings that are genuinely the same in both languages: proper nouns, units,
 *  symbols and formulae. Anything not listed here that reads identically in
 *  both files is an untranslated string — translate it, or add it here with a
 *  reason. */
const SAME_IN_BOTH = new Set([
  'appshell.title', // product name
  'appshell.lang.en', // language names are written in their own language
  'appshell.lang.de',
  'analysis.charts.pinch', // "Pinch" is the loanword used in German too
  'stream.vars.Tout', // symbol
  'optimization.panel.headers.w_el', // symbol
  'optimization.desc_opt_panel_c5', // unit only
  'optimization.desc_opt_panel_c6', // formula only
  'optimization.real', // loanword in this domain
  'optimization.carnot_50', // proper noun
  'cop_modal.name', // same word in both
  'cop_modal.cop_equals', // formula
  'cop_modal.envelope.cop_min', // symbol
  'cop_modal.envelope.cop_max',
]);

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

const flatEn = flatten(en as Tree);
const flatDe = flatten(de as Tree);

describe('locales', () => {
  it('has the same keys in both languages', () => {
    const missingDe = [...flatEn.keys()].filter((k) => !flatDe.has(k));
    const missingEn = [...flatDe.keys()].filter((k) => !flatEn.has(k));
    expect({ missingDe, missingEn }).toEqual({ missingDe: [], missingEn: [] });
  });

  it('has no untranslated German strings', () => {
    // Short strings are skipped: numbers, single symbols and abbreviations are
    // identical across languages often enough that listing each one is noise.
    const untranslated = [...flatEn].filter(
      ([k, v]) => v.length > 3 && flatDe.get(k) === v && !SAME_IN_BOTH.has(k)
    );
    expect(untranslated).toEqual([]);
  });

  it('keeps the allowlist free of stale entries', () => {
    // An allowlisted key that has since been translated, or removed, should
    // come off the list rather than sit there granting a blanket exemption.
    const stale = [...SAME_IN_BOTH].filter((k) => flatDe.get(k) !== flatEn.get(k));
    expect(stale).toEqual([]);
  });

  it('interpolates the same placeholders in both languages', () => {
    // A {{count}} dropped in translation renders as a blank in the UI.
    const mismatched: Record<string, { en: string[]; de: string[] }> = {};
    for (const [k, v] of flatEn) {
      const vars = (s: string) => [...s.matchAll(/{{\s*(\w+)/g)].map((m) => m[1]).sort();
      const a = vars(v);
      const b = vars(flatDe.get(k) ?? '');
      if (a.join() !== b.join()) mismatched[k] = { en: a, de: b };
    }
    expect(mismatched).toEqual({});
  });
});
