import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, allowedActions, canTransition, decisionStatus } from '../src/index.js';
import type { Actor, OrderStatus } from '../src/index.js';

const ALLOWED = new Set([
  'PENDING>ACCEPTED>DISTRIBUTOR',
  'PENDING>PARTIALLY_ACCEPTED>DISTRIBUTOR',
  'PENDING>REJECTED>DISTRIBUTOR',
  'PENDING>CANCELLED>RETAILER',
  'ACCEPTED>DISPATCHED>DISTRIBUTOR',
  'PARTIALLY_ACCEPTED>DISPATCHED>DISTRIBUTOR',
  'DISPATCHED>DELIVERED>DISTRIBUTOR',
]);
const ACTORS: Actor[] = ['DISTRIBUTOR', 'RETAILER', 'SYSTEM'];

describe('canTransition: every (from, to, actor)', () => {
  const cases = ORDER_STATUSES.flatMap((from) =>
    ORDER_STATUSES.flatMap((to) => ACTORS.map((actor) => [from, to, actor] as const)),
  );
  it.each(cases)('%s → %s by %s', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(ALLOWED.has(`${from}>${to}>${actor}`));
  });
});

describe('allowedActions', () => {
  const expected: Record<OrderStatus, string[]> = {
    PENDING: ['ACCEPT', 'REJECT'],
    ACCEPTED: ['DISPATCH'],
    PARTIALLY_ACCEPTED: ['DISPATCH'],
    DISPATCHED: ['DELIVER'],
    DELIVERED: [],
    REJECTED: [],
    CANCELLED: [],
  };
  it.each(ORDER_STATUSES)('distributor · %s', (s) => expect(allowedActions(s, 'DISTRIBUTOR')).toEqual(expected[s]));
  it.each(ORDER_STATUSES)('retailer · %s', (s) =>
    expect(allowedActions(s, 'RETAILER')).toEqual(s === 'PENDING' ? ['CANCEL'] : []),
  );
});

describe('decisionStatus', () => {
  it('all lines full → ACCEPTED', () => {
    expect(decisionStatus([{ requestedMilli: 5000, acceptedMilli: 5000 }])).toBe('ACCEPTED');
  });
  it('any line short → PARTIALLY_ACCEPTED', () => {
    expect(
      decisionStatus([
        { requestedMilli: 50_000, acceptedMilli: 6500 },
        { requestedMilli: 1000, acceptedMilli: 1000 },
      ]),
    ).toBe('PARTIALLY_ACCEPTED');
  });
  it('nothing accepted → must reject', () => {
    expect(() => decisionStatus([{ requestedMilli: 1000, acceptedMilli: 0 }])).toThrow(/reject/);
  });
  it('rejects out-of-range and empty input', () => {
    expect(() => decisionStatus([{ requestedMilli: 1000, acceptedMilli: 1500 }])).toThrow(RangeError);
    expect(() => decisionStatus([{ requestedMilli: 1000, acceptedMilli: -1 }])).toThrow(RangeError);
    expect(() => decisionStatus([])).toThrow(RangeError);
  });
});
