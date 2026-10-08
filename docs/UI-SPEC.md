# UI Spec — Phase 1A (Artifact prototypes)

> Process rule (ADR-005): build one batch, then owner review, then iterate, then **Approved**, then the next batch. Status and artifact URLs live in [`../memory/PROGRESS.md`](../memory/PROGRESS.md).
> Screen data comes from `packages/shared/fixtures/*.json` (shapes in LLD §6.2), inlined into the artifact.

## 1. Principles
- **Distributor app = Material 3 Android.** Top app bar, navigation bar, FAB, M3 text fields, bottom sheets, snackbars, 48 dp targets. Each prototype component should map to a Compose M3 component.
- **Retailer web = native-feeling PWA.** Centred app shell (max-w 480 px), bottom tabs, sticky cart bar, safe-area insets, 44 px targets.
- Light + dark (system default, with a toggle in the prototype). Inter font. ₹ with en-IN grouping (₹1,25,000.50). Layouts leave room for Hindi.
- Every list has **loading (skeleton) / empty / error / content** states, with a state switcher in the prototype.
- **No stock anywhere** (ADR-014). Quantities can be decimal for KG/G/L/ML (ADR-011).

## 2. Brand & tokens (finalised in UI-0)
- **Name:** DistributeKaro. **Logo:** designed in UI-0. I'll offer 2–3 wordmark + icon directions (e.g. a box/route mark, a "DK" monogram) as inline SVG; you pick one.

| Token | Light | Dark |
|---|---|---|
| primary | `#3730A3` | `#A5B4FC` |
| onPrimary | `#FFFFFF` | `#1E1B4B` |
| primaryContainer | `#E0E7FF` | `#312E81` |
| surface / background | `#FFFFFF` / `#F8FAFC` | `#0F172A` / `#020617` |
| surfaceVariant | `#F1F5F9` | `#1E293B` |
| outline | `#CBD5E1` | `#334155` |
| success / warning / danger | `#15803D` / `#B45309` / `#B91C1C` | `#4ADE80` / `#FBBF24` / `#F87171` |
| radius | sm 8 · md 12 · lg 16 · full | |
| spacing | 4-pt scale | |
| type | Inter; display 28/34, title 20/28, body 16/24, label 14/20, caption 12/16 | |

**Status chips:** PENDING amber · ACCEPTED green · PARTIALLY_ACCEPTED teal · REJECTED red · CANCELLED slate · DISPATCHED blue · DELIVERED emerald. Each pairs colour with an icon. Request chips: PENDING amber · APPROVED green · REJECTED red. The "New device" flag is an outline chip with an info icon.

## 3. Screen inventory
### Distributor app (Android, M3)
Nav bar: **Home · Orders · Catalog · Retailers · More**. The Retailers tab has segments **Retailers | Requests (badge) | Enquiries (badge)**. More holds QR, Profile, Settings.

