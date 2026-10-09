# Receipts and revenue fix (9 Oct 2026)

One-off data steps behind the cash-basis accounting change (code: `src/lib/accounting/cashClass.ts`, `src/lib/reports/pnl.ts`).

- `cashbook_import.js` - added the 533 CashBook entries (Jan-Sep 2025, 19 Sep - 8 Oct 2026) the app was missing. Expects `cb_rows.json`
  (the CashBook export parsed to rows, 2025 onward). Marker: cash entries with `account = "CashBook 09-10-2026"`.
- `link_receipts.js` - attached a CustomerPayment to each of the 11 milk receipts since 1 Sep 2026 (no new cash rows).
  City Sale = the lump "Cash Recived milk sale dd to dd" receipts (they equal City's bill for the period); the rest by customer name in the remark.
- An "Opening Balance" cash entry of Rs -9,460 dated 2025-01-01 (CashBook balance at 31 Dec 2024) makes the app's cash equal the CashBook balance.

Backups taken before each step: `backups/full-backup-2026-10-09T12-04-15-363Z.json` (before the CashBook import).
Undo the receipt links by deleting CustomerPayment rows whose `enteredBy` is "Receipt linking (9 Oct 2026)".
