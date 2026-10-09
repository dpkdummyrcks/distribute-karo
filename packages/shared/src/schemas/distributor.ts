import { z } from 'zod';
import { Email, Gstin, Id, Paise, PhoneE164, Timestamp, Url, nullableText, text } from './common.js';
import { OrderStatusSchema } from './common.js';
import { Item } from './catalog.js';
import { OrderSummary } from './orders.js';

export const DistributorMe = z.strictObject({
  id: Id,
  publicSlug: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{12}$/, 'Expected a 12-char base58 slug'),
  qrUrl: Url,
  businessName: z.string().nullable(),
  ownerName: z.string().nullable(),
  phone: PhoneE164,
  email: z.string().nullable(),
  address: z.string().nullable(),
  gstin: z.string().nullable(),
  logoUrl: Url.nullable(),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'SUSPENDED']),
  createdAt: Timestamp,
});
export type DistributorMe = z.infer<typeof DistributorMe>;

export const DistributorSession = z.strictObject({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: Timestamp,
  refreshToken: z.string().min(1),
  distributor: DistributorMe,
  onboardingRequired: z.boolean(),
});

export const Password = z.string().min(8).max(128);
export const SignupInput = z.strictObject({
  phone: PhoneE164,
  password: Password,
  deviceInfo: text(0, 200).optional(),
});
export const LoginInput = z.strictObject({
  phone: PhoneE164,
  password: z.string().min(1).max(128),
  deviceInfo: text(0, 200).optional(),
});
export const ResetPasswordInput = z.strictObject({
  phone: PhoneE164,
  resetCode: z.string().regex(/^[A-Z0-9]{8}$/),
  newPassword: Password,
});
export const ChangePasswordInput = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: Password,
});
export const RefreshInput = z.strictObject({ refreshToken: z.string().min(1).max(200) });

export const DistributorProfileInput = z.strictObject({
  businessName: text(2, 120),
  ownerName: text(1, 120),
  email: Email.nullable().optional(),
  address: nullableText(300).optional(),
  gstin: Gstin.nullable().optional(),
  logoUploadId: Id.nullable().optional(),
});

const orderCounts = z.strictObject(
  Object.fromEntries(OrderStatusSchema.options.map((s) => [s, z.number().int().min(0)])) as Record<
    z.infer<typeof OrderStatusSchema>,
    z.ZodNumber
  >,
);
export const InboxCounts = z.strictObject({
  orders: orderCounts,
  accessRequestsPending: z.number().int().min(0),
  enquiriesNew: z.number().int().min(0),
});

export const Dashboard = z.strictObject({
  today: z.strictObject({ orderCount: z.number().int().min(0), requestedPaise: Paise, acceptedPaise: Paise }),
  counts: InboxCounts,
  sales: z.strictObject({ todaySoldPaise: Paise, last7dSoldPaise: Paise }),
  lowStockItems: z.array(Item).max(10),
  recentOrders: z.array(OrderSummary).max(5),
  setup: z.strictObject({
    hasProfile: z.boolean(),
    itemCount: z.number().int().min(0),
    retailerCount: z.number().int().min(0),
    qrShared: z.boolean(),
  }),
});
