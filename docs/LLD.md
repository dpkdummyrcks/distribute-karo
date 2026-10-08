# LLD — DistributeKaro · Phase 1 POC

> Read [`HLD.md`](HLD.md) first. §6 (DTOs) is the contract the UI fixtures must follow; change it here first, then the fixtures, then the code.

## 1. Repository layout
```
apps/
  api/                      # Hono, TS
    src/{app.ts, env.ts, db/, modules/{auth,distributor,items,retailers,requests,orders,catalog,uploads}/, middleware/, lib/}
    scripts/admin-reset-password.ts
  retailer-web/             # Vite PWA, TS
    src/{routes/, features/{entry,public,catalog,cart,orders}/, components/ui/, lib/api/, i18n/}
  distributor-android/      # Gradle (NOT in pnpm workspace)
    app/src/main/java/in/distributekaro/app/
      core/{network,auth,data,designsystem,util}/
      feature/{auth,onboarding,dashboard,catalog,retailers,requests,qr,orders,settings}/
packages/
  shared/                   # zod schemas, dto types, error codes, order machine, units, qty/money maths
    fixtures/               # JSON fixtures = DTOs below
  ui-tokens/                # tokens.json + build → css + kotlin
  config/                   # eslint, tsconfig, prettier
prototypes/                 # Phase 1A artifact HTML sources
infra/                      # docker-compose.yml, Caddyfile, garage.toml, .env.example
docs/                       # BRIEF, HLD, LLD, UI-SPEC, openapi.json (generated), SECURITY, RUNBOOK
memory/                     # PROGRESS.md, DECISIONS.md
```

## 2. Conventions
| Topic | Rule |
|---|---|
| IDs | UUIDv7 strings, generated in the app |
| Money | `…Paise` integer fields |
| Quantity | **decimal string**, regex `^\d{1,7}(\.\d{1,3})?$`; > 0 for requests; whole number when `unit.allowsDecimal = false` |
| Time | ISO-8601 UTC; rendered in `Asia/Kolkata` |
| Phone | E.164 (`+919876543210`), normalised with `libphonenumber-js`, default region IN |
| JSON | camelCase; nullable fields explicit `null` |
| Lists | `{ data: T[], nextCursor: string \| null }`; opaque cursor; `limit` default 20, max 100 |
| Errors | RFC 9457 problem+json: `{ type, title, status, code, detail?, errors?: [{path, message}], traceId }` |
| Images | DTOs expose signed `…Url` (hour-bucketed for stable ETags), never raw keys |
| Validation | Zod `.strict()`, trimmed strings, limits in §4 |

### 2.1 Units (`packages/shared/src/units.ts`)
| Unit | Label | allowsDecimal | Stepper step |
|---|---|---|---|
| PCS | pcs | no | 1 |
| BOX | box | no | 1 |
| DOZEN | dozen | no | 1 |
| PACK | pack | no | 1 |
| CASE | case | no | 1 |
| KG | kg | yes | 0.5 (free input to 0.001) |
| G | g | yes | 50 |
| L | L | yes | 0.5 |
| ML | ml | yes | 50 |

### 2.2 Quantity & money maths (identical in TS and Kotlin)
```
qtyMilli   = parseDecimal(qty) × 1000          // exact integer (BigInt / Long)
linePaise  = (ratePaise × qtyMilli + 500) / 1000   // integer division = round half up
totalPaise = Σ linePaise
```
DB equivalent: `round(rate_paise * qty)::bigint` on `numeric`. `fixtures/qty-money-vectors.json` holds the test vectors run by the TS, Kotlin and DB tests.

### 2.3 Error codes (`packages/shared/src/errors.ts`)
`VALIDATION_FAILED 422` · `UNAUTHENTICATED 401` · `TOKEN_EXPIRED 401` · `INVALID_CREDENTIALS 401` · `ACCOUNT_LOCKED 429` · `FORBIDDEN 403` · `NOT_FOUND 404` · `SLUG_INVALID 404` · `CONFLICT 409` · `INVALID_TRANSITION 409` · `INSUFFICIENT_STOCK 409` · `IDEMPOTENCY_KEY_REUSED 409` · `PHONE_ALREADY_EXISTS 409` · `REQUEST_ALREADY_PENDING 409` · `ITEM_UNAVAILABLE 422` · `WEAK_PASSWORD 422` · `RATE_LIMITED 429` · `UPLOAD_INVALID 422` · `INTERNAL 500`

## 3. Data model (PostgreSQL 18)
All tables: `id uuid PK`, `created_at`, `updated_at timestamptz` (trigger). Tenant tables carry `distributor_id`.

