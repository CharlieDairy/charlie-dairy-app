# Charlie Dairy — Current System Audit

Date: 2026-09-21. Written before any Charlie V2 work begins, per the "do not
rebuild first" rule. Verified against a running instance (`npm run dev`),
`tsc --noEmit`, `eslint`, and `next build` — not just a read of the source.

## Quality gates (as of this audit)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean |
| `npm run lint` | ✅ Clean (0 errors — last debt fixed same day as this audit) |
| `npm run build` | ✅ Clean, 28 routes |
| Automated tests | ❌ **None exist.** No test runner is installed (no Jest/Vitest/Playwright in `package.json`), no `*.test.ts` files anywhere. "Run tests" in this audit means manual verification through the running app + direct DB checks, which is what every feature this session has actually been checked with. |

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind v4
- Prisma 6 on **SQLite** (`prisma/dev.db`) — single file, single writer
- NextAuth v5 (beta), JWT sessions, credentials provider
- Recharts for the two dashboard charts
- No design-system package, no component library, no test framework, no ORM read replica, no cache layer, no background job runner

## Multi-tenancy / farm scope

**Single farm, single organization, no `Farm`/`Organization`/`Barn`/`Pen` models.** Every table is implicitly scoped to "the one farm this instance runs." Part 2/42's Animal→Group→Barn→Farm→Organization aggregation hierarchy does not exist. This was a deliberate scope decision earlier this session (see `docs/ROADMAP.md`) for a single real farm, not a gap introduced by neglect — but it's a real limitation against the V2 spec's multi-farm ambitions and would need schema work (see Gap Analysis) before it could apply.

## Module-by-module status

Legend: 🟢 EXISTS AND GOOD · 🟡 EXISTS BUT WEAK · 🟠 PARTIAL · 🔴 MISSING

