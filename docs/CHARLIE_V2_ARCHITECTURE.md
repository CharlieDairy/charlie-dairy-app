# Charlie Dairy V2 — Architecture

Companion to `docs/CURRENT_SYSTEM_AUDIT.md` (read that first — this document
assumes it). Supersedes the "Immediate next module" framing in
`docs/ROADMAP.md`, which stays as the historical record of Phases 1–3;
from here on this document is the roadmap.

## 1. Current state (summary — see audit for detail)

Real, working, single-farm SQLite/Next.js app. Strong foundation: auth +
module-based RBAC, automatic audit logging, breeding lifecycle with correct
business-rule transactions, finance reconciled against source data, Bulk
Data CSV engine, Master Data config pattern. Zero automated tests. No
Health/Medicine/Vaccination, no Inventory/Procurement, no Animal P&L, no
Tasks/Alerts/Calendar, no reusable DataTable or design system, no
multi-farm scoping.

## 2. Target architecture

**Principle: evolve, don't rewrite.** Every module below is additive to
the existing schema and page structure. Nothing in the audit's 🟢 list gets
replaced without a documented reason (Part 42's "never destroy" rule
extends to code, not just data).

### 2.1 Module map (target)

```
HERD           Animals · Groups (new) · Movements (new)
PRODUCTION     Milk · Milk Sales · Milk Reconciliation
REPRODUCTION   Breeding · Pregnancy · Calving · Dry-Off (new workflow)
HEALTH         Health Cases (new) · Treatments (new) · Vaccination (new) · Medicines (new)
CALF           Calf workspace (extends existing Calf model)
NUTRITION      Feed · Rations (new) · Feeding (new) · Feed Efficiency (new)
SUPPLY CHAIN   Inventory (new) · Procurement (new) · Suppliers (new)
FINANCE        Cash · Capital · P&L · Cash Flow · Animal P&L (new)
OPERATIONS     Tasks (new) · Employees (new) · Assets · Maintenance (new)
INTELLIGENCE   Analytics (new) · Exceptions (new) · Alerts (new) · Reports
ADMIN          Master Data · Users · Audit · Settings
```

### 2.2 Farm Command Center

Replaces today's dashboard as the default `/admin` landing page. Built in
three layers, not 20 equal cards (Part 16):

- **Level 1** (always visible, top of page): Milk Today, Milk/Cow, Animals
  Requiring Attention (count, clickable → filtered list), Revenue, Estimated
  Margin.
- **Level 2**: herd status strip — Lactating / Pregnant / Dry / Sick / Calves,
  each a clickable count.