```sql
distributors (
  public_slug text UNIQUE NOT NULL,              -- 12 chars base58, CSPRNG
  phone text UNIQUE NOT NULL,
  password_hash text NOT NULL,                   -- argon2id PHC string
  password_changed_at timestamptz NOT NULL,
  business_name text, owner_name text,           -- null while ONBOARDING
  email text, address text, gstin text, logo_key text,
  status text NOT NULL CHECK (status IN ('ONBOARDING','ACTIVE','SUSPENDED')),
  order_seq int NOT NULL DEFAULT 0
)

password_reset_codes (                           -- QB: created by admin CLI only
  distributor_id uuid NOT NULL, code_hash text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz
)

items (                                          -- catalog + distributor-only stock (ADR-016)
  distributor_id uuid NOT NULL REFERENCES distributors,
  name text NOT NULL, sku text, unit text NOT NULL,
  rate_paise bigint NOT NULL CHECK (rate_paise >= 0),
  stock_qty numeric(12,3) NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),   -- remaining; = Σ stock_movements.delta_qty
  low_stock_threshold numeric(12,3) NOT NULL DEFAULT 0,               -- 0 = no alert
  category text, description text, image_key text,
  is_active bool NOT NULL DEFAULT true,          -- "available to order"
  deleted_at timestamptz
)
  INDEX (distributor_id, is_active) WHERE deleted_at IS NULL
  UNIQUE (distributor_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL
  INDEX gin (name gin_trgm_ops)                  -- pg_trgm for search

retailers (
  distributor_id uuid NOT NULL REFERENCES distributors,
  name text NOT NULL, shop_name text, phone text NOT NULL, email text, address text,
  shop_photo_key text, lat numeric(9,6), lng numeric(9,6), location_label text,
  is_active bool NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','ACCESS_REQUEST')),
  UNIQUE (distributor_id, phone)
)

stock_movements (                                -- append-only ledger (REVOKE UPDATE, DELETE from dk_app)
  distributor_id uuid NOT NULL, item_id uuid NOT NULL REFERENCES items,
  type text NOT NULL CHECK (type IN ('OPENING','RESTOCK','SALE','ADJUSTMENT')),
  delta_qty numeric(12,3) NOT NULL CHECK (delta_qty <> 0),            -- + in, − out
  balance_after numeric(12,3) NOT NULL,
  rate_paise_snapshot bigint,                                         -- SALE only (for sold ₹)
  amount_paise bigint,                                                -- SALE only = accepted_paise of the line
  order_id uuid, order_item_id uuid UNIQUE,                           -- SALE only; UNIQUE = no double-sale
  reason text,                                                        -- required for ADJUSTMENT
  actor_id uuid NOT NULL
)
  INDEX (distributor_id, item_id, created_at DESC)
  INDEX (distributor_id, type, created_at)                            -- sold-in-period reports

access_requests (
  distributor_id uuid NOT NULL, phone text NOT NULL,
  name text NOT NULL, shop_name text NOT NULL, address text, location_label text,
  status text NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  retailer_id uuid REFERENCES retailers, decided_at timestamptz, decision_note text
)
  UNIQUE (distributor_id, phone) WHERE status = 'PENDING'
  INDEX (distributor_id, status, created_at DESC)

enquiries (
  distributor_id uuid NOT NULL, phone text NOT NULL, name text NOT NULL,
  message text NOT NULL, status text NOT NULL CHECK (status IN ('NEW','READ','CLOSED'))
)
  INDEX (distributor_id, status, created_at DESC)

orders (
  distributor_id uuid NOT NULL, retailer_id uuid NOT NULL REFERENCES retailers,
  order_no int NOT NULL, status text NOT NULL,
  note text, rejection_reason text,
  total_requested_paise bigint NOT NULL, total_accepted_paise bigint,
  idempotency_key text NOT NULL, request_hash text NOT NULL,
  session_id uuid, new_device bool NOT NULL DEFAULT false,
  decided_at timestamptz, dispatched_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
  UNIQUE (distributor_id, order_no), UNIQUE (retailer_id, idempotency_key)
)
  INDEX (distributor_id, status, created_at DESC, id) ; INDEX (retailer_id, created_at DESC, id)

order_items (
  distributor_id uuid NOT NULL, order_id uuid NOT NULL REFERENCES orders ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items,
  item_name_snapshot text NOT NULL, unit_snapshot text NOT NULL, rate_paise_snapshot bigint NOT NULL,
  requested_qty numeric(12,3) NOT NULL CHECK (requested_qty > 0),
  accepted_qty  numeric(12,3) CHECK (accepted_qty >= 0 AND accepted_qty <= requested_qty),
  requested_paise bigint NOT NULL, accepted_paise bigint,
  line_note text
)

order_events (                                   -- append-only (REVOKE UPDATE, DELETE from dk_app)
  distributor_id uuid NOT NULL, order_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('DISTRIBUTOR','RETAILER','SYSTEM')),
  actor_id uuid, from_status text, to_status text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'
)

sessions (                                       -- no RLS; auth module only
  subject_type text NOT NULL CHECK (subject_type IN ('DISTRIBUTOR','RETAILER')),
  subject_id uuid NOT NULL, distributor_id uuid NOT NULL,
  refresh_token_hash text NOT NULL, generation int NOT NULL DEFAULT 0,
  device_fingerprint text,                       -- hash(UA + install id) for "new device" flag
  device_info text, ip inet, last_used_at timestamptz,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, revoke_reason text
)
  INDEX (subject_type, subject_id) WHERE revoked_at IS NULL
```
**RLS:** enabled + forced on `items, stock_movements, retailers, access_requests, enquiries, orders, order_items, order_events`. Policy: `distributor_id = current_setting('app.distributor_id')::uuid` (USING + WITH CHECK).
- Roles: `dk_owner` (migrations) and `dk_app` (runtime, no BYPASSRLS).
- `withTenant(did, tx => …)` runs `select set_config('app.distributor_id', $1, true)` first. Repositories require that tx by type.
- Public endpoints resolve slug → `did` from `distributors` (no RLS), then enter `withTenant`.