| ID | Screen | Key elements | States | Fixtures |
|---|---|---|---|---|
| D-01 | Splash | logo, brand | — | — |
| D-02 | Welcome | value line, **Create account** / **Log in** | — | — |
| D-03 | Sign up | phone (+91), password + show/hide, strength hint, confirm, terms | phone exists, weak password, rate limited | problem.validation |
| D-04 | Log in | phone, password, Forgot password? | invalid credentials, locked (with countdown) | problem.invalid-credentials, problem.account-locked |
| D-05 | Reset password | "Ask support for a reset code" note, code, new password (QB) | invalid/expired code | — |
| D-06 | Onboarding profile | business name*, owner name*, email, address, GSTIN, logo picker; phone read-only | validation | distributor-me.onboarding |
| D-07 | Dashboard | greeting, today's orders + ₹ requested/accepted, Pending orders → Orders, New requests / enquiries → Retailers tab, recent orders; **new-account checklist** (profile → add items → add retailers → share QR) | skeleton, new account | dashboard, dashboard.new-account |
| D-08 | Catalog list | search, category chips, Available/Unavailable filter, sort, rows (thumb, name, unit, ₹rate/unit, "Unavailable" dimmed), FAB | skeleton / empty / error / no results | items.page, categories |
| D-09 | Add/Edit item | image, name*, SKU, unit*, rate per unit*, category (autocomplete), description, **Available to order** switch, delete | validation, saving, uploading | item |
| D-10 | Retailers list | search, active filter, rows (photo/initials, name, shop, phone, location label, last order) | skeleton / empty / error | retailers.page |
| D-11 | Add/Edit retailer | shop photo, name*, shop name, phone*, email, address, "Use current location" + label, active switch (deactivation warns that it signs them out) | duplicate phone, location denied | retailer |
| D-12 | Access requests | cards (name, shop, phone, address, time), **Approve** → D-11 pre-filled (QD), **Reject** (note), Call / WhatsApp | skeleton / empty / error | access-requests.page |
| D-13 | Enquiries | cards (name, phone, message, time, NEW badge), Call / WhatsApp, Mark read / Close | skeleton / empty / error | enquiries.page |
| D-14 | My QR | QR card (logo, business name, short URL), Share, Save PNG, Print-friendly view, Rotate (confirm: old QR stops working) | rotating | distributor-me |
| D-15 | Orders inbox | tabs with counts: Pending · Accepted · Dispatched · Completed · Closed; cards (order no, retailer, shop, ₹, lines, time, status chip, New device flag) | skeleton / empty per tab / error | orders.page, inbox-counts |
| D-16 | Order detail | header, lines (qty + unit, rate, line ₹), retailer note, totals, timeline; bottom bar per `allowedActions` | all 7 status variants | order-detail.* |
| D-17 | Partial-accept editor | per line: stepper 0…requested (unit step, tap to type decimals), line note, "Accept full" per line; live accepted total; Confirm | — | order-detail.pending |
| D-18 | Reject sheet | reason chips (Can't supply now, Area not served, Other) + text | — | — |
| D-19 | Profile / Settings | edit profile, change password, theme, language, log out, version | — | distributor-me |

### Retailer web (PWA)
Bottom nav after login: **Catalog · Cart · Orders**.

| ID | Screen | Key elements | States | Fixtures |
|---|---|---|---|---|
| R-01 | Landing + phone | distributor logo + name, "Enter your mobile number", +91 input, Continue | invalid/rotated QR ("This QR is no longer valid"), rate limited | public-distributor, problem.slug-invalid |
| R-02 | Public page (not registered) | "You're not on <name>'s retailer list yet", two big choices: **Request to get added** / **Send an enquiry**; if a request is already pending: "Request sent on <date>, the distributor will add you" | pending variant | identify.not-registered, identify.not-registered-pending |
| R-03 | Request access form | name*, shop name*, phone (prefilled, editable), address, area/landmark; Submit → success state | already pending (409), rate limited | problem.request-pending |
| R-04 | Enquiry form | name*, phone (prefilled), message* (e.g. "What brands do you carry?"); Submit → success state | rate limited | — |
| R-05 | Catalog | greeting with shop name, search, category chips, item cards (image, name, ₹rate / unit, stepper with unit step), sticky cart bar (n items · ₹est. total · View cart) | skeleton / empty / error / no results | catalog |
| R-06 | Cart | lines with stepper + tap-to-type qty, remove, note, estimated total ("Final amount confirmed by distributor"), Place order | empty, item became unavailable (422), placing | catalog, problem.item-unavailable |
| R-07 | Order placed | success animation, order no, "<Distributor> will confirm quantities", View order | — | retailer-order-detail |
| R-08 | Order history | cards (no, date, status chip, ₹requested → ₹accepted), pull-to-refresh | skeleton / empty / error | retailer-orders.page |
| R-09 | Order detail | status timeline, lines requested vs accepted (diff highlighted, line notes), totals, Cancel (if PENDING), **Reorder** (adds lines to cart; skips unavailable items with a notice) | each status | retailer-order-detail |

## 4. Shared components (UI-0)
App bar · nav bar / bottom tabs · segmented tabs with badges · list cell (thumb/avatar/initials) · item card + **qty stepper (integer and decimal modes)** · sticky cart summary · status chip · bottom sheet · dialog · snackbar/toast · empty state · skeletons · text field (label/helper/error) · password field (show/hide, strength) · phone field (+91) · FAB · timeline · contact actions (call/WhatsApp) · money + qty formatting.

## 5. Artifact batches
| Batch | Contents | Review focus |
|---|---|---|
| **UI-0** | Logo directions, tokens (light/dark), type, component sheet (M3 + web side by side) | Brand, colour, density, chips, stepper |
| **UI-1** | D-01…D-06 | Sign-up/login friction, onboarding fields |
| **UI-2** | D-07…D-09 | Dashboard usefulness, catalog + item form |
| **UI-3** | D-10…D-14 | Retailer form, requests/enquiries handling, QR card |
| **UI-4** | D-15…D-19 | Order decision UX (core flow), settings |
| **UI-5** | R-01…R-04 | QR entry, not-registered path, forms |
| **UI-6** | R-05…R-09 | Catalog → cart → order → history, requested vs accepted |
| **UI-7** | Combined clickable prototype, end to end: retailer requests access → distributor approves → retailer orders → distributor partially accepts → retailer sees result | Final sign-off → freeze fixtures as contract v0 |

**Each artifact includes:** phone frame(s) (360×780 Android, 390×844 web), a state switcher, a light/dark toggle, working navigation within the batch, and a footer listing the fixtures used.

**Review checklist:**
- fields match the LLD DTOs
- all states present
- AA contrast in both themes
- touch targets
- en-IN formatting and decimal qty display (`2.5 kg`, `12 pcs`)
- no stock shown anywhere
