/**
 * Database schema (LLD §3). Every tenant table carries `distributor_id`; row-level security,
 * grants, triggers and the trigram index live in the hand-written `rls` migration.
 * Money = bigint paise, quantities = numeric(12,3) (ADR-011).
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { ORDER_STATUSES, UNITS } from '@dk/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });
const timestamps = {
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
};
const qty = (name: string) => numeric(name, { precision: 12, scale: 3 });
const coord = (name: string) => numeric(name, { precision: 9, scale: 6 });
const paise = (name: string) => bigint(name, { mode: 'number' });
const inList = (col: string, values: readonly string[]) =>
  sql.raw(`${col} IN (${values.map((v) => `'${v}'`).join(', ')})`);

export const distributors = pgTable(
  'distributors',
  {
    id: uuid().primaryKey(),
    publicSlug: text().notNull().unique(),
    phone: text().notNull().unique(),
    passwordHash: text().notNull(),
    passwordChangedAt: ts('password_changed_at').notNull(),
    businessName: text(),
    ownerName: text(),
    email: text(),
    address: text(),
    gstin: text(),
    logoKey: text(),
    status: text().notNull(),
    orderSeq: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check('distributors_status_check', inList('status', ['ONBOARDING', 'ACTIVE', 'SUSPENDED'])),
    check('distributors_order_seq_check', sql`${t.orderSeq} >= 0`),
  ],
);

export const passwordResetCodes = pgTable('password_reset_codes', {
  id: uuid().primaryKey(),
  distributorId: uuid()
    .notNull()
    .references(() => distributors.id),
  codeHash: text().notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  ...timestamps,
});

export const items = pgTable(
  'items',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    name: text().notNull(),
    sku: text(),
    unit: text().notNull(),
    ratePaise: paise('rate_paise').notNull(),
    stockQty: qty('stock_qty').notNull().default('0'),
    lowStockThreshold: qty('low_stock_threshold').notNull().default('0'),
    category: text(),
    description: text(),
    imageKey: text(),
    isActive: boolean().notNull().default(true),
    deletedAt: ts('deleted_at'),
    ...timestamps,
  },
  (t) => [
    check('items_unit_check', inList('unit', UNITS)),
    check('items_rate_check', sql`${t.ratePaise} >= 0`),
    check('items_stock_check', sql`${t.stockQty} >= 0`),
    check('items_threshold_check', sql`${t.lowStockThreshold} >= 0`),
    index('items_active_idx')
      .on(t.distributorId, t.isActive)
      .where(sql`${t.deletedAt} IS NULL`),
    uniqueIndex('items_sku_uq')
      .on(t.distributorId, t.sku)
      .where(sql`${t.sku} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

export const retailers = pgTable(
  'retailers',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    name: text().notNull(),
    shopName: text(),
    phone: text().notNull(),
    email: text(),
    address: text(),
    shopPhotoKey: text(),
    lat: coord('lat'),
    lng: coord('lng'),
    locationLabel: text(),
    isActive: boolean().notNull().default(true),
    source: text().notNull().default('MANUAL'),
    ...timestamps,
  },
  (t) => [
    check('retailers_source_check', inList('source', ['MANUAL', 'ACCESS_REQUEST'])),
    uniqueIndex('retailers_phone_uq').on(t.distributorId, t.phone),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    retailerId: uuid()
      .notNull()
      .references(() => retailers.id),
    orderNo: integer().notNull(),
    status: text().notNull(),
    note: text(),
    rejectionReason: text(),
    totalRequestedPaise: paise('total_requested_paise').notNull(),
    totalAcceptedPaise: paise('total_accepted_paise'),
    idempotencyKey: text().notNull(),
    requestHash: text().notNull(),
    sessionId: uuid(),
    newDevice: boolean().notNull().default(false),
    decidedAt: ts('decided_at'),
    dispatchedAt: ts('dispatched_at'),
    deliveredAt: ts('delivered_at'),
    cancelledAt: ts('cancelled_at'),
    ...timestamps,
  },
  (t) => [
    check('orders_status_check', inList('status', ORDER_STATUSES)),
    uniqueIndex('orders_no_uq').on(t.distributorId, t.orderNo),
    uniqueIndex('orders_idem_uq').on(t.retailerId, t.idempotencyKey),
    index('orders_inbox_idx').on(t.distributorId, t.status, t.createdAt.desc(), t.id),
    index('orders_retailer_idx').on(t.retailerId, t.createdAt.desc(), t.id),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    itemId: uuid()
      .notNull()
      .references(() => items.id),
    itemNameSnapshot: text().notNull(),
    unitSnapshot: text().notNull(),
    ratePaiseSnapshot: paise('rate_paise_snapshot').notNull(),
    requestedQty: qty('requested_qty').notNull(),
    acceptedQty: qty('accepted_qty'),
    requestedPaise: paise('requested_paise').notNull(),
    acceptedPaise: paise('accepted_paise'),
    lineNote: text(),
    ...timestamps,
  },
  (t) => [
    check('order_items_requested_check', sql`${t.requestedQty} > 0`),
    check('order_items_accepted_check', sql`${t.acceptedQty} >= 0 AND ${t.acceptedQty} <= ${t.requestedQty}`),
    index('order_items_order_idx').on(t.orderId),
  ],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    actorType: text().notNull(),
    actorId: uuid(),
    fromStatus: text(),
    toStatus: text().notNull(),
    payload: jsonb().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    check('order_events_actor_check', inList('actor_type', ['DISTRIBUTOR', 'RETAILER', 'SYSTEM'])),
    index('order_events_order_idx').on(t.orderId, t.createdAt),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    itemId: uuid()
      .notNull()
      .references(() => items.id),
    type: text().notNull(),
    deltaQty: qty('delta_qty').notNull(),
    balanceAfter: qty('balance_after').notNull(),
    ratePaiseSnapshot: paise('rate_paise_snapshot'),
    amountPaise: paise('amount_paise'),
    orderId: uuid().references(() => orders.id),
    orderItemId: uuid()
      .unique()
      .references(() => orderItems.id),
    reason: text(),
    actorId: uuid(),
    ...timestamps,
  },
  (t) => [
    check('stock_movements_type_check', inList('type', ['OPENING', 'RESTOCK', 'SALE', 'ADJUSTMENT'])),
    check('stock_movements_delta_check', sql`${t.deltaQty} <> 0`),
    check('stock_movements_balance_check', sql`${t.balanceAfter} >= 0`),
    check('stock_movements_reason_check', sql`${t.type} <> 'ADJUSTMENT' OR length(${t.reason}) >= 3`),
    index('stock_movements_item_idx').on(t.distributorId, t.itemId, t.createdAt.desc()),
    index('stock_movements_report_idx').on(t.distributorId, t.type, t.createdAt),
  ],
);

export const storefronts = pgTable('storefronts', {
  distributorId: uuid()
    .primaryKey()
    .references(() => distributors.id),
  tagline: text(),
  ownerNote: text(),
  coverKey: text(),
  highlights: jsonb().notNull().default([]),
  stats: jsonb().notNull().default([]),
  brands: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  openingHours: jsonb(),
  sameDayCutoff: time(),
  godownLat: coord('godown_lat'),
  godownLng: coord('godown_lng'),
  godownLabel: text(),
  featuredItemIds: uuid()
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  published: boolean().notNull().default(true),
  ...timestamps,
});

export const deliveryZones = pgTable(
  'delivery_zones',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    name: text().notNull(),
    kind: text().notNull().default('CIRCLE'),
    centerLat: coord('center_lat').notNull(),
    centerLng: coord('center_lng').notNull(),
    radiusM: integer(),
    polygon: jsonb(),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check('delivery_zones_kind_check', inList('kind', ['CIRCLE', 'POLYGON'])),
    check('delivery_zones_radius_check', sql`${t.radiusM} BETWEEN 500 AND 10000`),
    index('delivery_zones_idx').on(t.distributorId, t.sortOrder),
  ],
);

export const accessRequests = pgTable(
  'access_requests',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    phone: text().notNull(),
    name: text().notNull(),
    shopName: text().notNull(),
    address: text(),
    locationLabel: text(),
    status: text().notNull(),
    retailerId: uuid().references(() => retailers.id),
    decidedAt: ts('decided_at'),
    decisionNote: text(),
    ...timestamps,
  },
  (t) => [
    check('access_requests_status_check', inList('status', ['PENDING', 'APPROVED', 'REJECTED'])),
    uniqueIndex('access_requests_pending_uq')
      .on(t.distributorId, t.phone)
      .where(sql`${t.status} = 'PENDING'`),
    index('access_requests_idx').on(t.distributorId, t.status, t.createdAt.desc()),
  ],
);

export const enquiries = pgTable(
  'enquiries',
  {
    id: uuid().primaryKey(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    phone: text().notNull(),
    name: text().notNull(),
    message: text().notNull(),
    status: text().notNull(),
    ...timestamps,
  },
  (t) => [
    check('enquiries_status_check', inList('status', ['NEW', 'READ', 'CLOSED'])),
    index('enquiries_idx').on(t.distributorId, t.status, t.createdAt.desc()),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey(),
    subjectType: text().notNull(),
    subjectId: uuid().notNull(),
    distributorId: uuid()
      .notNull()
      .references(() => distributors.id),
    refreshTokenHash: text().notNull(),
    generation: integer().notNull().default(0),
    deviceFingerprint: text(),
    deviceInfo: text(),
    ip: inet(),
    lastUsedAt: ts('last_used_at'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    revokeReason: text(),
    ...timestamps,
  },
  (t) => [
    check('sessions_subject_check', inList('subject_type', ['DISTRIBUTOR', 'RETAILER'])),
    index('sessions_subject_idx')
      .on(t.subjectType, t.subjectId)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

/** Tables protected by row-level security (keep in sync with the rls migration). */
export const TENANT_TABLES = [
  'items',
  'stock_movements',
  'storefronts',
  'delivery_zones',
  'retailers',
  'access_requests',
  'enquiries',
  'orders',
  'order_items',
  'order_events',
] as const;
