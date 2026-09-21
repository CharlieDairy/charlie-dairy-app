# Charlie Dairy — Roadmap (Evolve, Don't Rewrite)

This document reconciles the full "enterprise DFMS" vision with the real, running
application in this repo. Direction chosen 2026-09-21: **evolve the existing app
module-by-module**, keep the current stack, keep real data intact.

## Current state (baseline, committed as `Initial commit`)

- **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind v4, Prisma 6 on **SQLite**
  (`prisma/dev.db`), NextAuth v5 (beta, JWT sessions, credentials login).
- **Roles**: `ADMIN`, `ENTRY` (enforced in `src/middleware.ts`). Single farm, single tenant.
- **Data model**: `User`, `Cow`, `MilkingRecord`, `MilkSale`, `FeedTransaction`,
  `CashTransaction`, `CapitalEntry`, `Asset`.
- **UI**: `/admin/*` (cow register, capital ledger, assets, P&L / cashflow / herd /
  reconciliation reports) and `/entry/*` (milking, cash, feed, milk-sale data entry).
- **Data pipeline**: `scripts/migrate/*.py` extracts the real Excel books in
  `Desktop\Charlie` (Cow master, Cash book, Capital, BS_Capital, etc.) into
  `scripts/migrate/output/*.json`, which `prisma/seed.ts` loads into the DB.
- **Gaps vs. the full DFMS spec**: no breeding/reproduction, no health/treatment/
  withdrawal, no vaccination, no feed rations/forecasting, no procurement/inventory,
  no multi-farm/org hierarchy, no audit trail, no alert engine.

## Why evolve instead of rewrite

The current app already runs on real farm data (real cows, real cash, real capital).
A ground-up rewrite (Postgres, multi-tenant org/farm hierarchy, full RBAC, Docker) would
mean re-migrating live data and re-validating financial reports before they could be
trusted again. Instead, each phase below adds tables/pages on top of the existing schema,
following the conventions already in place (Prisma + server actions + `useActionState`
forms + Tailwind neutral/green theme). SQLite is fine at this farm's scale (spec targets
10,000+ animals / multi-farm; this is a single farm); a Postgres migration is deferred
until multi-farm or concurrent-write load actually requires it — see "Future rewrite
triggers" below.

## Phased roadmap (adapted from the master spec's 12 phases)

| Phase | Scope | Status |
|---|---|---|
| 1 — Foundation | Auth, roles, master data | **Done** (lean: 2 roles, single farm) |
| 2 — Herd | Animal register, status | **Done** (`Cow` model, `/admin/cows`) |
| 3 — Reproduction | Heat, AI, pregnancy check, calving | **In progress (this session)** |
| 4 — Milk | Milk recording, sales | **Done** (basic; no quality/lactation curves yet) |
| 5 — Health | Disease, treatment, medicine, withdrawal | Not started |
| 6 — Feed | Rations, forecasting, feed economics | Partial (feed in/out only, no rations) |
| 7 — Supply chain | Inventory, procurement, suppliers | Not started |
| 8 — Finance | Revenue/expense, animal profitability | Partial (cash/capital/assets/P&L done; no per-animal profitability) |
| 9 — Operations | Employees, tasks, maintenance | Not started |
| 10 — Intelligence | Dashboards, alerts, analytics | Partial (dashboard + reports exist; no alert engine) |
| 11 — Integration | RFID/IoT/notifications | Not started |
| 12 — Hardening | Tests, audit trail, backup, multi-farm | Not started |

## Immediate next module: Breeding & Reproduction (Phase 3)

Extends `Cow` (which already has `lastCalvingDate`, `nextAiDate`, `dryDate`,
`expectedCalving` — these fields were anticipated but never populated by real events).

New models: `HeatEvent`, `Insemination`, `PregnancyCheck`, `Calving`, `Calf`.
New `Cow.lactationNumber` field, bumped on each calving.

Business rules implemented (configurable in `src/lib/breeding/rules.ts`):
- Expected calving date = insemination date + gestation period (default 280 days)
- Expected dry-off date = expected calving date − dry period (default 60 days)
- Voluntary waiting period after calving = 60 days (informational, not yet enforced as a hard gate)
- A calving event closes the pregnancy (clears `expectedCalving`/`dryDate`), sets
  `lastCalvingDate`, increments `lactationNumber`, and creates `Calf` record(s)
- Data integrity: heat/AI/pregnancy events require `gender = FEMALE` and status not in
  `SOLD`/`DEAD`

Deferred from the full spec for this increment (documented, not forgotten):
- Separate `Lactation` entity with DIM/persistency/lactation curve — `lactationNumber`
  is tracked but full lactation-cycle modeling comes with the Milk module rework
- Embryo transfer / natural service detail beyond a method tag
- Hard enforcement of voluntary waiting period as a UI gate (shown as information only)
- Multiple calves per calving get one detailed record; extras go in freeform notes for now

## Future rewrite triggers (revisit "evolve vs rewrite")

Reconsider Postgres + multi-farm/org hierarchy when any of these become true:
- A second physical farm needs to be managed in the same system
- Concurrent multi-user writes start hitting SQLite's single-writer contention
- Animal count approaches the low thousands and report queries start reading full tables into Node

## Assumptions log

- Gestation period: 280 days (Holstein/Friesian-typical; adjust per breed if needed later)
- Dry period: 60 days
- Currency: PKR (existing `formatRs` helper) — matches Pakistan-based farm
- No changes made to financial modules in this pass; breeding module is additive only