## 4. Field limits
- **Names and text:** name / shopName 1–120 · businessName 2–120 · sku ≤ 40 · category ≤ 40 · description ≤ 500 · note / lineNote / reason / message ≤ 500 · email ≤ 254 · address ≤ 300 · locationLabel ≤ 120.
- **Formats:** gstin `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` · password 8–128, not in the common list, not equal to the phone.
- **Numbers:** ratePaise 0–10^10 · qty / stockQty ≤ 9 999 999.999 · adjustment reason 3–200.
- **Orders:** 1–100 lines, unique itemIds.

## 5. Order state machine (`packages/shared/src/orderMachine.ts`)
| From | To | Actor | Guard / effect |
|---|---|---|---|
| — | PENDING | RETAILER | items active & not deleted; snapshot name/unit/rate; qty valid for unit |
| PENDING | ACCEPTED | DISTRIBUTOR | every line accepted == requested; accepted ≤ stock; write SALE movements |
| PENDING | PARTIALLY_ACCEPTED | DISTRIBUTOR | Σ accepted > 0 and some line accepted < requested; accepted ≤ stock; write SALE movements |
| PENDING | REJECTED | DISTRIBUTOR | reason required; accepted = 0 everywhere; no stock change |
| PENDING | CANCELLED | RETAILER | own order |
| ACCEPTED, PARTIALLY_ACCEPTED | DISPATCHED | DISTRIBUTOR | — |
| DISPATCHED | DELIVERED | DISTRIBUTOR | — |
The table is exported as data. The API enforces it, and the clients use it to choose which buttons to show (`allowedActions` in the DTO, so clients don't re-derive). Kotlin has no copy of the machine.

### 5.1 Decision (`POST /v1/d/orders/:id/decision`)
```
withTenant(did):
  order = SELECT … FROM orders WHERE id=$id FOR UPDATE              -- 404 via RLS if foreign
  assert order.status == PENDING                                   -- else 409 INVALID_TRANSITION
  lines = SELECT … FROM order_items WHERE order_id=$id
  plan  = ACCEPT_ALL → accepted=requested
          PARTIAL    → body lists every line exactly once; 0 ≤ accepted ≤ requested; unit decimal rule;
                       all==requested ⇒ ACCEPTED ; all==0 ⇒ 422 (use REJECT)
          REJECT     → accepted=0 ; reason required
  if any accepted > 0:
    stock = SELECT id, stock_qty, deleted_at FROM items WHERE id = ANY($itemIds) ORDER BY id FOR UPDATE
    -- lines sharing an item are summed per item before the check
    shortages = items where Σ accepted > (deleted ? 0 : stock_qty)
    if shortages: 409 INSUFFICIENT_STOCK, errors[] = {lineId, itemId, requested, accepted, available}
    UPDATE items SET stock_qty = stock_qty - Σaccepted              -- CHECK (>= 0) is the backstop
    INSERT stock_movements (type='SALE', delta=-accepted, balance_after, rate, amount, order_id, order_item_id)
  UPDATE order_items SET accepted_qty, accepted_paise, line_note
  UPDATE orders SET status, total_accepted_paise, decided_at, rejection_reason
  INSERT order_events(from, to, payload={lines:[{lineId, requested, accepted}], reason})
```
Lock order: order row first, then item rows by id. Every stock writer (decision, restock, adjustment) locks items in id order, so they can't deadlock. Cancel and status changes take the same order lock.
**Tests:**
- decision ∥ cancel → exactly one succeeds
- the same order decided twice in parallel → one 200, one 409
- **two different orders accepted in parallel against stock that covers only one → one 200, one 409 `INSUFFICIENT_STOCK`; final stock ≥ 0 and equal to Σ movements**

### 5.1b Stock writes (`POST /v1/d/items/:id/stock`)
```
withTenant(did):
  item = SELECT … FROM items WHERE id=$id FOR UPDATE
  RESTOCK    → delta = +qty (qty > 0)
  ADJUSTMENT → delta = ±qty, reason required; new balance must be ≥ 0 (else 422)
  UPDATE items SET stock_qty = stock_qty + delta
  INSERT stock_movements (type, delta, balance_after, reason, actor_id)
```
Item create with `openingStockQty > 0` writes an `OPENING` movement in the same tx. `PATCH /items/:id` **cannot** change `stockQty` directly; only movements can.

### 5.1c Stock report (`GET /v1/d/reports/stock?from&to&q&category&cursor`)
Per item: `soldQty = −Σ delta_qty`, `soldPaise = Σ amount_paise` over SALE movements in `[from, to)`. `restockedQty = Σ delta` of RESTOCK + OPENING in the period, `adjustedQty = Σ delta` of ADJUSTMENT in the period, and `remainingQty = items.stock_qty` (now). Totals row = Σ soldPaise. Sort: `-soldPaise` (default), `remainingQty`, `name`. Uses the `(distributor_id, type, created_at)` index.

### 5.2 Order creation (`POST /v1/r/:slug/orders`)
```
key = Idempotency-Key (UUID, required); hash = sha256(canonical(body))
existing(retailer, key): same hash → 200 same OrderDetail ; different → 409 IDEMPOTENCY_KEY_REUSED
withTenant(did):
  items = active, not deleted, id ∈ body          -- missing/inactive ⇒ 422 ITEM_UNAVAILABLE with paths
  validate qty per unit.allowsDecimal
  seq = UPDATE distributors SET order_seq = order_seq+1 WHERE id=$did RETURNING order_seq
  INSERT orders (… new_device = session.isNewDevice) ON CONFLICT (retailer_id, idempotency_key) DO NOTHING → re-read
  INSERT order_items (snapshots, requested_paise) ; INSERT order_events(→PENDING)
→ 201 OrderDetail
```
The body has no price fields (`.strict()`), so client prices are impossible.

### 5.3 Access request approval (`POST /v1/d/access-requests/:id/approve`)
```
withTenant(did):
  req = SELECT … FOR UPDATE ; assert PENDING
  body = RetailerInput (prefilled from request, editable)       -- QD
  INSERT retailers(source='ACCESS_REQUEST') (409 PHONE_ALREADY_EXISTS → if inactive retailer exists, reactivate instead)
  UPDATE access_requests SET status='APPROVED', retailer_id, decided_at
```

## 6. API contract & DTOs
Base `/v1`. `D` = distributor bearer (aud `dk-distributor`). `R` = retailer bearer (aud `dk-retailer`; `did` must equal the slug's distributor, else 404).

### 6.1 Endpoints
| Method & path | Auth | Request | Response |
|---|---|---|---|
| POST `/d/auth/signup` | – | `{phone, password, deviceInfo?}` | 201 `DistributorSession` (409 `PHONE_ALREADY_EXISTS`, 422 `WEAK_PASSWORD`) |
| POST `/d/auth/login` | – | `{phone, password, deviceInfo?}` | 200 `DistributorSession` (401 `INVALID_CREDENTIALS`, 429 `ACCOUNT_LOCKED`) |
| POST `/d/auth/reset-password` | – | `{phone, resetCode, newPassword}` | 204 (QB; revokes all sessions) |
| POST `/d/auth/refresh` | – | `{refreshToken}` | 200 `DistributorSession` |
| POST `/d/auth/logout` | D | `{refreshToken}` | 204 |
| POST `/d/me/password` | D | `{currentPassword, newPassword}` | 204 (revokes other sessions) |
| GET / PATCH `/d/me` | D | `DistributorProfileInput` | 200 `DistributorMe` |
| POST `/d/me/qr/rotate` | D | – | 200 `DistributorMe` |
| GET `/d/dashboard` | D | – | 200 `Dashboard` |
| GET `/d/items` | D | `?q&category&active&stock=LOW\|OUT&sort=name\|-updatedAt\|rate\|-rate\|stock&cursor&limit` | 200 `Page<Item>` |
| POST `/d/items` · PATCH `/d/items/:id` | D | `ItemInput` | 201 / 200 `Item` |
| GET / DELETE `/d/items/:id` | D | – | 200 `Item` / 204 (soft) |
| GET `/d/items/categories` | D | – | 200 `{data: string[]}` |
| POST `/d/items/:id/stock` | D | `StockMovementInput` | 200 `{item: Item, movement: StockMovement}` |
| GET `/d/items/:id/stock-movements` | D | `?type&cursor&limit` | 200 `Page<StockMovement>` |
| GET `/d/reports/stock` | D | `?from&to&q&category&sort&cursor&limit` | 200 `StockReport` |
| GET `/d/retailers` | D | `?q&active&cursor&limit` | 200 `Page<Retailer>` |
| POST `/d/retailers` · PATCH `/d/retailers/:id` | D | `RetailerInput` | 201 / 200 `Retailer` |
| GET / DELETE `/d/retailers/:id` | D | – | 200 / 204 (deactivate + revoke sessions) |
| GET `/d/access-requests` | D | `?status&cursor&limit` | 200 `Page<AccessRequest>` |
| POST `/d/access-requests/:id/approve` | D | `RetailerInput` | 200 `{request: AccessRequest, retailer: Retailer}` |
| POST `/d/access-requests/:id/reject` | D | `{note?}` | 200 `AccessRequest` |
| GET `/d/enquiries` | D | `?status&cursor&limit` | 200 `Page<Enquiry>` |
| PATCH `/d/enquiries/:id` | D | `{status: "READ"\|"CLOSED"}` | 200 `Enquiry` |
| GET `/d/inbox/counts` | D | – | 200 `InboxCounts` |
| GET `/d/orders` | D | `?status=A,B&retailerId&cursor&limit` | 200 `Page<OrderSummary>` |
| GET `/d/orders/:id` | D | – | 200 `OrderDetail` |
| POST `/d/orders/:id/decision` | D | `DecisionInput` | 200 `OrderDetail` |
| POST `/d/orders/:id/status` | D | `{to:"DISPATCHED"\|"DELIVERED", note?}` | 200 `OrderDetail` |
| POST `/d/uploads/presign` | D | `{purpose:"ITEM_IMAGE"\|"SHOP_PHOTO"\|"LOGO", contentType, contentLength}` | 200 `Presign` |
| GET `/r/:slug` | – | – | 200 `PublicDistributor` / 404 `SLUG_INVALID` |
| POST `/r/:slug/auth/identify` | – | `{phone, deviceId}` | 200 `IdentifyResult` (+ `Set-Cookie` when authenticated) |
| POST `/r/:slug/auth/refresh` | cookie | header `X-DK-CSRF: 1` | 200 `RetailerSession` |
| POST `/r/:slug/auth/logout` | R | – | 204 |
| POST `/r/:slug/access-requests` | – | `AccessRequestInput` | 201 `{status:"PENDING", createdAt}` (409 `REQUEST_ALREADY_PENDING`) |
| POST `/r/:slug/enquiries` | – | `EnquiryInput` | 201 `{ok: true}` |
| GET `/r/:slug/catalog` | R | `If-None-Match` | 200 `Catalog` / 304 |
| POST `/r/:slug/orders` | R | `Idempotency-Key`; `PlaceOrderInput` | 201 `OrderDetail` |
| GET `/r/:slug/orders` | R | `?cursor&limit` | 200 `Page<OrderSummary>` |
| GET `/r/:slug/orders/:id` | R | – | 200 `OrderDetail` |
| POST `/r/:slug/orders/:id/cancel` | R | – | 200 `OrderDetail` |
| GET `/healthz`, `/readyz`; `/docs` (dev) | – | | |

### 6.2 DTO shapes (TS notation; Kotlin generated)
```ts
type Unit = "PCS"|"BOX"|"DOZEN"|"PACK"|"CASE"|"KG"|"G"|"L"|"ML";
type Qty = string;                                   // decimal string, see §2
type OrderStatus = "PENDING"|"ACCEPTED"|"PARTIALLY_ACCEPTED"|"REJECTED"|"CANCELLED"|"DISPATCHED"|"DELIVERED";
type Page<T> = { data: T[]; nextCursor: string | null };

// ---------- distributor auth & profile
type DistributorSession = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string;
  distributor: DistributorMe; onboardingRequired: boolean };
type DistributorMe = { id: string; publicSlug: string; qrUrl: string;
  businessName: string | null; ownerName: string | null; phone: string;
  email: string | null; address: string | null; gstin: string | null; logoUrl: string | null;
  status: "ONBOARDING"|"ACTIVE"|"SUSPENDED"; createdAt: string };
type DistributorProfileInput = { businessName: string; ownerName: string; email?: string|null;
  address?: string|null; gstin?: string|null; logoUploadId?: string|null };

type InboxCounts = { orders: Record<OrderStatus, number>; accessRequestsPending: number; enquiriesNew: number };
type Dashboard = {
  today: { orderCount: number; requestedPaise: number; acceptedPaise: number };
  counts: InboxCounts;
  sales: { todaySoldPaise: number; last7dSoldPaise: number };
  lowStockItems: Item[];                             // active, stockQty <= lowStockThreshold (incl. 0), max 10
  recentOrders: OrderSummary[];                      // max 5
  setup: { hasProfile: boolean; itemCount: number; retailerCount: number; qrShared: boolean };  // new-account checklist
};

// ---------- catalog
type StockStatus = "IN_STOCK"|"LOW"|"OUT";
type Item = { id: string; name: string; sku: string | null; unit: Unit; ratePaise: number;
  stockQty: Qty; lowStockThreshold: Qty; stockStatus: StockStatus;          // distributor only
  category: string | null; description: string | null; imageUrl: string | null;
  isActive: boolean; createdAt: string; updatedAt: string };
type ItemInput = { name: string; sku?: string|null; unit: Unit; ratePaise: number; category?: string|null;
  description?: string|null; isActive?: boolean; imageUploadId?: string|null;
  lowStockThreshold?: Qty; openingStockQty?: Qty };                        // openingStockQty: POST only
type StockMovementInput =
  | { type: "RESTOCK"; qty: Qty; note?: string|null }
  | { type: "ADJUSTMENT"; deltaQty: Qty /* may start with "-" */; reason: string };
type StockMovement = { id: string; type: "OPENING"|"RESTOCK"|"SALE"|"ADJUSTMENT";
  deltaQty: Qty; balanceAfter: Qty; amountPaise: number | null;
  order: { id: string; orderNo: number; retailerName: string } | null;     // SALE only
  reason: string | null; createdAt: string };
type StockReportRow = { item: Pick<Item,"id"|"name"|"unit"|"imageUrl"|"category"|"stockStatus">;
  soldQty: Qty; soldPaise: number; restockedQty: Qty; adjustedQty: Qty; remainingQty: Qty };
type StockReport = { from: string; to: string; totals: { soldPaise: number; itemsSold: number };
  data: StockReportRow[]; nextCursor: string | null };

// ---------- retailers, requests, enquiries
type Retailer = { id: string; name: string; shopName: string | null; phone: string;
  email: string | null; address: string | null; shopPhotoUrl: string | null;
  location: { lat: number | null; lng: number | null; label: string | null } | null;
  isActive: boolean; source: "MANUAL"|"ACCESS_REQUEST"; lastOrderAt: string | null;
  createdAt: string; updatedAt: string };
type RetailerInput = { name: string; shopName?: string|null; phone: string; email?: string|null;
  address?: string|null; location?: Retailer["location"]; isActive?: boolean; shopPhotoUploadId?: string|null };
type AccessRequest = { id: string; phone: string; name: string; shopName: string; address: string | null;
  locationLabel: string | null; status: "PENDING"|"APPROVED"|"REJECTED"; retailerId: string | null;
  decisionNote: string | null; createdAt: string; decidedAt: string | null };
type Enquiry = { id: string; phone: string; name: string; message: string;
  status: "NEW"|"READ"|"CLOSED"; createdAt: string };

// ---------- orders
type OrderSummary = { id: string; orderNo: number; status: OrderStatus;
  retailer?: { id: string; name: string; shopName: string | null; locationLabel: string | null };  // distributor view
  distributor?: { businessName: string };                                                          // retailer view
  lineCount: number; totalRequestedPaise: number; totalAcceptedPaise: number | null;
  newDevice?: boolean;                                                                             // distributor view
  createdAt: string; updatedAt: string };
type OrderLine = { id: string; itemId: string; name: string; unit: Unit; ratePaise: number;
  requestedQty: Qty; acceptedQty: Qty | null; requestedPaise: number; acceptedPaise: number | null;
  lineNote: string | null;
  availableStockQty?: Qty };                                                // distributor view, PENDING only
type OrderEvent = { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus;
  actorType: "DISTRIBUTOR"|"RETAILER"|"SYSTEM"; note: string | null; createdAt: string };
type OrderDetail = OrderSummary & { note: string | null; rejectionReason: string | null;
  lines: OrderLine[]; events: OrderEvent[];
  allowedActions: Array<"ACCEPT"|"REJECT"|"DISPATCH"|"DELIVER"|"CANCEL"> };
type DecisionInput =
  | { decision: "ACCEPT_ALL" }
  | { decision: "PARTIAL"; lines: { lineId: string; acceptedQty: Qty; lineNote?: string|null }[] }
  | { decision: "REJECT"; reason: string };

type Presign = { uploadId: string; url: string; method: "PUT"; headers: Record<string,string>; expiresAt: string };

// ---------- retailer (public + authenticated)
type PublicDistributor = { businessName: string; logoUrl: string | null };       // nothing else
type RetailerSession = { accessToken: string; accessTokenExpiresAt: string;
  retailer: { id: string; name: string; shopName: string | null }; distributor: PublicDistributor };
type IdentifyResult =
  | { result: "AUTHENTICATED"; session: RetailerSession }
  | { result: "NOT_REGISTERED"; pendingAccessRequest: { createdAt: string } | null };
type AccessRequestInput = { phone: string; name: string; shopName: string; address?: string|null;
  locationLabel?: string|null; website?: "" };      // `website` = honeypot, must be empty
type EnquiryInput = { phone: string; name: string; message: string; website?: "" };
type CatalogItem = { id: string; name: string; unit: Unit; ratePaise: number; category: string | null;
  description: string | null; imageUrl: string | null };                      // never any stock info (ADR-016)
type Catalog = { distributor: PublicDistributor; categories: string[]; items: CatalogItem[]; version: string };
type PlaceOrderInput = { lines: { itemId: string; qty: Qty }[]; note?: string|null };
```

**Fixture files** (`packages/shared/fixtures/`):
- **Distributor auth & profile:** `distributor-session.json`, `distributor-me.onboarding.json`, `distributor-me.json`, `dashboard.json`, `dashboard.new-account.json`.
- **Catalog & stock:** `items.page.json`, `item.json`, `categories.json`, `stock-movements.page.json`, `stock-report.json`.
- **Retailers, requests, enquiries:** `retailers.page.json`, `retailer.json`, `access-requests.page.json`, `enquiries.page.json`, `inbox-counts.json`.
- **Orders:** `orders.page.json`, `order-detail.{pending,partial,accepted,rejected,dispatched,delivered,cancelled}.json`.
- **Retailer side:** `public-distributor.json`, `identify.authenticated.json`, `identify.not-registered.json`, `identify.not-registered-pending.json`, `catalog.json`, `retailer-orders.page.json`, `retailer-order-detail.json`.
- **Shared:** `empty.page.json`, `qty-money-vectors.json`, `problem.{validation,invalid-credentials,account-locked,rate-limited,slug-invalid,request-pending,item-unavailable,insufficient-stock}.json`.

## 7. Auth details
**Distributor passwords:** argon2id (m=19456 KiB, t=2, p=1). Verify runs against a dummy hash when the phone is unknown, so the timing is equal.
- **Lockout** (Valkey): `lock:d:{hmac(phone)}` counts failures. 5 failures in 15 min → 15 min lock → `ACCOUNT_LOCKED` (returned only after a correct-format request, with the same message for unknown phones). A successful login resets the counter.
- **Admin reset (QB):** `pnpm --filter api admin:reset-password +91…` stores a hashed 8-char code (15 min TTL) and prints it to the operator's console. The app calls `/d/auth/reset-password`.

**Retailer identify:** normalise the phone → look up `retailers(distributor_id, phone, is_active)`.
- **Found:** create a session, set the cookie, return `AUTHENTICATED`. `device_fingerprint` = sha256(`deviceId` from localStorage + UA family). If it's not among the retailer's previous sessions, the session is flagged `isNewDevice` and the flag is copied onto orders from that session.
- **Not found:** return `NOT_REGISTERED`, plus the pending-request timestamp if one exists.
- Deactivating a retailer revokes all their sessions.

**JWT (EdDSA, `jose`):** `{iss:"dk-api", aud, sub, typ:"D"|"R", did, sid, iat, exp:+15m}` with a `kid` header for rotation. Middleware also checks the session isn't revoked (cached in Valkey `sess:revoked:{sid}`, 15 min) so deactivation takes effect immediately.

**Refresh token:** `"{sessionId}.{base64url(32 bytes)}"`, stored as a sha256 hash and rotated on every use. A hash mismatch on a live session means reuse → revoke the session. Lifetimes: distributor 30 days sliding, retailer 30 days sliding.
- **Android:** Tink AEAD (keyset wrapped by an Android Keystore key) + DataStore. The access token is memory only. An OkHttp `Authenticator` does single-flight refresh behind a Mutex. Passwords are offered to Credential Manager for autofill.
- **Web:** cookie `__Host-dk_rt_{8 hex sha256(did)}`, `HttpOnly; Secure; SameSite=Strict; Path=/`. Refresh also needs the `X-DK-CSRF` header and an Origin check. Single-flight via `navigator.locks`.

## 8. Rate limits (Valkey sliding-window log, Lua)
| Rule | Key | Limit |
|---|---|---|
| Distributor login / phone | `lock:d:{hmac(phone)}` | 5 failures / 15 min → 15 min lock |
| Distributor login / IP | `rl:dlogin:ip:{ip}` | 20 / h |
| Distributor signup / IP | `rl:dsignup:ip:{ip}` | 5 / h |
| Reset password / IP | `rl:dreset:ip:{ip}` | 5 / h |
| Retailer identify / IP | `rl:ident:ip:{ip}` | 10 / 15 min |
| Retailer identify / slug | `rl:ident:slug:{did}` | 300 / h (anti-enumeration) |
| Access request / enquiry per phone | `rl:pubform:{did}:{hmac(phone)}` | 3 / day |
| Access request / enquiry per IP | `rl:pubform:ip:{ip}` | 10 / h |
| Place order | `rl:order:{retailerId}` | 10 / min |
| Authenticated reads | `rl:read:{typ}:{sub}` | 120 / min |
| Public slug card | `rl:pub:ip:{ip}` | 60 / min |
| Presign | `rl:presign:{sub}` | 20 / h |
Headers: `RateLimit-Policy` and `RateLimit` (IETF draft), plus `Retry-After` on 429. The IP comes from `X-Forwarded-For`, trusting Caddy only.

## 9. Uploads
1. `presign` checks type ∈ {jpeg, png, webp} and length ≤ 2 MiB. Key = `tmp/{did}/{uuidv7}`. The ticket `upl:{uploadId}` → `{key, did, purpose}` lives in Valkey (1 h). The PUT is signed with Content-Type + Content-Length and expires in 5 min.
2. The client PUTs directly to Garage. The Android app first downsizes to ≤ 1600 px JPEG.
3. Writes carry an `…UploadId`. The API checks the ticket owner and purpose, fetches the object, checks magic bytes, re-encodes with sharp (≤ 1600 px, webp q80, metadata stripped), writes `img/{did}/{uuidv7}.webp` and deletes the tmp object. This is synchronous.
4. A lifecycle rule expires `tmp/` after 24 h.
5. Reads use a signed GET at `/media/...` with `signingDate` = start of the hour and a 2 h expiry, so ETags stay stable within the hour.

## 10. API internals
- Middleware order: `requestId` → `logger (masked)` → `secureHeaders` → `bodyLimit(64kb)` → `rateLimit(rule)` → `auth(aud)` → `zValidator` → handler → `problem+json mapper`.
- Each module has `routes.ts` (zod-openapi), `service.ts` (rules, takes a tx) and `repo.ts` (Drizzle, `withTenant` tx required).
- Notification hook: a `DomainEvents` emitter (`order.created`, `access_request.created`, …) with a no-op handler in Phase 1. Push notifications plug in here in Phase 2.
- Env (Zod, fail fast): `DATABASE_URL, VALKEY_URL, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, PUBLIC_BASE_URL, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, HMAC_SECRET, TRUSTED_PROXIES, NODE_ENV`.

## 11. Retailer web internals
- **Routes:** `/d/$slug` (landing + phone entry) → `/d/$slug/welcome` (public page: Enquire / Request access) → `/d/$slug/request` → `/d/$slug/enquire` → `/d/$slug/catalog` → `/d/$slug/cart` → `/d/$slug/orders` → `/d/$slug/orders/$id` (`?placed=1` shows the confirmation). Bottom nav after login: Catalog · Cart · Orders.
- **State:** TanStack Query for server data. The cart is a Zustand store persisted per slug as `{itemId, qty}` (prices always come from the catalog). The access token lives in memory. `deviceId` is a random UUID in localStorage.
- **Qty input:** a stepper uses the unit's step. Tapping the number opens a numeric keypad (`inputmode="decimal"` only for decimal units).
- **Service worker:** precache the shell. Images are stale-while-revalidate. `/v1/*` is NetworkOnly.
- **CSP:** `default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`.

## 12. Android internals
| Concern | Choice |
|---|---|
| Build | Gradle KTS, version catalog, minSdk 26, latest target, R8 release |
| UI | Compose BOM, Material 3, Navigation Compose type-safe routes, edge-to-edge, brand colours (dynamic colour off) |
| Arch | per feature: stateless `Screen` + `ViewModel` (`StateFlow<UiState>`, `onEvent`) + `Repository` |
| DI | Hilt |
| Network | Retrofit 3 + OkHttp 5 + kotlinx.serialization; DTOs generated from `docs/openapi.json`; `Qty` ↔ `BigDecimal` serializer; problem+json → sealed `ApiError` |
| Auth | Credential Manager (password autofill/save); Tink + DataStore for refresh token; `TokenAuthenticator` |
| Lists | Paging 3 |
| Images | Coil 3; Photo Picker; downscale before upload |
| Location | framework `LocationManager.getCurrentLocation` + manual label |
| QR | ZXing core → Bitmap; share via `FileProvider` + `ACTION_SEND`; save via MediaStore |
| Contact | enquiry/request rows: Call (`ACTION_DIAL`) and WhatsApp (`https://wa.me/<number>`) intents |
| i18n | `strings.xml` (+ `values-hi`); money via en-IN `NumberFormat` |
| Quality | ktlint + detekt, Lint as errors, JUnit + MockK + Turbine, MockWebServer, Compose UI tests, Maestro (stretch) |

## 13. Design tokens pipeline
`packages/ui-tokens/tokens.json` → `pnpm tokens:build` → `apps/retailer-web/src/styles/tokens.css` (`@theme` + dark overrides) and `…/core/designsystem/DkTokens.kt` (`lightColorScheme`, `darkColorScheme`, `DkStatusColors`). Prototypes inline the same values.

## 14. Test plan → acceptance criteria (HLD §9)
| AC | Test |
|---|---|
| 1 | Android Compose UI tests (MockWebServer) for signup → item → retailer → QR; manual device checklist |
| 2 | Playwright: QR URL → identify → catalog → order with a decimal qty → history |
| 3 | API: identify unknown phone → `NOT_REGISTERED`, no cookie; catalog without token → 401; access request/enquiry visible to the owning distributor only |
| 4 | API: approve request → retailer exists → identify → `AUTHENTICATED` |
| 5 | API: partial decision → stock decremented, SALE movements written, line/total paise per vectors; retailer view shows requested vs accepted and no stock fields; stock report sold/remaining correct |
| 6 | Testcontainers PG: two orders ∥ accepted over limited stock → no oversell, stock = Σ movements; decision ∥ cancel and decision ∥ decision → exactly one wins; cross-tenant ids → 404; RLS raw-query test returns 0 rows |
| 7 | Each rate-limit rule at limit+1 → 429 + `Retry-After` + `RateLimit` headers; login lockout |
| — | Unit: state machine table, unit/qty validation, money vectors (TS + Kotlin), password policy, refresh reuse → revoke |
