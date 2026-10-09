/** RFC 9457 problem+json responses (LLD §2). Every error leaves the API in this shape. */
import { ERROR_STATUS, problemType } from '@dk/shared';
import type { ErrorCode, Problem } from '@dk/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const TITLES: Partial<Record<ErrorCode, string>> = {
  NOT_FOUND: 'Not found',
  INTERNAL: 'Something went wrong',
};

export function problem(
  c: Context,
  code: ErrorCode,
  extra: Partial<Pick<Problem, 'detail' | 'errors' | 'retryAfterSec'>> = {},
): Response {
  const status = ERROR_STATUS[code];
  const body: Problem = {
    type: problemType(code),
    title: TITLES[code] ?? code,
    status,
    code,
    detail: extra.detail ?? null,
    ...(extra.errors ? { errors: extra.errors } : {}),
    ...(extra.retryAfterSec ? { retryAfterSec: extra.retryAfterSec } : {}),
    traceId: c.get('requestId'),
  };
  return c.body(JSON.stringify(body), status as ContentfulStatusCode, { 'content-type': 'application/problem+json' });
}
