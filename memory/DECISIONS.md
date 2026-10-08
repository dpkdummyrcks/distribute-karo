# Decisions Log (ADR-lite)

> Single source of truth for choices that override or refine [`docs/BRIEF.md`](../docs/BRIEF.md).
> Status: **Accepted** (in force) · **Proposed** (recommended, awaiting owner OK) · **Open** (needs owner input) · **Superseded**.
> Add new entries at the bottom; never delete — mark **Superseded by ADR-xxx** instead.

| ID | Decision | Status | Date |
|---|---|---|---|
| ADR-001 | Distributor app = native **Android only**, Kotlin + Jetpack Compose | Accepted | 2026-10-08 |
| ADR-002 | DB = self-hosted **PostgreSQL 18**; Neon allowed as managed option via `DATABASE_URL` | Accepted | 2026-10-08 |
| ADR-003 | API = **Hono**/TypeScript (not Express); contract shared with Kotlin via generated OpenAPI | Accepted | 2026-10-08 |
| ADR-004 | Object storage = **Garage** (S3-compatible) instead of MinIO | Accepted | 2026-10-08 |
| ADR-005 | UI-first: all screens prototyped as Artifacts and approved before any server code | Accepted | 2026-10-08 |
| ADR-006 | ~~Integer quantities~~ | Superseded by ADR-011 | 2026-10-08 |
| ADR-007 | Single origin: web at `/`, API at `/v1/*` behind Caddy | Accepted | 2026-10-08 |
| ADR-008 | Design tokens: one `tokens.json` → generated Tailwind CSS + Kotlin theme | Accepted | 2026-10-08 |
| ADR-009 | Progress/memory tracked in repo `memory/` (PROGRESS.md + this file) | Accepted | 2026-10-08 |
| ADR-010 | UUIDv7 generated in the app (not DB default) | Accepted | 2026-10-08 |
| ADR-011 | Money = integer paise; **quantities = decimal (3 dp)**, unit decides if fractions allowed | Accepted | 2026-10-08 |
| ADR-012 | **Distributor auth = phone + password** (argon2id); no OTP/SMS in Phase 1 | Accepted | 2026-10-08 |
| ADR-013 | **Retailer auth = phone number only**, scoped to the scanned distributor; unregistered → public page (Enquire / Request access) | Accepted | 2026-10-08 |
| ADR-014 | ~~No stock tracking~~ | Superseded by ADR-016 | 2026-10-08 |
| ADR-015 | Brand name **DistributeKaro**; logo to be designed during UI-0 | Accepted | 2026-10-08 |
| ADR-017 | **Public storefront** at the QR URL for everyone: distributor's pitch page; existing retailers order from it, new visitors browse, then request access / enquire | Accepted | 2026-10-08 |
| ADR-018 | Fonts: **Anek Latin** (display) + **Mukta** (UI/body) instead of Inter. Both from Ek Type, OFL, Devanagari companions for Hindi | Accepted | 2026-10-08 |
| ADR-019 | **Logo = C (dk monogram)**: indigo tile, white "d" + stem, marigold "k" arm | Accepted | 2026-10-08 |
| ADR-020 | **Tinted surfaces**: background `#F7F6FC`, cards `#EEEDF8`, fields/chips `#E3E2F1`; pure white only for sheets & dialogs (dark: `#0E0D1A` / `#1A1930` / `#24223F`) | Accepted | 2026-10-08 |
| ADR-021 | **Hindi is in Phase 1 scope** (not a stretch goal): every UI string in EN + HI from day one; language switch in both apps | Accepted | 2026-10-08 |
| ADR-016 | **Distributor-only stock tracking** via a stock ledger: sold vs remaining per item; retailers never see stock and can order freely | Accepted | 2026-10-08 |

---

