/**
 * DB invariants against a throwaway PostgreSQL 18: RLS tenant isolation, stock = Σ movements,
 * CHECK constraints and append-only ledgers. Runs as dk_app, the runtime role.
 */
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, withTenant } from '../src/db/client.js';
import type { Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import * as t from '../src/db/schema.js';
import { loadSeed, seed } from '../src/db/seed.js';

const D1 = loadSeed().distributor.id;
const D2 = '0199c4e2-0002-7002-8002-000000000002';

let pg: StartedPostgreSqlContainer;
let app: { db: Db; close: () => Promise<void> };

/** Drizzle wraps driver errors; the SQLSTATE lives on `cause`. */
async function sqlState(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    const cause = e instanceof Error ? (e.cause as { code?: string } | undefined) : undefined;
    return cause?.code;
  }
}

function urlFor(user: string, password: string): string {
  return `postgres://${user}:${password}@${pg.getHost()}:${pg.getPort()}/${pg.getDatabase()}`;
}

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:18-alpine').start();
  const su = postgres(pg.getConnectionUri(), { max: 1, onnotice: () => undefined });
  await su.unsafe(`
    CREATE ROLE dk_owner LOGIN PASSWORD 'owner';
    CREATE ROLE dk_app LOGIN PASSWORD 'app' NOBYPASSRLS;
    ALTER DATABASE ${pg.getDatabase()} OWNER TO dk_owner;
    ALTER SCHEMA public OWNER TO dk_owner;
    GRANT USAGE ON SCHEMA public TO dk_app;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  `);
  await su.end();

  const ownerUrl = urlFor('dk_owner', 'owner');
  await runMigrations(ownerUrl);
  const owner = createDb(ownerUrl, { max: 1 });
  await seed(owner.db, 'test-password');
  await owner.db.insert(t.distributors).values({
    id: D2,
    publicSlug: 'other-traders',
    phone: '+919000000002',
    passwordHash: 'x',
    passwordChangedAt: new Date().toISOString(),
    businessName: 'Other Traders',
    ownerName: 'Other',
    status: 'ACTIVE',
  });
  await withTenant(owner.db, D2, (tx) =>
    tx
      .insert(t.items)
      .values({
        id: '0199c4e2-0002-7002-8002-0000000000a1',
        distributorId: D2,
        name: 'Other item',
        unit: 'PCS',
        ratePaise: 100,
        stockQty: '1',
      })
      .then(() => undefined),
  );
  await owner.close();

  app = createDb(urlFor('dk_app', 'app'), { max: 2 });
}, 120_000);

afterAll(async () => {
  await app?.close();
  await pg?.stop();
});

describe('row-level security', () => {
  it('shows nothing when no tenant is set', async () => {
    expect(await app.db.select().from(t.items)).toHaveLength(0);
  });

  it('shows only the current tenant rows', async () => {
    const d1 = await withTenant(app.db, D1, (tx) => tx.select().from(t.items));
    expect(d1).toHaveLength(20);
    expect(d1.every((i) => i.distributorId === D1)).toBe(true);
    const d2 = await withTenant(app.db, D2, (tx) => tx.select().from(t.items));
    expect(d2.map((i) => i.name)).toEqual(['Other item']);
  });

  it('rejects writes for another tenant', async () => {
    // 42501 = new row violates row-level security policy
    expect(
      await sqlState(
        withTenant(app.db, D1, (tx) =>
          tx
            .insert(t.items)
            .values({ id: uuidv7(), distributorId: D2, name: 'Sneaky', unit: 'PCS', ratePaise: 1, stockQty: '0' }),
        ),
      ),
    ).toBe('42501');
  });

  it('cannot update rows of another tenant', async () => {
    const updated = await withTenant(app.db, D1, (tx) =>
      tx
        .update(t.items)
        .set({ ratePaise: 1 })
        .where(sql`${t.items.distributorId} = ${D2}`)
        .returning(),
    );
    expect(updated).toHaveLength(0);
  });
});

describe('stock ledger', () => {
  it('keeps stock_qty equal to the sum of movements', async () => {
    const rows = await withTenant(app.db, D1, (tx) =>
      tx.execute<{ n: number }>(
        sql`select count(*)::int as n from items i where i.stock_qty <> coalesce((select sum(m.delta_qty) from stock_movements m where m.item_id = i.id), 0)`,
      ),
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('rejects negative stock', async () => {
    expect(await sqlState(withTenant(app.db, D1, (tx) => tx.update(t.items).set({ stockQty: '-1' })))).toBe('23514');
  });

  it('is append-only for the runtime role', async () => {
    expect(await sqlState(withTenant(app.db, D1, (tx) => tx.update(t.stockMovements).set({ deltaQty: '0' })))).toBe(
      '42501',
    );
    expect(await sqlState(withTenant(app.db, D1, (tx) => tx.delete(t.orderEvents)))).toBe('42501');
  });
});

describe('order constraints', () => {
  it('rejects accepted quantity above requested', async () => {
    expect(
      await sqlState(
        withTenant(app.db, D1, (tx) =>
          tx.update(t.orderItems).set({ acceptedQty: sql`${t.orderItems.requestedQty} + 1` }),
        ),
      ),
    ).toBe('23514');
  });
});
