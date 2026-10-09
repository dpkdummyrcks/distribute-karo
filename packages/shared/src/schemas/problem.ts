import { z } from 'zod';
import { ERROR_CODES } from '../errors.js';

/** One field/line problem; typed details (e.g. INSUFFICIENT_STOCK) ride along (LLD §2). */
export const ProblemErrorItem = z.strictObject({
  path: z.string(),
  message: z.string(),
  lineId: z.uuid().optional(),
  itemId: z.uuid().optional(),
  requested: z.string().optional(),
  accepted: z.string().optional(),
  available: z.string().optional(),
});

export const Problem = z.strictObject({
  type: z.url(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.enum(ERROR_CODES as [string, ...string[]]),
  detail: z.string().nullable(),
  errors: z.array(ProblemErrorItem).optional(),
  retryAfterSec: z.number().int().positive().optional(),
  traceId: z.string(),
});
export type Problem = z.infer<typeof Problem>;
