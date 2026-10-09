# 12-month history load (Oct 2025 - Aug 2026)

Loaded on 9 Oct 2026 from `ALL/Charlie Dairy 2025.xlsx` (Oct-Dec 2025) and `ALL/Charlie Dairy 2026.xlsx` (Jan-Aug 2026).
September 2026 stays as entered in the app.

Run (from the repo root, with DATABASE_URL set):

    python scripts/history-load/extract_history.py          # read-only, writes history.json
    node scripts/history-load/history_load.js feed          # dry run; add --apply to write
    (same for: cash, milking, sales, usage)

Each stage refuses to run twice. A full backup was taken first: `backups/full-backup-2026-10-09T10-52-43-890Z.json`.

## What was loaded
| Stage | Rows | Marker (to find / undo them) |
|---|---|---|
| feed | 1,295 (replaced the 914 cost-less rows before 1 Sep 2026; Sep rows kept, cost added) | `notes` contains "History load" |
| cash | 190 (Oct-Dec 2025) | dated 2025-10-01..2025-12-31 |
| milking | 9,924 (+ cow 56 created as SOLD, to be confirmed) | `enteredBy = "History load (Excel)"` |
| sales | 1,465 | `enteredBy = "Backfill (cash ledger)"` (the app's existing marker: excluded from revenue, balances, AR) |
| usage | 991 | `enteredBy = "History load (Excel)"` |

Sales are litres = kg / 1.035; each buyer-month amount equals the workbook P&L line exactly.

## Undo
Delete rows by the markers above (feed: restore the old rows from the backup JSON), then delete cow 56 if desired.
