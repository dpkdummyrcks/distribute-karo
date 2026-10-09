import { z } from 'zod';
import { Email, Id, PhoneE164, Timestamp, Url, nullableText, text } from './common.js';

const Location = z.strictObject({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  label: z.string().nullable(),
});

export const Retailer = z.strictObject({
  id: Id,
  name: z.string(),
  shopName: z.string().nullable(),
  phone: PhoneE164,
  email: z.string().nullable(),
  address: z.string().nullable(),
  shopPhotoUrl: Url.nullable(),
  location: Location.nullable(),
  isActive: z.boolean(),
  source: z.enum(['MANUAL', 'ACCESS_REQUEST']),
  lastOrderAt: Timestamp.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

export const RetailerInput = z.strictObject({
  name: text(1, 120),
  shopName: nullableText(120).optional(),
  phone: PhoneE164,
  email: Email.nullable().optional(),
  address: nullableText(300).optional(),
  location: z
    .strictObject({
      lat: z.number().min(-90).max(90).nullable(),
      lng: z.number().min(-180).max(180).nullable(),
      label: nullableText(120),
    })
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  shopPhotoUploadId: Id.nullable().optional(),
});

export const AccessRequest = z.strictObject({
  id: Id,
  phone: PhoneE164,
  name: z.string(),
  shopName: z.string(),
  address: z.string().nullable(),
  locationLabel: z.string().nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  retailerId: Id.nullable(),
  decisionNote: z.string().nullable(),
  createdAt: Timestamp,
  decidedAt: Timestamp.nullable(),
});

export const Enquiry = z.strictObject({
  id: Id,
  phone: PhoneE164,
  name: z.string(),
  message: z.string(),
  status: z.enum(['NEW', 'READ', 'CLOSED']),
  createdAt: Timestamp,
});
