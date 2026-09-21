# Charlie Dairy — KPI Dictionary

One formula per KPI, defined once here, implemented once in `src/lib/`, and
referenced (not recalculated ad hoc) by every dashboard card and report
that shows it — per the Part 53 rule. Each entry states the source function
so this document can be checked against the actual code and never drifts
from it. **Implemented** KPIs are live today; **Target** KPIs are specified
here ahead of being built, per `docs/CHARLIE_V2_ARCHITECTURE.md`'s phased
plan, so their formula is settled before code exists.

---

## Implemented

### Milk / Cow / Day
- **Formula:** `SUM(litres) / COUNT(DISTINCT date)` for a cow within a period
- **Source:** `getHerdSummary()` in `src/lib/reports/herd.ts`; `getTopLowProducers()` in `src/lib/reports/milkAnalytics.ts`
- **Unit:** litres/day
- **Edge case:** producer ranking requires ≥5 recorded days to qualify, specifically to avoid one lucky/unlucky day skewing a ranking — a cow with fewer days is excluded from Top/Low Producers but still counted in herd totals

### Best Month
- **Formula:** `max(monthly litres)` across a calendar year, ties broken by first occurrence
- **Source:** `getBestMonth()` in `src/lib/reports/milkAnalytics.ts`
- **Unit:** litres

### Total Revenue / Total Expense / Net Income / Net Margin
- **Formula:** Revenue = `SUM(CashTransaction.amountIn) + SUM(MilkSale.amount WHERE enteredBy != 'Backfill (cash ledger)')`; Expense = `SUM(CashTransaction.amountOut)`; Net Income = Revenue − Expense; Net Margin = Net Income / Revenue
- **Source:** `getMonthlyPnl()` in `src/lib/reports/pnl.ts`, aggregated in `getDashboardSummary()` in `src/lib/reports/dashboard.ts`
- **Unit:** Rs / ratio
- **Edge case:** the backfilled-MilkSale exclusion exists specifically because that revenue is *also* counted via CashTransaction (same source cash rows) — including both would double-count. This was a real bug caught and fixed this session; any future revenue source must be checked against this exclusion before being added to the sum.

### Milk Sales Summary (Litres Sold / Revenue / Customers / Sale Records)
- **Formula:** Litres Sold = `SUM(MilkSale.litres)`; Revenue = `SUM(MilkSale.amount)` (all rows, unlike the P&L figure above); Customers = `COUNT(DISTINCT buyer WHERE buyer != 'Unknown')`
- **Source:** `getSalesSummary()` in `src/lib/reports/milkAnalytics.ts`
- **Unit:** litres / Rs / count
- **Edge case:** ~80% of backfilled historical MilkSale rows have `litres = 0` (revenue known, quantity never recorded in the original cash ledger) — Litres Sold is a real undercount for historical periods, disclosed in the dashboard UI itself, not just here.

### Production vs. Sold ("Unaccounted")
- **Formula:** `Produced (MilkingRecord.litres) − Sold (MilkSale.litres)` per month
- **Source:** `getProductionVsSold()` in `src/lib/reports/milkAnalytics.ts`
- **Unit:** litres
- **Edge case:** deliberately **not** labeled "in-house consumption" — nothing tracks calf consumption, wastage, or rejected milk separately yet, so the gap is genuinely unattributed. Full Part 11 reconciliation (produced − calf − withdrawal − rejected − farm consumption − wastage = saleable) needs those sub-components to exist as data first (Phase 2/4 of the architecture plan).

### Herd Composition (Milking vs. Non-Milking)
- **Formula:** Milking = `COUNT(Cow WHERE status='MILKING')`; Non-Milking = `COUNT(Cow WHERE status NOT IN ('MILKING','SOLD','DEAD'))`
- **Source:** `getHerdComposition()` in `src/lib/reports/milkAnalytics.ts`, consumed in `src/app/admin/page.tsx`
- **Unit:** count

### Days Open
- **Formula:** `conceptionDate (or today, if still open) − lastCalvingDate`, in days
- **Source:** `calcDaysOpen()` in `src/lib/breeding/rules.ts`
- **Unit:** days
- **Edge case:** returns `null` if the cow has no recorded calving (nothing to measure "open" from)

### Expected Calving Date
- **Formula:** `inseminationDate + gestationDays` (default 280, configurable in `BREEDING_CONFIG`)
- **Source:** `calcExpectedCalvingDate()` in `src/lib/breeding/rules.ts`

### Expected Dry-Off Date
- **Formula:** `expectedCalvingDate − dryOffDaysBeforeCalving` (default 60, configurable)
- **Source:** `calcExpectedDryOffDate()` in `src/lib/breeding/rules.ts`

### Conception Rate
- **Formula:** `pregnantChecks / (pregnantChecks + openChecks)` — all-time, not period-scoped
- **Source:** `getBreedingKpis()` in `src/lib/reports/breeding.ts`
- **Unit:** %
- **Edge case:** excludes `INCONCLUSIVE` results from the denominator by design (an inconclusive check answers nothing about conception)

