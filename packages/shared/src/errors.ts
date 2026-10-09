/** Stable error codes shared by API and clients (LLD §2.3). */
export const ERROR_STATUS = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 429,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLUG_INVALID: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  INSUFFICIENT_STOCK: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  PHONE_ALREADY_EXISTS: 409,
  REQUEST_ALREADY_PENDING: 409,
  ITEM_UNAVAILABLE: 422,
  WEAK_PASSWORD: 422,
  RATE_LIMITED: 429,
  UPLOAD_INVALID: 422,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;
export const ERROR_CODES = Object.keys(ERROR_STATUS) as ErrorCode[];

/** RFC 9457 `type` URI for a code. */
export function problemType(code: ErrorCode): string {
  return `https://distributekaro.in/problems/${code.toLowerCase().replaceAll('_', '-')}`;
}
