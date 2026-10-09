/** HTTP app factory. Dependencies come in as arguments so tests can build the app without a network. */
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import type { RequestIdVariables } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { problem } from './http/problem.js';

/** A readiness probe resolves when its dependency answers and rejects (or hangs) otherwise. */
export type ReadinessCheck = () => Promise<unknown>;

export interface AppDeps {
  readiness: Record<string, ReadinessCheck>;
  /** Per-check timeout for /readyz. */
  readyTimeoutMs?: number;
}

function withTimeout(p: Promise<unknown>, ms: number): Promise<unknown> {
  return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref())]);
}

export function createApp(deps: AppDeps) {
  const app = new Hono<{ Variables: RequestIdVariables }>();
  app.use(requestId());
  app.use(secureHeaders());

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.get('/readyz', async (c) => {
    const names = Object.keys(deps.readiness);
    const results = await Promise.allSettled(
      names.map((n) => withTimeout(deps.readiness[n]?.() ?? Promise.resolve(), deps.readyTimeoutMs ?? 2000)),
    );
    const checks = Object.fromEntries(names.map((n, i) => [n, results[i]?.status === 'fulfilled' ? 'ok' : 'fail']));
    const ready = Object.values(checks).every((v) => v === 'ok');
    c.header('cache-control', 'no-store');
    return c.json({ status: ready ? 'ready' : 'not_ready', checks }, ready ? 200 : 503);
  });

  app.notFound((c) => problem(c, 'NOT_FOUND'));
  app.onError((err, c) => {
    // Name + SQLSTATE only: driver messages can carry query params (phones, hashes).
    const code = (err.cause as { code?: unknown } | undefined)?.code;
    console.error(
      `[${c.get('requestId')}] unhandled ${c.req.method} ${c.req.routePath}: ${err.name}${typeof code === 'string' ? ` (${code})` : ''}`,
    );
    return problem(c, 'INTERNAL');
  });
  return app;
}
