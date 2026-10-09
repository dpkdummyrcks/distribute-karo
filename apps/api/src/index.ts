/** API entry point: validate env, connect, serve, shut down cleanly. */
import { serve } from '@hono/node-server';
import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { createDb } from './db/client.js';
import { ApiEnv, loadEnv } from './env.js';

const env = loadEnv(ApiEnv);
const { db, close } = createDb(env.DATABASE_URL);

const app = createApp({ readiness: { db: () => db.execute(sql`select 1`) } });
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  console.warn(`dk-api listening on :${info.port} (${env.NODE_ENV})`),
);

function shutdown(signal: string): void {
  console.warn(`${signal} received, shutting down`);
  server.close(() => void close().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
