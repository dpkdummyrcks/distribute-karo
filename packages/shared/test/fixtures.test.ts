/**
 * Contract check: every fixture (= frozen API contract v0) must parse with its schema.
 * A new fixture file without a mapping fails the "all mapped" test.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import * as S from '../src/index.js';

const dir = new URL('../fixtures/', import.meta.url);
const MAP: Record<string, z.ZodType> = {
  'access-requests.page': S.page(S.AccessRequest),
  catalog: S.Catalog,
  categories: S.Categories,
  dashboard: S.Dashboard,
  'dashboard.new-account': S.Dashboard,
  'delivery-zones.page': S.page(S.DeliveryZoneAdmin),
  'distributor-me': S.DistributorMe,
  'distributor-me.onboarding': S.DistributorMe,
  'distributor-session': S.DistributorSession,
  'empty.page': S.page(S.Item),
  'enquiries.page': S.page(S.Enquiry),
  'identify.authenticated': S.IdentifyResult,
  'identify.not-registered': S.IdentifyResult,
  'identify.not-registered-pending': S.IdentifyResult,
  'inbox-counts': S.InboxCounts,
  item: S.Item,
  'items.page': S.page(S.Item),
  'order-detail.accepted': S.OrderDetail,
  'order-detail.cancelled': S.OrderDetail,
  'order-detail.delivered': S.OrderDetail,
  'order-detail.dispatched': S.OrderDetail,
  'order-detail.partial': S.OrderDetail,
  'order-detail.pending': S.OrderDetail,
  'order-detail.rejected': S.OrderDetail,
  'orders.page': S.page(S.OrderSummary),
  'public-catalog.page': S.page(S.PublicCatalogItem),
  'public-distributor': S.PublicDistributor,
  retailer: S.Retailer,
  'retailer-order-detail': S.OrderDetail,
  'retailer-orders.page': S.page(S.OrderSummary),
  'retailers.page': S.page(S.Retailer),
  'stock-movements.page': S.page(S.StockMovement),
  'stock-report': S.StockReport,
  storefront: S.Storefront,
  'storefront-admin': S.StorefrontAdmin,
  'storefront.minimal': S.Storefront,
  'storefront.signed-in': S.Storefront,
};
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));
const load = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));

describe('fixtures match schemas (contract v0)', () => {
  it('every fixture is mapped to a schema', () => {
    const unmapped = files.filter((f) => !(f in MAP) && !f.startsWith('problem.') && f !== 'qty-money-vectors');
    expect(unmapped).toEqual([]);
  });

  it.each(Object.entries(MAP))('%s', (name, schema) => {
    const res = schema.safeParse(load(name));
    expect(res.success ? 'ok' : JSON.stringify(res.error.issues.slice(0, 3), null, 2)).toBe('ok');
  });

  it.each(files.filter((f) => f.startsWith('problem.')))('%s', (name) => {
    const res = S.Problem.safeParse(load(name));
    expect(res.success ? 'ok' : JSON.stringify(res.error.issues.slice(0, 3), null, 2)).toBe('ok');
    if (res.success) {
      expect(res.data.status).toBe(S.ERROR_STATUS[res.data.code as S.ErrorCode]);
      expect(res.data.type).toBe(S.problemType(res.data.code as S.ErrorCode));
    }
  });
});

describe('privacy invariants', () => {
  const publicFiles = [
    'storefront',
    'storefront.minimal',
    'storefront.signed-in',
    'public-catalog.page',
    'public-distributor',
  ];
  it.each(publicFiles)('%s exposes no price or stock keys', (name) => {
    const keys = JSON.stringify(load(name)).match(/"(\w+)":/g) ?? [];
    expect(keys.filter((k) => /ratePaise|stock|Stock/.test(k))).toEqual([]);
  });
  it.each(['catalog', 'retailer-order-detail', 'retailer-orders.page'])(
    '%s (retailer) exposes no stock keys',
    (name) => {
      const keys = JSON.stringify(load(name)).match(/"(\w+)":/g) ?? [];
      expect(keys.filter((k) => /stock|Stock/.test(k))).toEqual([]);
    },
  );
});

describe('input schemas', () => {
  it('PlaceOrderInput rejects client prices and duplicate items', () => {
    const id = '0199c4e2-0001-7001-8001-000000000001';
    expect(S.PlaceOrderInput.safeParse({ lines: [{ itemId: id, qty: '2', ratePaise: 1 }] }).success).toBe(false);
    expect(
      S.PlaceOrderInput.safeParse({
        lines: [
          { itemId: id, qty: '2' },
          { itemId: id, qty: '1' },
        ],
      }).success,
    ).toBe(false);
    expect(S.PlaceOrderInput.safeParse({ lines: [{ itemId: id, qty: '2.5' }], note: 'before 5 PM' }).success).toBe(
      true,
    );
  });
  it('honeypot must stay empty', () => {
    const base = { phone: '+919828077777', name: 'Deepak', shopName: 'Saini Kirana' };
    expect(S.AccessRequestInput.safeParse({ ...base, website: '' }).success).toBe(true);
    expect(S.AccessRequestInput.safeParse({ ...base, website: 'http://spam' }).success).toBe(false);
  });
  it('DecisionInput variants', () => {
    expect(S.DecisionInput.safeParse({ decision: 'ACCEPT_ALL' }).success).toBe(true);
    expect(S.DecisionInput.safeParse({ decision: 'REJECT' }).success).toBe(false);
    expect(
      S.DecisionInput.safeParse({
        decision: 'PARTIAL',
        lines: [{ lineId: '0199c4e2-0001-7001-8001-000000000001', acceptedQty: '6.5' }],
      }).success,
    ).toBe(true);
  });
  it('StockMovementInput variants', () => {
    expect(S.StockMovementInput.safeParse({ type: 'RESTOCK', qty: '60' }).success).toBe(true);
    expect(S.StockMovementInput.safeParse({ type: 'ADJUSTMENT', deltaQty: '-1.5', reason: 'Damaged' }).success).toBe(
      true,
    );
    expect(S.StockMovementInput.safeParse({ type: 'ADJUSTMENT', deltaQty: '-1.5' }).success).toBe(false);
  });
  it('PresignInput caps size and type', () => {
    expect(
      S.PresignInput.safeParse({ purpose: 'LOGO', contentType: 'image/png', contentLength: 2 * 1024 * 1024 + 1 })
        .success,
    ).toBe(false);
    expect(S.PresignInput.safeParse({ purpose: 'LOGO', contentType: 'image/gif', contentLength: 10 }).success).toBe(
      false,
    );
  });
});
