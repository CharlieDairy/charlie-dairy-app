-- One milk record per cow per shift per day. Checked first: the live data holds no duplicates.
-- Rows without a cow (herd/group totals) are not affected, because NULLs never clash in a unique index.
CREATE UNIQUE INDEX "MilkingRecord_cowId_date_shift_key" ON "MilkingRecord"("cowId", "date", "shift");
