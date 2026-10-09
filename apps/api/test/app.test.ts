import { Problem } from '@dk/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  it('/healthz answers without touching dependencies', async () => {
    const app = createApp({ readiness: { db: () => Promise.reject(new Error('down')) } });
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('/readyz is 200 when every check passes', async () => {
    const app = createApp({ readiness: { db: () => Promise.resolve() } });
    const res = await app.request('/readyz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ready', checks: { db: 'ok' } });
  });

  it('/readyz is 503 on a failing or hanging check and hides the error', async () => {
    const app = createApp({
      readiness: {
        db: () => Promise.reject(new Error('password authentication failed')),
        cache: () => new Promise(() => undefined),
      },
      readyTimeoutMs: 20,
    });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: 'not_ready', checks: { db: 'fail', cache: 'fail' } });
    expect(text).not.toContain('password');
  });
});

describe('errors', () => {
  it('unknown routes return a valid problem+json', async () => {
    const res = await createApp({ readiness: {} }).request('/nope', { headers: { 'x-request-id': 'trace-1' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    const body = Problem.parse(await res.json());
    expect(body).toMatchObject({ code: 'NOT_FOUND', status: 404, traceId: 'trace-1' });
  });
});
