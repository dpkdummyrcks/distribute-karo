# Progress & Checkpoints

> **Resume protocol:** read *Current checkpoint* below, then `memory/DECISIONS.md`, then only the docs the next step needs.
> **Update protocol:** at the end of every step, tick the box, update *Current checkpoint*, and add one line to the *Session log*. Record artifact URLs next to their batch.

## Current checkpoint
- **Phase:** 0 — Planning
- **Last completed:** 0.8 QE/QF answered; public storefront added (ADR-017); docs revised
- **Next step:** 1A.0 write fixtures per LLD §6.2, then 1A.1 UI-0 (logo directions + design system artifact)
- **Blockers:** none. QA–QD are running on documented assumptions (see DECISIONS.md *Open questions*); confirm during UI review

## Checklist
### Phase 0 — Planning
- [x] 0.1 Analyse brief, record changes (Kotlin app, DB review, UI-first) → `DECISIONS.md`
- [x] 0.2 HLD → `docs/HLD.md`
- [x] 0.3 LLD (data model, API, DTOs, algorithms, auth, rate limits, app internals) → `docs/LLD.md`
- [x] 0.4 UI spec (tokens, screen inventory, batches) → `docs/UI-SPEC.md`
- [x] 0.5 Owner answered Q1–Q9 → ADR-011 decimal qty, ADR-012 distributor password, ADR-013 retailer phone-only + public page, ADR-014 no stock, ADR-015 brand; HLD/LLD/UI-SPEC revised
- [x] 0.6 `git init`, first commit `docs: planning baseline`
- [x] 0.8 Owner: QE sold at acceptance, QF still orderable at 0; QR landing = public storefront for everyone → ADR-017, screens R-01/R-01a/R-01b, D-14a
- [x] 0.7 Owner: distributor tracks stock (sold vs remaining) → ADR-016 stock ledger; LLD/HLD/UI-SPEC updated

### Phase 1A — UI prototypes (Artifacts)
| Step | Batch | Status | Artifact URL |
|---|---|---|---|
| 1A.0 | Fixtures in `packages/shared/fixtures` per LLD §6.2 | not started | — |
| 1A.1 | UI-0 Logo directions + design system | not started | — |
| 1A.2 | UI-1 Distributor sign-up/login & onboarding (D-01…D-06) | not started | — |
| 1A.3 | UI-2 Dashboard, catalog & stock (D-07…D-09c) | not started | — |
| 1A.4 | UI-3 Retailers, requests, enquiries, QR, storefront editor (D-10…D-14a) | not started | — |
| 1A.5 | UI-4 Orders & decisions, settings (D-15…D-19) | not started | — |
| 1A.6 | UI-5 Storefront, public products, entry, not-registered, forms (R-01…R-04) | not started | — |
| 1A.7 | UI-6 Retailer catalog → cart → orders (R-05…R-09) | not started | — |
| 1A.8 | UI-7 Combined end-to-end prototype → **sign-off, freeze contract v0** | not started | — |
Status values: `not started` · `in progress` · `in review` · `changes requested` · `approved`

### Phase 1B — Foundation
- [ ] 1B.1 pnpm + Turborepo scaffold, `packages/config`, strict TS
- [ ] 1B.2 `packages/shared`: zod schemas, error codes, order machine (+ tests)
- [ ] 1B.3 `packages/ui-tokens` + generators (CSS, Kotlin)
- [ ] 1B.4 `infra/` compose: PG18, Valkey, Garage, Caddy; Garage spike (signed Content-Length, lifecycle)
- [ ] 1B.5 Drizzle schema, migrations, RLS, roles, seed (1 distributor, 20 items, 5 retailers, 3 access requests, 3 enquiries, 10 orders)
- [ ] 1B.6 Env validation; Android Gradle skeleton (empty Compose app + theme from tokens)
- [ ] 1B.7 CI: TS (lint, typecheck, test, build, audit), Android (lint, detekt, test, assemble), CodeQL, Trivy, Renovate

### Phase 1C — API
- [ ] 1C.1 Core middleware (request id, logger masking, headers, problem+json, rate limiter)
- [ ] 1C.2 Auth: distributor signup/login/password (argon2id, lockout, admin reset), retailer identify, sessions, JWT, refresh rotation + reuse detection
- [ ] 1C.3 Distributor: me, QR rotate, storefront (admin + public + public catalog), dashboard, items, categories, stock movements (restock/adjust), stock report, retailers, access requests, enquiries, inbox counts
- [ ] 1C.4 Orders: create (idempotent), list/detail, decision, status, cancel
- [ ] 1C.5 Uploads presign + finalise (sharp)
- [ ] 1C.6 OpenAPI → `docs/openapi.json`, `/docs` dev only
- [ ] 1C.7 Tests: isolation, rate limit, lockout, oversell concurrency, stock = Σ ledger, decision∥cancel concurrency, state machine, qty/money vectors, refresh reuse; coverage ≥ 80 %

### Phase 1D — Retailer web
- [ ] 1D.1 Vite + Tailwind v4 + shadcn + router scaffold
- [ ] 1D.2 Screens wired to the API
- [ ] 1D.3 PWA (manifest, SW rules)
- [ ] 1D.4 Playwright E2E

### Phase 1E — Android
- [ ] 1E.1 Network layer (generated DTOs, auth interceptor/authenticator, secure storage)
- [ ] 1E.2 Sign-up/login (Credential Manager) + onboarding
- [ ] 1E.3 Catalog + image upload, restock/adjust, stock history, stock report
- [ ] 1E.4 Retailers + location, access requests, enquiries
- [ ] 1E.5 QR + share, storefront editor + preview
- [ ] 1E.6 Orders + decision flow, dashboard
- [ ] 1E.7 Release APK via CI, device test checklist

### Phase 1F — Hardening & handoff
- [ ] 1F.1 SECURITY.md (STRIDE, ASVS L1)
- [ ] 1F.2 Lighthouse ≥ 90
- [ ] 1F.3 README one-command start, RUNBOOK, Coolify guide
- [ ] 1F.4 Known limitations + Phase 2 recommendations

## Session log
| Date | Summary |
|---|---|
| 2026-10-08 | Analysed brief. Wrote BRIEF (verbatim), HLD, LLD, UI-SPEC, DECISIONS (ADR-001…010, Q1–Q9), PROGRESS, CLAUDE.md. Awaiting owner answers. |
| 2026-10-08 | Owner answers: Android only, PG18, Garage, Hono (Express rationale in ADR-003), decimal qty, distributor password, retailer phone-only + public page (enquire / request access), no stock, brand DistributeKaro. Rewrote DECISIONS, HLD, LLD, UI-SPEC. git init + baseline commit. |
| 2026-10-08 | Owner: stock tracking IS needed for the distributor (sold vs remaining). Added ADR-016 (stock ledger, decrement at acceptance, no oversell, report), new screens D-09a/b/c. New assumptions QE (sold at acceptance), QF (no auto-hide at 0). |
| 2026-10-08 | QE/QF answered. Added public storefront at QR URL (ADR-017): storefront table, public catalog with `publicCatalogMode`, editor D-14a, retailer R-01/R-01a/R-01b. New open QG (default public price visibility). |
