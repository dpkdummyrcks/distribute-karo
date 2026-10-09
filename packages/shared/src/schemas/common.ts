import { z } from 'zod';
import { QTY_PATTERN, SIGNED_QTY_PATTERN } from '../qty.js';
import { UNITS } from '../units.js';
import { ORDER_STATUSES } from '../orderMachine.js';

export const Id = z.uuid();
export const Timestamp = z.iso.datetime();
export const Url = z.url();
/** Indian mobile in E.164. */
export const PhoneE164 = z.string().regex(/^\+91[6-9]\d{9}$/, 'Expected an Indian mobile number in E.164');
export const Qty = z.string().regex(QTY_PATTERN, 'Expected a decimal quantity like "2.5"');
export const SignedQty = z.string().regex(SIGNED_QTY_PATTERN, 'Expected a decimal quantity like "-1.5"');
export const Paise = z.number().int().min(0).max(10_000_000_000);
export const UnitSchema = z.enum(UNITS);
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export const Gstin = z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN');
export const Email = z.email().max(254);

/** Trimmed bounded text. */
export const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const page = <T extends z.ZodType>(item: T) =>
  z.strictObject({ data: z.array(item), nextCursor: z.string().nullable() });

/** Cursor + limit query (LLD §2). */
export const PageQuery = z.strictObject({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
