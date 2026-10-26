import { describe, it, expect } from 'vitest';
import { formatDe, parseDe } from './numberFormat';

describe('numberFormat', () => {
  it('groups thousands with dots and decimals with a comma', () => {
    expect(formatDe(-3222575)).toBe('-3.222.575');
    expect(formatDe(0.07, 4)).toBe('0,07');
    expect(formatDe(2027, 0, false)).toBe('2027');
  });

  it('parses both styles', () => {
    expect(parseDe('2.520.000')).toBe(2520000);
    expect(parseDe('1.500')).toBe(1500);
    expect(parseDe('0,07')).toBe(0.07);
    expect(parseDe('0.075')).toBe(0.075);
    expect(parseDe('1.234,5')).toBe(1234.5);
    expect(parseDe('8760')).toBe(8760);
  });
});
