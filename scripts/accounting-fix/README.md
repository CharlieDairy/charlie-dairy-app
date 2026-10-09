# Receipts and revenue fix (9 Oct 2026)

One-off data steps behind the cash-basis accounting change (code: `src/lib/accounting/cashClass.ts`, `src/lib/reports/pnl.ts`).

- `cashbook_import.js` - added the 533 CashBook entries (Jan-Sep 2025, 19 Sep - 8 Oct 2026) the app was missing. Expects `cb_rows.json`
  (the CashBook export parsed to rows, 2025 onward). Marker: cash entries with `account = "CashBook 09-10-2026"`.
- `link_receipts.js` - attached a CustomerPayment to each of the 11 milk receipts since 1 Sep 2026 (no new cash rows).
  City Sale = the lump "Cash Recived milk sale dd to dd" receipts (they equal City's bill for the period); the rest by customer name in the remark.
- An "Opening Balance" cash entry of Rs -9,460 dated 2025-01-01 (CashBook balance at 31 Dec 2024) makes the app's cash equal the CashBook balance.

Backups taken before each step: `backups/full-backup-2026-10-09T12-04-15-363Z.json` (before the CashBook import).
Undo the receipt links by deleting CustomerPayment rows whose `enteredBy` is "Receipt linking (9 Oct 2026)".

## Second step (9 Oct 2026): 2024 petty cash + Meezan bank account
- `cashbook_2024_import.js` - added the 518 petty-cash entries for Mar-Dec 2024 (marker `account = "CashBook 09-10-2026 (2024)"`) and removed the temporary 1 Jan 2025 opening row.
- `bank_import.ts` - added the Meezan Bank Account book from 1 Mar 2024 to 31 Jul 2025 (150 entries + an opening bank balance of Rs 1,181,479;
  marker `account = "CashBook Meezan 09-10-2026"`, mode BANK) and marked the 15 petty-cash "Cash from Company" receipts that are the other side of a bank transfer as class TRANSFER.
  Source export: `Meezan Bank Account 09-10-2026@CashBook.csv` (CashBook > Reports > Excel Report).
- Backups: `full-backup-2026-10-09T12-28-58-980Z.json` (before 2024), `full-backup-2026-10-09T12-39-24-935Z.json` (before the bank book).
