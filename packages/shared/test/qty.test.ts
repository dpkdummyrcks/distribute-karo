import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromMilli, isQtyValidForUnit, linePaise, toMilli } from '../src/index.js';

interface Vector {
  ratePaise: number;
  qty: string;
  qtyMilli: number;
  linePaise: number;
}
const vectors = JSON.parse(
  readFileSync(new URL('../fixtures/qty-money-vectors.json', import.meta.url), 'utf8'),
) as Vector[];

describe('qty/money vectors (shared with Kotlin + SQL)', () => {
  it.each(vectors)('$qty × $ratePaise paise', (v) => {
    expect(toMilli(v.qty)).toBe(v.qtyMilli);
    expect(linePaise(v.ratePaise, toMilli(v.qty))).toBe(v.linePaise);
  });
});

describe('toMilli / fromMilli', () => {
  it.each([
    ['0', 0],
    ['2.5', 2500],
    ['0.001', 1],
    ['9999999.999', 9_999_999_999],
    ['-1.5', -1500],
  ])('%s ⇄ %d', (s, m) => {
    expect(toMilli(s)).toBe(m);
    expect(fromMilli(m)).toBe(s);
  });
  it('trims trailing zeros', () => {
    expect(fromMilli(2500)).toBe('2.5');
    expect(fromMilli(3000)).toBe('3');
  });
  it.each(['', '1.', '.5', '1.2345', 'abc', '12345678'])('rejects %j', (s) => {
    expect(() => toMilli(s)).toThrow(RangeError);
  });
  it('rejects unsafe integers', () => {
    expect(() => fromMilli(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });
});

describe('linePaise rounding', () => {
  it('rounds half up', () => {
    expect(linePaise(1, 500)).toBe(1);
    expect(linePaise(1, 499)).toBe(0);
  });
  it('handles negative (adjustment) quantities symmetrically', () => {
    expect(linePaise(1, -500)).toBe(-1);
    expect(linePaise(1, -499)).toBe(0);
  });
  it('stays exact up to the safe range and refuses beyond it', () => {
    expect(linePaise(10_000_000_000, 999_999)).toBe(9_999_990_000_000);
    expect(() => linePaise(10_000_000_000, 9_999_999_999)).toThrow(RangeError);
  });
});

describe('isQtyValidForUnit', () => {
  it('allows decimals only for weight/volume', () => {
    expect(isQtyValidForUnit('2.5', 'KG')).toBe(true);
    expect(isQtyValidForUnit('2.5', 'PACK')).toBe(false);
    expect(isQtyValidForUnit('3', 'PACK')).toBe(true);
  });
  it('rejects zero unless allowed', () => {
    expect(isQtyValidForUnit('0', 'KG')).toBe(false);
    expect(isQtyValidForUnit('0', 'KG', { allowZero: true })).toBe(true);
  });
  it('rejects malformed input', () => {
    expect(isQtyValidForUnit('-1', 'KG')).toBe(false);
  });
});
