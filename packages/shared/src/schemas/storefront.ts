import { z } from 'zod';
import { Id, PhoneE164, Timestamp, UnitSchema, Url, nullableText, text } from './common.js';

export const PublicDistributor = z.strictObject({ businessName: z.string(), logoUrl: Url.nullable() });

export const Highlight = z.strictObject({
  icon: z.enum(['truck', 'credit', 'tag', 'box', 'clock', 'star', 'shield', 'phone']),
  title: text(1, 30),
  text: nullableText(80),
});
const Hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const OpeningHours = z.strictObject({
  days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  open: Hhmm,
  close: Hhmm,
});
const LatLng = { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) };
export const Stat = z.strictObject({ value: text(1, 8), label: text(1, 24) });

export const DeliveryZone = z.strictObject({
  id: Id,
  name: z.string(),
  kind: z.literal('CIRCLE'),
  center: z.strictObject(LatLng),
  radiusM: z.number().int().min(500).max(10_000),
});
export const DeliveryZoneAdmin = z.strictObject({
  ...DeliveryZone.shape,
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});
export const DeliveryZoneInput = z.strictObject({
  name: text(1, 40),
  center: z.strictObject(LatLng),
  radiusM: z.number().int().min(500).max(10_000),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const PublicCatalogItem = z.strictObject({
  id: Id,
  name: z.string(),
  unit: UnitSchema,
  category: z.string().nullable(),
  imageUrl: Url.nullable(),
});

export const Storefront = z.strictObject({
  distributor: z.strictObject({ ...PublicDistributor.shape, coverUrl: Url.nullable(), tagline: z.string().nullable() }),
  highlights: z.array(Highlight).max(6),
  stats: z.array(Stat).max(4),
  categories: z.array(z.string()),
  brands: z.array(z.string()).max(20),
  openingHours: OpeningHours.nullable(),
  sameDayCutoff: Hhmm.nullable(),
  owner: z.strictObject({ name: z.string(), note: z.string() }).nullable(),
  map: z.strictObject({
    godown: z.strictObject({ ...LatLng, label: z.string() }).nullable(),
    zones: z.array(DeliveryZone).max(30),
  }),
  featuredItems: z.array(PublicCatalogItem).max(12),
  viewer: z.strictObject({ retailerName: z.string(), shopName: z.string().nullable() }).nullable(),
});

export const StorefrontInput = z.strictObject({
  tagline: nullableText(80).optional(),
  coverUploadId: Id.nullable().optional(),
  highlights: z.array(Highlight).max(6),
  stats: z.array(Stat).max(4),
  brands: z.array(text(1, 40)).max(20),
  openingHours: OpeningHours.nullable().optional(),
  sameDayCutoff: Hhmm.nullable().optional(),
  ownerNote: nullableText(400).optional(),
  godown: z
    .strictObject({ ...LatLng, label: text(1, 120) })
    .nullable()
    .optional(),
  featuredItemIds: z.array(Id).max(12),
  published: z.boolean(),
});
export const StorefrontAdmin = z.strictObject({ ...StorefrontInput.shape, coverUrl: Url.nullable(), previewUrl: Url });

export const RetailerSession = z.strictObject({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: Timestamp,
  retailer: z.strictObject({ id: Id, name: z.string(), shopName: z.string().nullable() }),
  distributor: PublicDistributor,
});

export const IdentifyInput = z.strictObject({ phone: PhoneE164, deviceId: z.uuid() });
export const IdentifyResult = z.discriminatedUnion('result', [
  z.strictObject({ result: z.literal('AUTHENTICATED'), session: RetailerSession }),
  z.strictObject({
    result: z.literal('NOT_REGISTERED'),
    pendingAccessRequest: z.strictObject({ createdAt: Timestamp }).nullable(),
  }),
]);

/** `website` is a honeypot: bots fill it, humans never see it. */
const honeypot = z.literal('').optional();
export const AccessRequestInput = z.strictObject({
  phone: PhoneE164,
  name: text(1, 120),
  shopName: text(1, 120),
  address: nullableText(300).optional(),
  locationLabel: nullableText(120).optional(),
  website: honeypot,
});
export const EnquiryInput = z.strictObject({
  phone: PhoneE164,
  name: text(1, 120),
  message: text(1, 500),
  website: honeypot,
});

export const CatalogItem = z.strictObject({
  id: Id,
  name: z.string(),
  unit: UnitSchema,
  ratePaise: z.number().int().min(0),
  category: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: Url.nullable(),
});
export const Catalog = z.strictObject({
  distributor: PublicDistributor,
  categories: z.array(z.string()),
  items: z.array(CatalogItem),
  version: z.string(),
});

export const Presign = z.strictObject({
  uploadId: Id,
  url: Url,
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: Timestamp,
});
export const PresignInput = z.strictObject({
  purpose: z.enum(['ITEM_IMAGE', 'SHOP_PHOTO', 'LOGO', 'COVER']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z
    .number()
    .int()
    .min(1)
    .max(2 * 1024 * 1024),
});
