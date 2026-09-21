# Charlie Dairy — Migration Reconciliation Report
Generated 2026-09-20T23:26:55.465119


## extract_cows
[cows] Cow Register tags: 85; Animal Summary tags: 49; merged total: 99
[cows] Tags in Cow Register but not in Animal Summary (no gender/calving data): 50
[cows] Ambiguous gender for an active lifecycle status (needs manual review): 2

## extract_milking
[milking] Parsed 11300 milking records (2025-09-01 to 2026-09-16)
[milking] Skipped 286 calving-event marker rows, 0 malformed rows

## extract_cash
[cash] Parsed 416 cash transactions from Cash book.xlsx (2026-01-01 to 2026-08-31)
[cash] CROSS-CHECK: Cash book.xlsx has 416 rows, last balance 23166.0. Cleaned.xlsx copy has 415 rows, last balance 23166.0.
[cash] ⚠ MISMATCH between the two copies — using Cash book.xlsx as source of truth. Verify with the user which file is actually the most recently updated before trusting cash figures.

## extract_feed
[feed] Parsed 1408 feed in/out transactions across 4 feed types (2025-03-01 to 2026-09-01)
[feed] Opening balances captured (not migrated as transactions, informational only): {'Silage': 42170.0, 'Wenda': 2.0, 'Turi': 10710.0, 'Fodder': 0.0}

## extract_capital
[capital] Capital.xlsx partner ledger (N-U table): 150 entries across ventures {'Fattening': 31, 'Dairy': 52, 'LOAN 22': 4, 'LOAN 23-1': 6, 'LOAN 23- 2': 18, 'LOAN 23- 3': 9, 'Phase 3.1': 7, 'Phase 3.2': 7, 'LOAN 24-1': 2, 'LOAN 24-2': 5, 'LOAN 25-1': 9}
[capital] Only 52 entries are tagged 'Dairy' specifically — the rest are other ventures (Fattening) or loan tranches shared by the same partner group. All are imported with the venture tag preserved; confirm with the user whether Charlie Dairy Farm reporting should filter to 'Dairy' only.
[capital] ⚠ Skipped the smaller 'PHASE 3 - Cash Flow - BANK' table (cols D-K, 12 rows) — its Mar 2024 entries appear to duplicate amounts already in the main ledger under venture 'Phase 3.1' (e.g. Abid Rs 1,140,000 appears in both). Verify with the user this table isn't recording something distinct.
[capital] BL.xlsx sub-ledgers (Agri Land Lease, Capital Investment - Maaz Khan, Agri Cost Recovery Acc from Charlie, Bank Account - Abid): 56 entries
[capital] ⚠ Note: BL.xlsx entries are GL-style account ledgers, not partner names — stored in the same 'partner' field as a simplification for Phase 1. Confirm with the user whether these should be split into a distinct accounts model later.
[capital] CROSS-CHECK Capital: Capital.xlsx has 150 rows, Cleaned.xlsx copy has 150 rows.
[capital] CROSS-CHECK BL Accounts: BL.xlsx has 56 rows, Cleaned.xlsx copy has 56 rows.

## extract_assets
[assets] Parsed 78 asset lines, total current value Rs 29,412,000
[assets] 2 lines had no 21/4/2025 value and fell back to the Feb '25 snapshot

