/** Order state machine (LLD §5). The API enforces it; clients read `allowedActions` from the DTO. */
export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PARTIALLY_ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'DISPATCHED',
  'DELIVERED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Actor = 'DISTRIBUTOR' | 'RETAILER' | 'SYSTEM';
export type OrderAction = 'ACCEPT' | 'REJECT' | 'DISPATCH' | 'DELIVER' | 'CANCEL';

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  actor: Actor;
}

export const TRANSITIONS: readonly Transition[] = [
  { from: 'PENDING', to: 'ACCEPTED', actor: 'DISTRIBUTOR' },
  { from: 'PENDING', to: 'PARTIALLY_ACCEPTED', actor: 'DISTRIBUTOR' },
  { from: 'PENDING', to: 'REJECTED', actor: 'DISTRIBUTOR' },
  { from: 'PENDING', to: 'CANCELLED', actor: 'RETAILER' },
  { from: 'ACCEPTED', to: 'DISPATCHED', actor: 'DISTRIBUTOR' },
  { from: 'PARTIALLY_ACCEPTED', to: 'DISPATCHED', actor: 'DISTRIBUTOR' },
  { from: 'DISPATCHED', to: 'DELIVERED', actor: 'DISTRIBUTOR' },
];

export function canTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.actor === actor);
}

/** Buttons a given actor may show for an order in `status`. */
export function allowedActions(status: OrderStatus, actor: Exclude<Actor, 'SYSTEM'>): OrderAction[] {
  if (actor === 'RETAILER') return status === 'PENDING' ? ['CANCEL'] : [];
  switch (status) {
    case 'PENDING':
      return ['ACCEPT', 'REJECT'];
    case 'ACCEPTED':
    case 'PARTIALLY_ACCEPTED':
      return ['DISPATCH'];
    case 'DISPATCHED':
      return ['DELIVER'];
    default:
      return [];
  }
}

/** Which "decided" status a set of accepted quantities produces. Throws if nothing is accepted (use REJECT). */
export function decisionStatus(
  lines: readonly { requestedMilli: number; acceptedMilli: number }[],
): 'ACCEPTED' | 'PARTIALLY_ACCEPTED' {
  if (lines.length === 0) throw new RangeError('An order needs at least one line');
  for (const l of lines) {
    if (l.acceptedMilli < 0 || l.acceptedMilli > l.requestedMilli)
      throw new RangeError('Accepted quantity out of range');
  }
  if (lines.every((l) => l.acceptedMilli === 0)) throw new RangeError('Nothing accepted: reject the order instead');
  return lines.every((l) => l.acceptedMilli === l.requestedMilli) ? 'ACCEPTED' : 'PARTIALLY_ACCEPTED';
}