## ADR-001 — Native Kotlin distributor app (Android only)
Android-native app: Kotlin 2.x, Jetpack Compose, Material 3, single Gradle module (package-by-feature), MVVM + unidirectional data flow. It lives in `apps/distributor-android/` **outside** the pnpm workspace. The contract is the generated OpenAPI spec (ADR-003). The APK is built with Gradle in GitHub Actions. There is no iOS in Phase 1.

## ADR-002 — PostgreSQL 18 (self-hosted), Neon optional
| Option | Verdict |
|---|---|
| **PostgreSQL 18 (Docker)** | ✅ Fully OSS, works on a single VPS, has RLS and transactional locking |
| Neon (managed) | ✅ Optional hosted target (branching, free tier). ⚠️ Self-hosting Neon isn't practical. Its PgBouncer runs in transaction mode, so use `set_config(…, true)`. Its HTTP driver can't do interactive transactions, so use a TCP driver |
| Supabase | ❌ Heavy bundle that duplicates our auth/storage |
| CockroachDB | ❌ No longer open source |
| YugabyteDB | ❌ Distributed; overkill |
| MySQL/MariaDB | ❌ No row-level security |

## ADR-003 — Hono, not Express
**Why not Express:**
1. **One schema → validation + types + OpenAPI.** `@hono/zod-openapi` uses the *same* Zod schema to validate the request, type the handler and emit the OpenAPI spec. That spec is what generates the Kotlin DTOs (ADR-001), so this is the main reason. Express needs separate glue (`zod-to-openapi` registry + validation middleware + hand-written types), and those three drift apart.
2. **End-to-end typing.** Route params, query, body and response are inferred in Hono. Express's `req.body` is `any` by default, which fights our "no `any`" rule.
3. **Batteries included, fewer deps.** Secure headers, CSRF/origin check, body limit, ETag, cookies, JWT and request id are built in. Express needs helmet, cors, cookie-parser, express-rate-limit, etc. Every extra package is supply-chain surface.
4. **Web-standard Request/Response.** Tests call `app.request()` with no port or supertest, and the code runs unchanged on Node, Bun or Deno.
5. **Performance.** Hono on `@hono/node-server` is several times faster than Express in routing benchmarks. That's not decisive at POC scale, but it's free.

**What we give up:** Express has the larger ecosystem and more tutorials, and more developers know it. If you ever want a Node-native framework with a big plugin ecosystem, **Fastify** would be the alternative, not Express.

## ADR-004 — Garage instead of MinIO
MinIO's community edition has been in maintenance mode since 2025 (console stripped, no official community builds). Garage is AGPL, a single binary and has an S3 API. We use only the AWS S3 SDK, so SeaweedFS is the fallback. **Phase 1B spike:** confirm presigned PUT with a signed `Content-Length`, plus lifecycle expiry on `tmp/`.

## ADR-005 — UI-first via Artifacts
Phase 1A is done as published Artifacts (self-contained HTML + Tailwind CDN, phone frames, clickable). They use fixtures in `packages/shared/fixtures` shaped like LLD §6.2, reviewed batch by batch. Server work starts only after **UI-7 sign-off**, and the fixtures then freeze as contract v0. Distributor screens imitate Material 3; retailer screens use an app-shell style.

## ADR-007 — Single origin
The PWA is served at `/`, the retailer entry is `/d/<slug>`, and Caddy proxies `/v1/*` to the API. Benefits: no CORS for the web app, `SameSite=Strict` cookies work, and the CSP is simpler.

## ADR-008 — Shared design tokens
`packages/ui-tokens/tokens.json` → generated `tokens.css` (Tailwind v4 `@theme`) + `DkTokens.kt` (Compose). Both are committed and drift-checked in CI.

## ADR-011 — Decimal quantities
- Quantities are stored as `numeric(12,3)` and sent in JSON as **decimal strings** (`"2.5"`) so JS floats never touch them. Kotlin uses `BigDecimal`.
- Each unit has `allowsDecimal`: KG, G, L, ML = yes; PCS, BOX, DOZEN, PACK, CASE = whole numbers only.
- Money stays integer paise. Line amount = `round_half_up(ratePaise × qty)`. Clients compute previews with milli-unit integer maths so they match the server exactly.

