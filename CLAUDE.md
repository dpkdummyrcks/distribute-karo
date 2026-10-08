# DistributeKaro — working notes for Claude

## Start of every session
1. Read `memory/PROGRESS.md` → *Current checkpoint* tells you exactly where to resume.
2. Read `memory/DECISIONS.md` → it overrides `docs/BRIEF.md` wherever they differ.
3. Open only the doc sections the next step needs: `docs/HLD.md` (architecture), `docs/LLD.md` (schema, API, DTOs, algorithms), `docs/UI-SPEC.md` (screens, batches).

## End of every step
- Update `memory/PROGRESS.md`: tick the item, move *Current checkpoint*, add a *Session log* line, and record any artifact URL.
- A new decision or changed assumption gets an ADR row or open question in `memory/DECISIONS.md`. Don't decide silently.
- If a DTO changes, update LLD §6.2 first, then the fixtures, then the code.

## Rules
- Phase gates are strict. No server code until UI-7 is approved (ADR-005).
- Stack: Hono/TS API, PostgreSQL 18, Valkey, Garage, Vite PWA, and a native Kotlin/Compose Android app (`apps/distributor-android`, Gradle, outside pnpm). Distributor auth = phone + password; retailer = phone-only. Distributor-only stock ledger (sold vs remaining); retailers never see stock. Decimal quantities. EN + HI from day one.
- UI: no horizontal scrolling in the distributor app (wrap chip rows; ADR-024).
- TS strict, no `any`, Zod `.strict()` everywhere. Kotlin: ktlint + detekt clean.
- `distributor_id` always comes from the auth token, never from request input.
- Never log passwords or tokens. Mask phone numbers to the last 4 digits.
- Use small conventional commits. Ask before irreversible choices.
