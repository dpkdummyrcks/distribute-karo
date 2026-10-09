/**
 * Quantity & money maths (LLD §2.2). Quantities travel as decimal strings ("2.5");
 * internally they are integer milli-units so TS, Kotlin and SQL agree exactly.
 */
import type { Unit } from './units.js';
import { UNIT_RULES } from './units.js';

/** Unsigned decimal, ≤ 7 integer digits, ≤ 3 fraction digits. */
export const QTY_PATTERN = /^\d{1,7}(\.\d{1,3})?$/;
/** Same, optionally negative (stock adjustments). */
export const SIGNED_QTY_PATTERN = /^-?\d{1,7}(\.\d{1,3})?$/;

/** "2.5" → 2500. Throws on malformed input; validate with the patterns first. */
export function toMilli(qty: string): number {
  if (!SIGNED_QTY_PATTERN.test(qty)) throw new RangeError(`Invalid quantity: ${qty}`);
  const negative = qty.startsWith('-');
  const [whole = '0', frac = ''] = (negative ? qty.slice(1) : qty).split('.');
  const milli = Number(whole) * 1000 + Number(frac.padEnd(3, '0'));
  return negative ? -milli : milli;
}

/** 2500 → "2.5"; trailing zeros trimmed, integers have no dot. */
export function fromMilli(milli: number): string {
  if (!Number.isSafeInteger(milli)) throw new RangeError(`Invalid milli quantity: ${milli}`);
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return `${milli < 0 ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** Line amount in paise: round-half-up(ratePaise × qty). Uses BigInt so large values stay exact. */
export function linePaise(ratePaise: number, qtyMilli: number): number {
  const product = BigInt(ratePaise) * BigInt(qtyMilli);
  const half = 500n;
  const result = product >= 0n ? (product + half) / 1000n : -((-product + half) / 1000n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Line amount exceeds the safe integer range');
  }
  return Number(result);
}

/** Whether a quantity string is valid for a unit (format, > 0 unless allowed, decimal rule). */
export function isQtyValidForUnit(qty: string, unit: Unit, opts: { allowZero?: boolean } = {}): boolean {
  if (!QTY_PATTERN.test(qty)) return false;
  if (!UNIT_RULES[unit].allowsDecimal && qty.includes('.')) return false;
  return opts.allowZero === true || toMilli(qty) > 0;
}