- **Level 3**: the existing charts (yearly milk, herd composition,
  production-vs-sold) plus a new "Action Required" section — see §7 Alert
  Model. Every card in Level 2/3's action section links to a filtered list,
  never a dead end (Part 15's explicit requirement).

### 2.3 Design system

Add CSS variables to `globals.css` (not a new dependency — Tailwind v4
already reads CSS custom properties natively via `@theme`):

```css
--color-primary: #15803d;      /* existing green-700, now tokenized */
--color-primary-dark: #166534;
--color-surface: #ffffff;
--color-background: #f5f5f4;
--color-border: #e5e5e4;
--color-text: #171717;
--color-text-muted: #737373;
--color-success: #15803d;
--color-warning: #b45309;      /* new — nothing uses amber yet */
--color-danger: #dc2626;
--color-info: #2563eb;         /* new — nothing uses blue yet */
```

Then extract the repeated card/button/table patterns already used
consistently across ~15 pages into real components: `Card`, `Button`,
`Badge` (for status/severity — text+icon, never color alone, per Part 56),
`PageHeader`. This is refactoring existing markup into components, not
introducing a new look.

### 2.4 Reusable DataTable

One component, `src/components/DataTable.tsx`, generic over row type:
search box, column sort, client-side filter chips (server-side pagination
once a table exceeds ~500 rows — Cow Register and Assets don't need it yet
at ~100 rows each, Audit Log already has its own server-paginated pattern
worth generalizing into this component). Every future list page uses it;
existing list pages migrate opportunistically when touched for other
reasons, not in a single disruptive pass.

## 3. Gap analysis (priority-ordered, matches the spec's own P0/P1/P2)

| Priority | Module | Why this order |
|---|---|---|
| P0 | Health / Treatment / Withdrawal | Biggest missing piece; milk-withdrawal safety (never sell restricted milk) is a real risk today since nothing tracks it |
| P0 | Alerts + Farm Command Center action section | Everything else P0 needs somewhere to surface "needs attention today" |
| P0 | Calf workspace completion | Extends an existing model; high value, low schema risk |
| P1 | Feed rations + efficiency | Needs Feed Material master data first (Master Data pattern already supports this) |
| P1 | Animal P&L | Needs Health module's cost data to be meaningful; sequence after Health |
| P1 | Inventory | Needed before Procurement can mean anything (can't receive against a PO into nothing) |
| P1 | Tasks | Needed before Maintenance/Procurement approval workflows are useful |
| P2 | Procurement, Suppliers | Full PR→PO→GRN flow — real scope, sequence last of the P1/P2 boundary |
| P2 | Maintenance | Asset register already exists; work-order tracking is additive |
| P2 | Analytics Center, Exception Management, Performance Matrix, Forecast | Needs real historical data in the P0/P1 modules first — building analytics before the underlying data exists produces empty charts |
| P2 | Mobile optimization, QR/RFID, Offline | Architecture-ready (see §8), not built |

## 4. ERD (target additions)

Existing entities (Cow, HeatEvent, Insemination, PregnancyCheck, Calving,
Calf, MilkingRecord, MilkSale, FeedTransaction, CashTransaction,
CapitalEntry, Asset, MasterDataItem, User, ModuleAccess, AuditLog) are
unchanged. New:

```
Cow ──< HealthCase >── Treatment >── MedicineInventoryTxn
Cow ──< Vaccination >── VaccineProtocol
Cow ──< WeightRecord
Cow ──< BcsRecord
Cow ──< Lactation >── (backfills DIM/peak-yield queries that today
                        infer from lastCalvingDate)

FeedMaterial ──< RationIngredient >── Ration ──< FeedingRecord
InventoryItem ──< InventoryTransaction (goods receipt / issue / adjustment)
Supplier ──< PurchaseOrder ──< PurchaseOrderLine
PurchaseRequisition ──< PurchaseOrder

Employee ──< Task
Task ── polymorphic link to Cow/Asset/PurchaseOrder (nullable FK per type,
         not a generic polymorphic table — SQLite/Prisma don't do
         polymorphic FKs cleanly; a Task has at most one of cowId/assetId/
         purchaseOrderId set)

Alert (category, severity, entity, entityId, status, assignedTo, resolvedBy)
Asset ──< MaintenanceWorkOrder

AnimalCostAllocation (period, cowId, feedCost, healthCost, breedingCost,
                       allocatedLabor, allocatedOverhead) — computed/cached
                       table, not user-entered; rebuilt by a scheduled job
                       once volume makes live computation too slow
```

Full Prisma schema diffs are written per-phase (see §9), not all at once —
each phase's `db push` is reviewed and tested before the next phase starts,
per the existing session pattern (backup before every schema change).

## 5. Database changes — principles

- Every new model follows the existing conventions: `cuid()` PK, `createdAt`
  (and `updatedAt` where records are mutable), indexes on `date` and the
  main FK, enums for closed vocabularies backed by a `MasterDataItem`
  category where the vocabulary should be admin-configurable (disease list,
  vaccine list, feed material categories — per Part 4.2's explicit "never
  hard-code" instruction).
- No destructive migrations. `prisma db push` only adds columns/tables;
  anything that would need `--force-reset` gets a manual, reviewed SQL
  migration instead (this already happened once this session — the
  `Asset.updatedAt` addition needed a default specifically to avoid this).
- Farm-scoping columns (`farmId`) are **not** added speculatively. If/when
  a second farm is real, that's a dedicated migration phase of its own
  (schema change touching every table) — not threaded through every other
  phase "just in case."

## 6. RBAC extension

The existing module system (`src/lib/modules.ts`) extends by adding
modules, not by replacing the pattern: `HEALTH`, `NUTRITION`,
`SUPPLY_CHAIN`, `OPERATIONS_TASKS` as grantable modules alongside the
current four, each mapped to their new route prefixes. Role-based dashboard
views (Part 38 — Owner/Manager/Vet/Breeding Tech/Storekeeper/Finance/Worker)
are a **view-layer** concern: same data, different default landing page and
which Command Center cards are emphasized, driven by the user's granted
modules rather than a new hard-coded role enum. A vet with only `HEALTH`
granted naturally lands on a health-focused view because that's the only
section their nav shows — no separate "vet dashboard" code path needed.

## 7. Event model (Part 44)

Two patterns already exist and extend directly:

1. **Prisma extension side effects** (`src/lib/prisma.ts`) — already
   intercepts every write for audit logging. Business-rule side effects
   (calving → close pregnancy → create calf → increment lactation) are
   currently hand-coded in each server action's `$transaction` block
   (e.g. `src/app/entry/breeding/calving/actions.ts`), **not** in the
   extension — kept explicit and readable rather than "magic," since these
   are meaningful business decisions, not generic logging. New event chains
   follow the same pattern:

   - `TreatmentRecorded` → deduct medicine inventory, compute withdrawal
     dates, flag animal, restrict milk, schedule next dose — all in one
     `$transaction`, same shape as the existing calving action.
   - `CalvingRecorded` already does its chain; extend it to also create a
     fresh-cow health check task once Tasks exist.

2. Each action stays a single, testable, transactional function. No
   separate "event bus" — the codebase is small enough that indirection
   would cost more than it buys, and the audit log already gives full
   before/after visibility without one.

## 8. Alert model (Part 28)

New `Alert` table, populated two ways:

- **Computed on read** for anything derivable from existing data with a
  simple query (pregnancy check due, dry-off due, vaccination due) — no
  need to materialize these, they're cheap `WHERE` clauses against small
  tables at current scale.
- **Written on event** for anything that needs a human decision trail
  (assigned/acknowledged/resolved) — health flags, low-stock, maintenance
  overdue.

Severity (CRITICAL/WARNING/INFO) and category map directly to the module
system, so an alert's visibility follows the same RBAC as its source data.

## 9. Migration / implementation plan

Each phase: schema change (if any) → server actions/lib functions → pages →
manual verification against the running app with real interactions (per
this session's established pattern — not just `tsc`/lint/build, actual
browser clicks, since that's what caught the two real bugs found this
session) → commit → move on. One phase fully done before the next starts.

| Phase | Scope | Depends on |
|---|---|---|
| 0 | This audit + architecture doc (done) | — |
| 1 | Design tokens, `Card`/`Button`/`Badge` components, DataTable, Command Center layout (Level 1/2/3) | — |
| 2 | Health: HealthCase, Treatment, Medicine inventory, withdrawal calc + milk-entry guard | Master Data (disease/medicine categories) |
| 3 | Vaccination: protocols, schedule, compliance status | Phase 2's Medicine model |
| 4 | Calf workspace: colostrum, feeding log, weaning, ADG, calf dashboard | Existing Calf model |
| 5 | Feed: FeedMaterial master, Ration, Feeding vs. plan variance, feed efficiency | Master Data |
| 6 | Animal P&L: cost allocation from Health/Feed/Breeding, contribution margin | Phases 2 and 5 |
| 7 | Inventory: stock levels, batch/expiry, FEFO, low-stock | — |
| 8 | Procurement + Suppliers: PR→PO→GRN→Invoice | Phase 7 |
| 9 | Tasks + Alerts + Calendar | Phases 2–8 give alerts something real to surface |
| 10 | Maintenance (extends existing Asset model) | — |
| 11 | Analytics: exception list, performance matrix, forecast | Needs real data from 2–9 |
| 12 | Mobile pass, QR generation, security hardening (rate limiting — the one concrete gap from the audit), performance pass, backup documentation |

This is deliberately more conservative than the spec's 12-phase outline in
one way: **Phase 1 here is scoped to just the design system + DataTable +
Command Center shell**, not also "Animal 360 rebuild" — the existing cow
profile page (audit: 🟡, real gaps but functional) gets its missing tabs
(Health, Financial, Weight/BCS) filled in incrementally as those modules
land in Phases 2–6, rather than rebuilt speculatively before that data
exists to show.

## 10. Testing strategy

No framework exists today (audit finding). Adding one is Phase 1 work, not
a separate initiative: Vitest (fastest setup with Next.js + Turbopack, no
Babel config needed) for business-rule unit tests (breeding date
calculations, withdrawal date calculations, P&L aggregation) — the kind of
pure-function logic already isolated in `src/lib/*`. Browser-based
verification (as done all session via the Claude Browser tools) remains
the primary check for actual user flows; unit tests target the calculation
logic those flows depend on, where a regression would be silent otherwise.

## 11. Deployment strategy

Unchanged from `docs/DEPLOYMENT.md` (Vercel + Postgres migration path,
already fully documented with working export/import scripts). No new
deployment concerns from this architecture beyond: asset photo storage
(`src/lib/uploadImage.ts`, local disk) must move to Vercel Blob or S3
before a serverless deploy — already flagged in the audit and in that
script's own comments.

## 12. Risks

- **Scope creep.** This spec is enormous (60 parts). The phased plan above
  is the guardrail — each phase ships and gets used before the next starts,
  so if priorities shift, only the current phase's work is at risk, not a
  half-finished sprawl across all 12.
- **SQLite ceiling.** Inventory + Procurement + Tasks all add write volume.
  Revisit the Postgres migration trigger (already documented in
  `docs/ROADMAP.md`) after Phase 8, not before — premature migration is its
  own risk (see next point).
- **Data integrity during backfill-style features.** This session already
  hit two real bugs from working with historical data (a revenue
  double-count, a plausible-looking-but-wrong file limit) — both caught by
  actually testing, not by code review alone. Every phase that touches
  financial or health data gets the same treatment: real verification
  through the running app, not just green checkmarks from `tsc`/lint/build.

## 13. KPI Dictionary

See `docs/KPI_DICTIONARY.md` — every formula that powers a dashboard card
or report is defined there once and referenced, per Part 53's "one formula
source should power both dashboards and reports" rule. Existing KPIs
(already implemented, documented retroactively) and target KPIs (not yet
implemented, specified before building) are both included, clearly marked.