| Module | Status | Notes |
|---|---|---|
| Auth / Users & Access | 🟢 | Credentials login, bcrypt, JWT. Role (ADMIN/ENTRY) + a 4-module grant system (Operations/Financial/People/Admin) enforced server-side in middleware, not just hidden nav — verified end-to-end with a real test user. |
| Audit Log | 🟢 | Automatic via a Prisma Client extension — every create/update/delete on every model is captured with before/after snapshots and the acting user, with zero per-action code needed. Login success/failure logged separately. Admin-only route. |
| Cow Register | 🟢 | Tag, gender, status, DOB, condition, notes; master-data-driven status labels (renameable, can't add new codes since business logic depends on them). Delete is guarded — blocks if the cow has any milking/breeding/calving history. |
| Animal 360° / Cow Profile | 🟡 | A real profile page exists (`/admin/cows/[id]`) with milking summary, calving history, linked children, breeding history. But: no photo, no RFID/QR, no weight/BCS tracking, no health/treatment tab (health module doesn't exist), no financial tab (no cow P&L), no unified timeline component (each section is its own table, not one interleaved chronological feed), no tab navigation UI (it's one long scroll). This is the real gap between what exists and Part 4.1's spec. |
| Breeding & Reproduction | 🟢 | Heat, AI/service, pregnancy check, calving all modeled with real business rules (gestation/dry-off date calc, service number auto-increment, calving closes pregnancy + increments lactation + creates calf record, all in a DB transaction). Breeding KPI report exists (pregnant count, days open, conception rate, services/conception). **Missing:** dry-off *action* (dates are calculated but there's no "mark dried off" workflow or alert), repeat-breeder flagging, a dedicated Reproduction Dashboard beyond the one report page. |
| Health / Veterinary | 🔴 | **Does not exist at all.** No disease, diagnosis, treatment, or medicine model. This is the single largest gap against the V2 spec — Parts 4.2–4.4 are a from-scratch build. |
| Medicine / Withdrawal | 🔴 | Missing (depends on Health module existing first). No withdrawal tracking means milk entered during a real withdrawal period is **not** flagged non-saleable anywhere in the system today — a real data-integrity gap once Health exists. |
| Vaccination | 🔴 | Missing. |
| Calf Management | 🟠 | A `Calf` record is created automatically on calving (sex, outcome, birth weight, optional tag→new Cow registration). No colostrum tracking, no milk/starter feeding log, no weaning workflow, no ADG calculation, no calf dashboard. |
| Milk Production | 🟢 | Individual per-shift entry, dashboard shows yearly trend with best-month highlight, top/bottom 5 producers by avg L/day (min 5 days to qualify). **Missing:** 7-day/30-day rolling averages, abnormal-decline detection, peak yield, DIM-based lactation curve (no `Lactation` entity — see Database Weaknesses). |
| Milk Sales | 🟡 | Structured `MilkSale` table exists (buyer/litres/amount) but was **empty until this session's backfill** — historical revenue lived only in freeform cash-ledger text. Dashboard now shows Litres Sold / Revenue / Customers / Sale Records, with an honest disclosure that ~80% of backfilled rows have no recorded quantity (only revenue) and "Customers" undercounts since buyer was never historically recorded. This is documented in the UI itself, not hidden. |
| Milk Reconciliation | 🟡 | `Production Reconciliation` report and a dashboard "Production vs Sold" chart both exist and compute Produced − Sold. Neither claims the gap is "in-house consumption" — both label it "unaccounted/not yet recorded," which is the honest framing since nothing tracks calf consumption, wastage, or rejected milk separately. Part 11's full formula (minus calf consumption, minus withdrawal milk, minus rejected, minus farm consumption, minus wastage) is not implemented because none of those sub-components exist as data yet. |
| Feed & Nutrition | 🟠 | Only `FeedTransaction` (in/out quantity + cost) exists. No feed material master data beyond a free-text type (though "Feed Types" is now a Master Data category admins can curate), no ration formulation, no feeding-vs-ration variance, no feed efficiency calc, no forecasting. Parts 4.6–4.8 are unbuilt. |
| Inventory / Warehouse | 🔴 | Missing entirely. Feed/medicine/consumables have no stock-level concept — `FeedTransaction` is a ledger, not inventory (no current-stock query, no low-stock alert, no batch/expiry/FEFO). |
| Procurement / Suppliers | 🔴 | Missing entirely. No PR→PO→GRN→Invoice flow, no supplier master, no price history beyond what's implicit in cash ledger text. |
| Finance (Cash/Capital/P&L/Cash Flow) | 🟢 | Real, working, and reconciled against the source Excel books during migration (see `scripts/migrate/`). P&L correctly sums CashTransaction + non-backfilled MilkSale without double-counting (a real bug was caught and fixed this session). No budget vs. actual, no period-over-period comparison UI. |
| Animal P&L | 🔴 | Missing. No per-animal revenue/cost allocation exists — this is Part 8, a "key feature," and currently there is zero code toward it. |
| Assets | 🟢 | Full CRUD (add/edit/delete), photo upload (local disk, validated type/size, cleaned up on delete/replace), CSV export/import via Bulk Data. No maintenance/work-order tracking (Part 31) — Assets is a register, not an asset-management module. |
| Bulk Import/Export | 🟢 | CSV export for 12 data types (7 importable), all-or-nothing validated import with row-level error reporting — verified with both a clean and a deliberately broken upload. No column-mapping UI (Part 50's "Upload → Map Columns → Validate → Preview" flow) — the format is fixed to a downloadable template, not user-remappable. |
| Master Data | 🟢 | Configurable labels for 6 enum-backed "locked" categories (codes fixed, labels/active editable) and 4 open categories (freely add/rename/hide), auto-seeded from real historical data. Wired into Cow Status display end-to-end (rename propagates to dropdowns/reports live); other categories (Feed Type, Cash Category) are managed here but the entry forms for those still use free text, not a dropdown sourced from this list. |
| Tasks / Calendar / Alerts | 🔴 | Missing entirely. No `Task`, `Alert`, or calendar-event model. Everything the V2 spec calls the "Action Required" / "Exception Management" / "Alert Center" concept (Parts 15, 28, 33) has zero backing data today — the dashboard shows historical/current-state metrics, not forward-looking action items. |
| Employees / Workforce | 🔴 | Missing. No `Employee` model — "enteredBy" on transactions is a free-text string, not a foreign key to a person record. |
| Maintenance | 🔴 | Missing. |
| Analytics / Exceptions / Performance Matrix / Forecast | 🔴 | Missing beyond the two dashboard charts and the breeding KPI report. No exception-detection engine, no cow performance matrix, no herd forecast. |
| Global Search / Cmd+K / Quick Add | 🔴 | Missing. No search exists anywhere in the app. |
| Reusable DataTable | 🔴 | Every table in the app is a hand-written `<table>` — no shared, filterable/sortable/paginated component. 12+ near-identical table implementations exist across pages (see Duplicate Functionality). |
| Design System | 🔴 | No design tokens, no CSS variables for color/spacing, no component library. Every page repeats the same Tailwind utility classes (`bg-white border border-neutral-200 rounded-lg p-4`, green-700 buttons, etc.) by convention, not by shared component — consistent by discipline, not by architecture. |
| Mobile / QR / RFID / Offline | 🔴 | Missing. The app is responsive (Tailwind), and admin nav collapses on small screens, but there is no scan-to-open workflow, no QR generation, no PWA/offline queue. |

## Reusable components inventory (what to build on, not replace)

- `src/components/StatCard.tsx` — the only shared UI component in the app. Used on the dashboard. Good candidate to extend rather than replace when building the design system.
- `src/lib/prisma.ts` — the audit-log Prisma extension. This is the load-bearing piece of infrastructure the whole audit trail depends on; any future schema/query work must go through this client, not a raw `new PrismaClient()` (which several one-time scripts under `scripts/deploy/` intentionally do, to keep migration/seed operations out of the audit log).
- `src/lib/modules.ts` — single source of truth for the 4-module RBAC system; the natural place to extend when V2 adds more granular permissions.
- `src/lib/masterData.ts` — the configurable-enum pattern; the template to follow for any new "admin-editable list" (disease master, vaccine master, feed material master, etc. all belong here architecturally).
- `src/lib/bulk/*` — generic CSV export/import engine already handles 12 data types; extending it to new models is mechanical (add a registry entry + export/import case).
- `src/lib/reports/*` — one file per report's query logic, kept separate from the page component. This pattern (lib function returns typed data, page renders it) is consistent across the whole app and should continue.

## Duplicate functionality (a real cost of not having a shared DataTable)

At least 12 pages hand-roll the same `<table>` markup, search/filter is absent everywhere except Bulk Data and Audit Log (which have their own bespoke filter forms, not shared), and pagination only exists on Audit Log. Building the reusable DataTable (Part 23) before touching more list pages would prevent this from growing to 20+.

## Database weaknesses

1. **No `Lactation` entity.** `Cow.lactationNumber` is a counter, not a linked record — there's no way to query "this cow's current lactation's milk records" without inferring it from `lastCalvingDate`. DIM, peak yield, and persistency all depend on this not existing yet.
2. **SQLite, single file, single writer.** Fine at current scale (~100 animals, one farm); a real constraint once multiple people write concurrently from different locations at volume, or if animal count reaches the low thousands (already flagged in `docs/ROADMAP.md`'s "Future rewrite triggers").
3. **`enteredBy` is a free-text string everywhere**, not a `User` foreign key. Can't reliably answer "how many entries did this employee make" without string matching.
4. **No soft-delete pattern.** Cow delete is hard-blocked instead (safer, but means there's no "undo" for genuinely-wanted deletions beyond the audit log's stored snapshot).
5. **No composite/farm-scoping columns** anywhere, since there's only one farm — this is the single biggest schema change multi-farm support would require, touching every table.
6. **Indexes exist on the hot paths that matter today** (date, cowId, entity, userId, category) but nothing has been stress-tested at "10,000 animals / millions of records" scale (Part 47) — current data volume (~100 cows, ~11k milking records) doesn't exercise that.

## Security review

- Passwords: bcrypt, cost 10. ✅
- Server-side authorization: middleware enforces role + module on every `/admin/*` request (not just nav hiding) — verified. ✅
- Server Actions: no explicit CSRF concern beyond what Next.js provides natively (action IDs are encrypted/origin-checked by the framework). ✅
- File uploads: type allowlist (JPEG/PNG/WebP), 5MB size cap, filename is server-generated (not user-controlled) — no path traversal risk. ✅ Body size limit was misconfigured until this session (1MB Next.js default vs. 5MB app validation) — fixed.
- Rate limiting: **none**, anywhere. Login has no throttle — an attacker could brute-force the `admin` account with unlimited attempts. This is the most concrete security gap right now.
- Secrets: `.env` is gitignored, `.env.example` has no real values. `AUTH_SECRET` in the local dev `.env` is still a placeholder-quality value — must be rotated before any real deployment (already flagged in `docs/DEPLOYMENT.md`).
- SQL injection: all queries go through Prisma's parameterized query builder or tagged-template raw SQL (`$queryRaw` with interpolated values, which Prisma parameterizes automatically) — no string-concatenated SQL anywhere.
- Session revocation: JWT sessions don't re-check `active`/module grants per request — a deactivated user's existing session, or a user whose module access was just revoked, stays valid until it expires or they sign out. Documented in-app, but worth listing here as a real limitation, not just a UX note.

## Performance concerns

- Herd summary and a few reports use raw `$queryRaw` aggregation (good — avoids N+1), but several pages (`Cow Register`, `Assets`) `findMany()` the entire table with no pagination. Fine at ~100 rows; would need pagination before this scales to the thousands Part 47 targets.
- No caching layer, no materialized summaries — every dashboard load recomputes everything live. Acceptable at current volume; the natural next step if load ever becomes visible is either React `cache()`/Next's data cache or a scheduled summary-table job, not a premature optimization to reach for now.

## Technical debt

- `next.config.ts`'s `experimental.serverActions.bodySizeLimit` — "experimental" flag; watch for Next.js promoting this to stable in a future upgrade and simplifying the config.
- Prisma 6.19.3 with a major version (8.x) available — not upgraded, deliberately, mid-session; worth a dedicated upgrade pass later, not bundled into feature work.
- `npm audit` shows a high-severity advisory in `deepmerge-ts` (a transitive dependency of Prisma's own CLI config resolution, not the runtime query path) — fix requires downgrading Prisma, so left alone; revisit alongside the Prisma major upgrade.
- The `"middleware"` file convention itself is now deprecated in Next 16 in favor of `"proxy"` — a cosmetic rename, not urgent, but will eventually require `npx @next/codemod@canary middleware-to-proxy .`.

## UX weaknesses

- No unified navigation information architecture — the admin sidebar is a flat (now module-grouped) list of every page, not the deeper Part 20-style hierarchy (Herd / Production / Reproduction / Health / etc. as top-level sections with their own sub-items).
- No empty-state guidance anywhere beyond "No X on record" text — none link to the relevant "add" action inline (Part 39).
- No loading skeletons — pages either render immediately (fast enough not to matter yet) or show nothing until the server component resolves.
- Raw error messages can leak in a couple of places (e.g., an uncaught Prisma error would show Next's default error overlay in dev) — no global error boundary with a friendly message + "log details server-side" pattern yet.

## What this audit is not saying

This is a real, working, currently-in-daily-use application for a real farm's real financial and herd data — not a prototype. Everything marked 🟢 has been built and verified end-to-end this session (not just reviewed as code) with real data, including catching and fixing two genuine bugs (a revenue double-count, a file-upload size-limit crash) before they shipped. The gaps listed above are accurate, but they're gaps against a very large target spec, not signs of a fragile foundation.