## ADR-012 — Distributor phone + password
- **Signup:** phone + password, then the business profile. **Login:** phone + password.
- Hashing: argon2id (`@node-rs/argon2`, OWASP params m=19 MiB, t=2, p=1).
- Passwords: min 8 / max 128 characters, checked against a bundled list of common/breached passwords. No composition rules (NIST 800-63B).
- Errors are generic ("Invalid phone number or password"). Lockout and rate limits are per LLD §8.
- Changing the password needs the current one and revokes all other sessions.
- Phone ownership is **not verified** in Phase 1, so someone could register another person's number. That's accepted for the POC; add OTP or email verification in Phase 2.
- Forgot password: see QB.
- No SMS provider is needed in Phase 1, so SMS cost and the SMS breaker drop out.

## ADR-013 — Retailer phone-only access
- Scan QR → enter phone → if it's an **active retailer of this distributor**, a session is issued immediately (refresh cookie, 30 days).
- Otherwise a **public page** offers two actions: **Enquire** (name + message) or **Request to get added** (name, shop name, address, location label). The distributor reviews both in the app.
- Approving a request creates the retailer from the request's details.
- **Accepted risks (owner decision):**
  - Anyone who knows a retailer's number and has the QR can act as that retailer.
  - The response reveals whether a number is registered with *this* distributor. Brief AC #3 is relaxed accordingly.
- **Mitigations in Phase 1:**
  - rate limits on identification
  - every order still needs the distributor's decision
  - order cards show the time and device ("Ordered from a new device" flag)
  - the distributor can deactivate a retailer, which revokes their sessions
- **Phase 2 option:** retailer PIN or OTP on new devices.

## ADR-014 — No stock tracking — **Superseded by ADR-016**
- Items have no `stock_qty` and there's no low-stock logic. Retailers never see stock.
- `isActive` is the "can supply / can't supply right now" toggle, and only active items appear in the catalog.
- Partial acceptance stays: the distributor sets `acceptedQty` per line (0 … requested), e.g. when they can't supply everything.
- Concurrency still matters for order state (decision vs cancel, double decision). The order row lock handles it.
- The brief's dashboard low-stock card is replaced with pending requests and enquiries.

## ADR-016 — Distributor-only stock tracking
**Owner:** "Stock tracking for the distributor is there: how much he has sold, and how much is left that is not yet sold."
- `items.stock_qty` = **remaining** stock, `numeric(12,3)`, ≥ 0, following the unit's decimal rule. A `low_stock_threshold` per item drives the dashboard alerts.
- **Stock ledger** `stock_movements` (append-only) records every change:
  - `OPENING`: initial stock when the item is created
  - `RESTOCK`: new goods received (+)
  - `SALE`: written when an order is accepted (−accepted qty, linked to the order line)
  - `ADJUSTMENT`: ± with a required reason (damage, expiry, count correction)

  `stock_qty` is kept in sync in the same transaction, and a consistency test checks `stock_qty = Σ movements`.
- **Sold** = Σ `SALE` movements (qty and ₹) over a period. **Remaining** = `stock_qty`. Both are shown per item and in a stock report (today / 7 d / 30 d / custom).
- **At acceptance:** `acceptedQty` must be ≤ remaining stock, so stock never goes negative. The partial-accept editor shows each line's remaining stock and caps the stepper there. *Accept all* with a shortage returns `INSUFFICIENT_STOCK` and offers the partial editor. Item rows are locked (`FOR UPDATE`, in id order), so two concurrent acceptances can't oversell. This restores the brief's AC #5.
- **Retailers:** never see stock in any form. They can order any quantity of an active item. Stock reaching 0 does **not** hide the item (QF).
- PENDING, REJECTED and CANCELLED orders never touch stock.