### Services per Conception
- **Formula:** `totalInseminations / pregnantChecks` (all-time)
- **Source:** `getBreedingKpis()` in `src/lib/reports/breeding.ts`
- **Unit:** ratio

### Service Number (per insemination)
- **Formula:** `COUNT(prior inseminations for this cow since her last calving) + 1`
- **Source:** inline in `recordInsemination()`, `src/app/entry/breeding/ai/actions.ts`

### Calving Interval
- **Formula:** `currentCalvingDate − previousCalvingDate`, in days
- **Source:** `calcCalvingIntervalDays()` in `src/lib/breeding/rules.ts`
- **Status:** function exists but is not yet called from any report — no page currently surfaces this number. Flagged for Phase 9 (Reproduction Dashboard).

### Age (from Date of Birth)
- **Formula:** `(today − dateOfBirth) / 365.25`, shown in months if <1 year else years to 1dp
- **Source:** `ageFromDob()`, duplicated in `src/app/admin/cows/page.tsx` and `src/app/admin/cows/[id]/page.tsx`
- **Tech debt:** this duplication should move to `src/lib/` when either file is next touched, per the "extend, don't duplicate" principle — noted here so it isn't lost.

---

## Target (specified, not yet implemented — see architecture doc Phase column)

### Feed Efficiency — Phase 5
- **Formula:** `Milk Produced (litres) / Dry Matter Intake (kg)`
- **Inputs needed:** Ration.dryMatterPct × FeedingRecord.actualQty, per group per day
- **Unit:** L milk / kg DM

### Feed Cost / Litre — Phase 5
- **Formula:** `Total Feed Cost / Total Milk Produced` for a period
- **Inputs needed:** FeedingRecord cost rollup ÷ MilkingRecord sum (MilkingRecord already exists)

### Income Over Feed Cost (IOFC) — Phase 5/6
- **Formula:** `Milk Revenue − Feed Cost`, per cow per day
- **Inputs needed:** Feed cost allocation (Phase 5) + milk price (already have via MilkSale.rate or a configured default)

### Cow Contribution Margin — Phase 6
- **Formula:** `(Milk Revenue + Calf Revenue + Other Animal Revenue) − (Feed + Health + Medicine + Breeding + Allocated Labor + Allocated Overhead)`, per cow per period, plus a lifetime cumulative view
- **Inputs needed:** AnimalCostAllocation table (architecture doc §4), which itself needs Phase 2 (Health costs) and Phase 5 (Feed costs) to have real numbers

### Pregnancy Rate — Phase 9 (Reproduction Dashboard)
- **Formula:** `21-day cycles with a pregnancy confirmed / total eligible cow-cycles` — the standard dairy-industry definition, distinct from Conception Rate above (which is per-check, not per-cycle)
- **Note:** deliberately not implemented as a naive reuse of Conception Rate — they answer different questions and conflating them would misrepresent herd reproductive performance

### First-Service Conception Rate — Phase 9
- **Formula:** `Pregnant results WHERE the linked insemination.serviceNumber = 1 / total first-service inseminations`

### Repeat Breeder Flag — Phase 9
- **Formula:** cow flagged if `serviceNumber ≥ 4` with no confirmed pregnancy (threshold configurable, matching the pattern already used for gestation/dry-off days in `BREEDING_CONFIG`)

### Calf Mortality Rate — Phase 4
- **Formula:** `COUNT(Calf WHERE outcome IN ('STILLBORN','DIED_WITHIN_24H')) / COUNT(Calf)` for a period
- **Note:** the `Calf.outcome` field already exists (used at calving entry) — this KPI is a query away once the Calf dashboard is built, not a schema change

### Average Daily Gain (ADG) — Phase 4
- **Formula:** `(latest WeightRecord.weight − birthWeight) / days since birth`
- **Inputs needed:** WeightRecord table (doesn't exist yet)

### Vaccination Compliance — Phase 3
- **Formula:** `COUNT(Vaccination WHERE status='Completed' AND dueDate in period) / COUNT(Vaccination due in period)`

### Milk Withdrawal Status — Phase 2
- **Formula:** `today ≤ (lastTreatmentDate + medicine.milkWithdrawalDays)` → animal is under withdrawal
- **Critical rule:** any MilkingRecord created for a cow under withdrawal must be flagged non-saleable automatically at entry time, not computed after the fact — this is a data-integrity guard, not just a reporting KPI (Part 4.3's explicit requirement)

### Herd Forecast (30/60/90/180/365 day) — Phase 11
- **Formula:** projected lactating count = current lactating − expected dry-offs (from `expectedDryOffDate` already computed) + expected fresh cows (from `expectedCalvingDate` already computed) over the window; projected milk = projected lactating × trailing herd avg L/cow/day
- **Note:** both underlying dates already exist in the Cow model — this is aggregation, not new tracked data, and could move up in priority once Phase 9's Reproduction Dashboard exists to validate the inputs visually first
