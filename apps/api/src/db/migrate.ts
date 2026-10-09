/** Applies pending migrations as dk_owner. Usage: pnpm --filter @dk/api db:migrate */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { DbEnv, loadEnv } from '../env.js';
import { createDb } from './client.js';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv(DbEnv);
  await runMigrations(env.DATABASE_MIGRATION_URL);
  console.warn('migrations applied');
}
