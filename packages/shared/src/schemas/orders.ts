import { z } from 'zod';
import { Id, OrderStatusSchema, Paise, Qty, Timestamp, UnitSchema, nullableText, text } from './common.js';

export const OrderSummary = z.strictObject({
  id: Id,
  orderNo: z.number().int().positive(),
  status: OrderStatusSchema,
  retailer: z
    .strictObject({ id: Id, name: z.string(), shopName: z.string().nullable(), locationLabel: z.string().nullable() })
    .optional(),
  distributor: z.strictObject({ businessName: z.string() }).optional(),
  lineCount: z.number().int().positive(),
  totalRequestedPaise: Paise,
  totalAcceptedPaise: Paise.nullable(),
  newDevice: z.boolean().optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

export const OrderLine = z.strictObject({
  id: Id,
  itemId: Id,
  name: z.string(),
  unit: UnitSchema,
  ratePaise: Paise,
  requestedQty: Qty,
  acceptedQty: Qty.nullable(),
  requestedPaise: Paise,
  acceptedPaise: Paise.nullable(),
  lineNote: z.string().nullable(),
  availableStockQty: Qty.optional(),
});

export const OrderEvent = z.strictObject({
  id: Id,
  fromStatus: OrderStatusSchema.nullable(),
  toStatus: OrderStatusSchema,
  actorType: z.enum(['DISTRIBUTOR', 'RETAILER', 'SYSTEM']),
  note: z.string().nullable(),
  createdAt: Timestamp,
});

export const OrderDetail = z.strictObject({
  ...OrderSummary.shape,
  note: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  lines: z.array(OrderLine).min(1),
  events: z.array(OrderEvent).min(1),
  allowedActions: z.array(z.enum(['ACCEPT', 'REJECT', 'DISPATCH', 'DELIVER', 'CANCEL'])),
});

export const DecisionInput = z.discriminatedUnion('decision', [
  z.strictObject({ decision: z.literal('ACCEPT_ALL') }),
  z.strictObject({
    decision: z.literal('PARTIAL'),
    lines: z
      .array(z.strictObject({ lineId: Id, acceptedQty: Qty, lineNote: nullableText(500).optional() }))
      .min(1)
      .max(100),
  }),
  z.strictObject({ decision: z.literal('REJECT'), reason: text(1, 500) }),
]);

export const StatusInput = z.strictObject({
  to: z.enum(['DISPATCHED', 'DELIVERED']),
  note: nullableText(500).optional(),
});

export const PlaceOrderInput = z
  .strictObject({
    lines: z
      .array(z.strictObject({ itemId: Id, qty: Qty }))
      .min(1)
      .max(100),
    note: nullableText(500).optional(),
  })
  .refine((v) => new Set(v.lines.map((l) => l.itemId)).size === v.lines.length, {
    message: 'Each item may appear once',
    path: ['lines'],
  });
