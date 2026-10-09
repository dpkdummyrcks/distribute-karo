/**
 * Dev seed: one distributor with the same data as the UI fixtures (packages/shared/seed/seed.json),
 * so the API returns what the prototypes showed. Usage: pnpm --filter @dk/api db:seed
 * Writes tenant rows through withTenant(), i.e. under row-level security.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { fromMilli, linePaise, toMilli } from '@dk/shared';
import { DbEnv, loadEnv } from '../env.js';
import { createDb, withTenant } from './client.js';
import type { Db } from './client.js';
import * as t from './schema.js';

interface SeedLine {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  ratePaise: number;
  requestedQty: string;
  acceptedQty: string | null;
  requestedPaise: number;
  acceptedPaise: number | null;
  lineNote: string | null;
}
interface SeedEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  note: string | null;
  createdAt: string;
}
interface SeedData {
  distributor: {
    id: string;
    publicSlug: string;
    phone: string;
    businessName: string;
    ownerName: string;
    email: string | null;
    address: string | null;
    gstin: string | null;
    createdAt: string;
  };
  items: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    ratePaise: number;
    stockQty: string;
    lowStockThreshold: string;
    category: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
  retailers: {
    id: string;
    name: string;
    shopName: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    location: { lat: number | null; lng: number | null; label: string | null } | null;
    isActive: boolean;
    source: string;
    createdAt: string;
    updatedAt: string;
  }[];
  accessRequests: {
    id: string;
    phone: string;
    name: string;
    shopName: string;
    address: string | null;
    locationLabel: string | null;
    status: string;
    retailerId: string | null;
    decisionNote: string | null;
    createdAt: string;
    decidedAt: string | null;
  }[];
  enquiries: { id: string; phone: string; name: string; message: string; status: string; createdAt: string }[];
  storefront: {
    tagline: string;
    ownerNote: string;
    highlights: unknown[];
    stats: unknown[];
    brands: string[];
    openingHours: unknown;
    sameDayCutoff: string;
    godown: { lat: number; lng: number; label: string };
    featuredItemIds: string[];
    published: boolean;
  };
  deliveryZones: {
    id: string;
    name: string;
    kind: string;
    center: { lat: number; lng: number };
    radiusM: number;
    sortOrder: number;
    isActive: boolean;
  }[];
  orders: {
    id: string;
    orderNo: number;
    status: string;
    retailerId: string;
    note: string | null;
    rejectionReason: string | null;
    newDevice: boolean;
    createdAt: string;
    updatedAt: string;
    decidedAt: string | null;
    lines: SeedLine[];
    events: SeedEvent[];
  }[];
}

export function loadSeed(): SeedData {
  const path = createRequire(import.meta.url).resolve('@dk/shared/seed.json');
  return JSON.parse(readFileSync(path, 'utf8')) as SeedData;
}

const SOLD = new Set(['ACCEPTED', 'PARTIALLY_ACCEPTED', 'DISPATCHED', 'DELIVERED']);
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Inserts the seed. Returns false (and changes nothing) if the distributor already exists. */
export async function seed(db: Db, password: string, data: SeedData = loadSeed()): Promise<boolean> {
  const d = data.distributor;
  const existing = await db.select({ id: t.distributors.id }).from(t.distributors).where(eq(t.distributors.id, d.id));
  if (existing.length > 0) return false;

  await db.insert(t.distributors).values({
    id: d.id,
    publicSlug: d.publicSlug,
    phone: d.phone,
    passwordHash: await hash(password, ARGON2),
    passwordChangedAt: d.createdAt,
    businessName: d.businessName,
    ownerName: d.ownerName,
    email: d.email,
    address: d.address,
    gstin: d.gstin,
    status: 'ACTIVE',
    orderSeq: Math.max(...data.orders.map((o) => o.orderNo)),
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
  });

  await withTenant(db, d.id, async (tx) => {
    await tx.insert(t.items).values(
      data.items.map((i) => ({
        id: i.id,
        distributorId: d.id,
        name: i.name,
        sku: i.sku,
        unit: i.unit,
        ratePaise: i.ratePaise,
        stockQty: i.stockQty,
        lowStockThreshold: i.lowStockThreshold,
        category: i.category,
        description: i.description,
        isActive: i.isActive,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    );
    await tx.insert(t.retailers).values(
      data.retailers.map((r) => ({
        id: r.id,
        distributorId: d.id,
        name: r.name,
        shopName: r.shopName,
        phone: r.phone,
        email: r.email,
        address: r.address,
        lat: r.location?.lat == null ? null : String(r.location.lat),
        lng: r.location?.lng == null ? null : String(r.location.lng),
        locationLabel: r.location?.label ?? null,
        isActive: r.isActive,
        source: r.source,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
    await tx.insert(t.accessRequests).values(
      data.accessRequests.map((a) => ({
        id: a.id,
        distributorId: d.id,
        phone: a.phone,
        name: a.name,
        shopName: a.shopName,
        address: a.address,
        locationLabel: a.locationLabel,
        status: a.status,
        retailerId: a.retailerId,
        decisionNote: a.decisionNote,
        decidedAt: a.decidedAt,
        createdAt: a.createdAt,
        updatedAt: a.decidedAt ?? a.createdAt,
      })),
    );
    await tx.insert(t.enquiries).values(
      data.enquiries.map((e) => ({
        id: e.id,
        distributorId: d.id,
        phone: e.phone,
        name: e.name,
        message: e.message,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      })),
    );
    const s = data.storefront;
    await tx.insert(t.storefronts).values({
      distributorId: d.id,
      tagline: s.tagline,
      ownerNote: s.ownerNote,
      highlights: s.highlights,
      stats: s.stats,
      brands: s.brands,
      openingHours: s.openingHours,
      sameDayCutoff: s.sameDayCutoff,
      godownLat: String(s.godown.lat),
      godownLng: String(s.godown.lng),
      godownLabel: s.godown.label,
      featuredItemIds: s.featuredItemIds,
      published: s.published,
    });
    await tx.insert(t.deliveryZones).values(
      data.deliveryZones.map((z) => ({
        id: z.id,
        distributorId: d.id,
        name: z.name,
        kind: z.kind,
        centerLat: String(z.center.lat),
        centerLng: String(z.center.lng),
        radiusM: z.radiusM,
        sortOrder: z.sortOrder,
        isActive: z.isActive,
      })),
    );

    for (const o of data.orders) {
      await tx.insert(t.orders).values({
        id: o.id,
        distributorId: d.id,
        retailerId: o.retailerId,
        orderNo: o.orderNo,
        status: o.status,
        note: o.note,
        rejectionReason: o.rejectionReason,
        totalRequestedPaise: o.lines.reduce((sum, l) => sum + l.requestedPaise, 0),
        totalAcceptedPaise: o.lines.every((l) => l.acceptedPaise !== null)
          ? o.lines.reduce((sum, l) => sum + (l.acceptedPaise ?? 0), 0)
          : null,
        idempotencyKey: `seed-${o.orderNo}`,
        requestHash: 'seed',
        newDevice: o.newDevice,
        decidedAt: o.decidedAt,
        dispatchedAt: o.events.find((e) => e.toStatus === 'DISPATCHED')?.createdAt ?? null,
        deliveredAt: o.events.find((e) => e.toStatus === 'DELIVERED')?.createdAt ?? null,
        cancelledAt: o.events.find((e) => e.toStatus === 'CANCELLED')?.createdAt ?? null,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      });
      await tx.insert(t.orderItems).values(
        o.lines.map((l) => ({
          id: l.id,
          distributorId: d.id,
          orderId: o.id,
          itemId: l.itemId,
          itemNameSnapshot: l.name,
          unitSnapshot: l.unit,
          ratePaiseSnapshot: l.ratePaise,
          requestedQty: l.requestedQty,
          acceptedQty: l.acceptedQty,
          requestedPaise: l.requestedPaise,
          acceptedPaise: l.acceptedPaise,
          lineNote: l.lineNote,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })),
      );
      await tx.insert(t.orderEvents).values(
        o.events.map((e) => ({
          id: e.id,
          distributorId: d.id,
          orderId: o.id,
          actorType: e.actorType,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          payload: e.note ? { note: e.note } : {},
          createdAt: e.createdAt,
          updatedAt: e.createdAt,
        })),
      );
    }

    // Stock ledger: OPENING (= final stock + everything sold in the seeded orders), then one SALE per accepted line.
    const sales = data.orders
      .filter((o) => SOLD.has(o.status) && o.decidedAt)
      .flatMap((o) =>
        o.lines.filter((l) => l.acceptedQty !== null && toMilli(l.acceptedQty) > 0).map((l) => ({ o, l })),
      )
      .sort((a, b) => (a.o.decidedAt ?? '').localeCompare(b.o.decidedAt ?? ''));
    const movements: (typeof t.stockMovements.$inferInsert)[] = [];
    for (const item of data.items) {
      const mine = sales.filter((s2) => s2.l.itemId === item.id);
      let balance = toMilli(item.stockQty) + mine.reduce((sum, s2) => sum + toMilli(s2.l.acceptedQty ?? '0'), 0);
      if (balance > 0) {
        movements.push({
          id: uuidv7(),
          distributorId: d.id,
          itemId: item.id,
          type: 'OPENING',
          deltaQty: fromMilli(balance),
          balanceAfter: fromMilli(balance),
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        });
      }
      for (const { o, l } of mine) {
        const accepted = toMilli(l.acceptedQty ?? '0');
        balance -= accepted;
        movements.push({
          id: uuidv7(),
          distributorId: d.id,
          itemId: item.id,
          type: 'SALE',
          deltaQty: fromMilli(-accepted),
          balanceAfter: fromMilli(balance),
          ratePaiseSnapshot: l.ratePaise,
          amountPaise: linePaise(l.ratePaise, accepted),
          orderId: o.id,
          orderItemId: l.id,
          createdAt: o.decidedAt ?? o.createdAt,
          updatedAt: o.decidedAt ?? o.createdAt,
        });
      }
    }
    if (movements.length) await tx.insert(t.stockMovements).values(movements);
  });
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv(DbEnv);
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');
  const { db, close } = createDb(env.DATABASE_MIGRATION_URL, { max: 1 });
  try {
    const created = await seed(db, process.env.SEED_DISTRIBUTOR_PASSWORD ?? 'balaji@1998');
    console.warn(created ? 'seeded Shree Balaji Traders (phone ••••5678)' : 'seed already present, nothing changed');
  } finally {
    await close();
  }
}