## ADR-017 — Public storefront (QR landing for everyone)
**Owner:** "For the QR code scan we must have a page for all users. Already-added users order from it, and new users browse it. It should be an appealing page from the distributor, persuading retailers to buy only from him. Then they can request to be added or send an enquiry."
- `/d/<slug>` is a **storefront**, edited by the distributor in the app. It has:
  - cover image, logo, name and tagline
  - "Why buy from us" highlights (max 6, e.g. *Same-day delivery*, *Credit available*, *500+ products*, *Best rates*)
  - categories and brands carried
  - featured products (max 12, picked from the catalog)
  - service areas, business hours and an about text
- **Calls to action, the same for everyone:** *Order now* (phone entry; registered numbers go to the catalog), *Request to become a retailer*, *Send an enquiry*. A signed-in retailer sees "Welcome back, <shop> · Continue ordering" instead of *Order now*.
- **Public browsing:** visitors can always open "All products" (name, image, unit, category). **No prices and no stock in public, ever**, and there's no setting for it (QG). Rates appear only after a registered retailer enters.
- A storefront with no content yet still renders well from the profile alone (name, logo, categories from the catalog), so a new distributor's QR works on day one.
- Supersedes QC.
- **Security:** public endpoints are read-only and return only storefront fields plus active items (name, unit, image, category; never price or stock). Rate limit 60/min per IP. Images go through the same signed `/media` path.

## ADR-021 — Hindi in Phase 1
- **Android:** `values/strings.xml` + `values-hi/strings.xml`. Per-app language through `AppCompatDelegate.setApplicationLocales` (Android 13+ system per-app language picker, plus an in-app Settings → Language). Plurals via `<plurals>`.
- **Retailer web:** `src/i18n/{en,hi}.json` with a typed key set (missing keys fail CI). The language is detected from `navigator.language` and remembered in localStorage. The `EN | हिं` switch is in the storefront header and the account sheet.
- **Fonts:** Anek Latin + **Anek Devanagari** for display, Mukta for UI/body (Mukta covers both scripts), so headings in Hindi don't fall back.
- **Not translated:** user data (item names, shop names, notes). Distributor storefront texts are entered by the distributor in whatever language they choose.
- **Numbers:** always Western digits with en-IN grouping (₹1,25,000.50), in both languages.
- **Prototypes:** every batch from UI-5 onward has an EN/HI toggle.

---

## Answered questions (2026-10-08)
| # | Question | Answer |
|---|---|---|
| Q1 | Android / iOS | Android only |
| Q2 | Unregistered retailer flow | No OTP at all; phone-only; unregistered → public page (Enquire / Request access) — ADR-013 |
| Q3 | Database | PostgreSQL 18 |
| Q4 | Quantity type | Decimal — ADR-011 |
| Q5 | Backend | Keep Hono; Express question answered in ADR-003 |
| Q6 | Object storage | Garage |
| Q7 | Stock visibility | Nothing about stock — ADR-014 |
| Q8 | Brand | DistributeKaro; logo designed with UI |
| Q9 | Order out-of-stock | Moot (no stock) |
| — | git init + baseline commit | Yes |
| QA | Stock tracking? | Yes, distributor-only: sold vs remaining — ADR-016 |
| QE | Sold at acceptance or delivery? | **At acceptance** |
| QF | Auto-hide at 0 stock? | **No**, retailers still see and can order it |
| QC | Catalog on the public page? | Replaced by ADR-017 storefront + public products |
| QG | Public prices? | **Never.** One public version without prices, no distributor toggle |

## Open questions
| # | Question | Assumption used until answered |
|---|---|---|
| QB | Distributor forgot password in Phase 1 (no SMS/email)? | Admin CLI `pnpm admin:reset-password <phone>` prints a one-time reset code (15 min) the distributor enters in the app; OTP/email reset in Phase 2 |
| QD | When a distributor approves an access request, add the retailer straight away or open the pre-filled retailer form first? | Open the pre-filled form (distributor can add photo/location), then save |
