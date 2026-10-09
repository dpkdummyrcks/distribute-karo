import { z } from 'zod';
import { Id, Paise, Qty, SignedQty, Timestamp, UnitSchema, Url, nullableText, text } from './common.js';

export const StockStatus = z.enum(['IN_STOCK', 'LOW', 'OUT']);

export const Item = z.strictObject({
  id: Id,
  name: z.string(),
  sku: z.string().nullable(),
  unit: UnitSchema,
  ratePaise: Paise,
  stockQty: Qty,
  lowStockThreshold: Qty,
  stockStatus: StockStatus,
  category: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: Url.nullable(),
  isActive: z.boolean(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Item = z.infer<typeof Item>;

export const ItemInput = z.strictObject({
  name: text(1, 120),
  sku: nullableText(40).optional(),
  unit: UnitSchema,
  ratePaise: Paise,
  category: nullableText(40).optional(),
  description: nullableText(500).optional(),
  isActive: z.boolean().optional(),
  imageUploadId: Id.nullable().optional(),
  lowStockThreshold: Qty.optional(),
  openingStockQty: Qty.optional(),
});

export const StockMovementInput = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('RESTOCK'), qty: Qty, note: nullableText(500).optional() }),
  z.strictObject({ type: z.literal('ADJUSTMENT'), deltaQty: SignedQty, reason: text(3, 200) }),
]);

export const StockMovement = z.strictObject({
  id: Id,
  type: z.enum(['OPENING', 'RESTOCK', 'SALE', 'ADJUSTMENT']),
  deltaQty: SignedQty,
  balanceAfter: Qty,
  amountPaise: Paise.nullable(),
  order: z.strictObject({ id: Id, orderNo: z.number().int().positive(), retailerName: z.string() }).nullable(),
  reason: z.string().nullable(),
  createdAt: Timestamp,
});

export const StockReportRow = z.strictObject({
  item: z.strictObject({
    id: Id,
    name: z.string(),
    unit: UnitSchema,
    imageUrl: Url.nullable(),
    category: z.string().nullable(),
    stockStatus: StockStatus,
  }),
  soldQty: Qty,
  soldPaise: Paise,
  restockedQty: Qty,
  adjustedQty: SignedQty,
  remainingQty: Qty,
});

export const StockReport = z.strictObject({
  from: Timestamp,
  to: Timestamp,
  totals: z.strictObject({ soldPaise: Paise, itemsSold: z.number().int().min(0) }),
  data: z.array(StockReportRow),
  nextCursor: z.string().nullable(),
});

export const Categories = z.strictObject({ data: z.array(z.string()) });
