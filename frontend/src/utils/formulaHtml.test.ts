import { describe, expect, it } from 'vitest';
import { formulaHtml } from './formulaHtml';

describe('formulaHtml', () => {
  it('writes indices and exponents', () => {
    expect(formulaHtml('P_el = Q_Senke − Q_Quelle')).toBe(
      'P<sub>el</sub> = Q<sub>Senke</sub> − Q<sub>Quelle</sub>'
    );
    expect(formulaHtml('c_CO2,el · p_CO2(t)')).toBe('c<sub>CO2,el</sub> · p<sub>CO2</sub>(t)');
    expect(formulaHtml('Σ_{t=1..k} x / (1 + i)^t.')).toBe('Σ<sub>t=1..k</sub> x / (1 + i)<sup>t</sup>.');
    expect(formulaHtml('(1 + r)^(n·L) · Q^E_WP · x^-0.38')).toBe(
      '(1 + r)<sup>n·L</sup> · Q<sup>E<sub>WP</sub></sup> · x<sup>-0.38</sup>'
    );
  });

  it('stops at a comma before a space and escapes markup', () => {
    expect(formulaHtml('je kWh_Hs, CO₂ (< T) & mehr')).toBe(
      'je kWh<sub>Hs</sub>, CO₂ (&lt; T) &amp; mehr'
    );
  });
});
