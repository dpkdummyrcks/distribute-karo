/** Environment validation (LLD §10): parse once at boot, fail fast with a readable list of problems. */
import { z } from 'zod';

const pgUrl = z.string().regex(/^postgres(ql)?:\/\//, 'Expected a postgres:// URL');

export const DbEnv = z.object({
  /** Runtime connection as dk_app (RLS applies). */
  DATABASE_URL: pgUrl,
  /** Migrations + seed as dk_owner. */
  DATABASE_MIGRATION_URL: pgUrl,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const ApiEnv = DbEnv.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  VALKEY_URL: z.string().regex(/^rediss?:\/\//, 'Expected a redis:// URL'),
  S3_ENDPOINT: z.url(),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  PUBLIC_BASE_URL: z.url(),
  JWT_PRIVATE_KEY: z.string().includes('PRIVATE KEY'),
  JWT_PUBLIC_KEY: z.string().includes('PUBLIC KEY'),
  HMAC_SECRET: z.string().min(32),
  TRUSTED_PROXIES: z.string().default('127.0.0.1/32'),
});

export function loadEnv<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv = process.env): z.infer<T> {
  const res = schema.safeParse(source);
  if (!res.success) {
    const lines = res.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return res.data;
}
