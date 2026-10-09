import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Brand so repository functions can demand a tenant-scoped transaction at the type level. */
declare const tenantBrand: unique symbol;
export type TenantTx = Tx & { readonly [tenantBrand]: true };

export function createDb(url: string, opts: { max?: number } = {}): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max: opts.max ?? 10, prepare: true, onnotice: () => undefined });
  return { db: drizzle(client, { schema, casing: 'snake_case' }), close: () => client.end({ timeout: 5 }) };
}

/**
 * Runs `fn` in a transaction scoped to one distributor: row-level security only lets it see
 * and write that distributor's rows (LLD §3). `set_config(..., true)` is transaction-local,
 * so it is safe with pooled connections (incl. PgBouncer transaction mode).
 */
export function withTenant<T>(db: Db, distributorId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.distributor_id', ${distributorId}, true)`);
    return fn(tx as TenantTx);
  });
}
