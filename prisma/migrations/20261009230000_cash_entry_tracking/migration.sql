-- Entry number, who recorded and who last edited each cash transaction.
ALTER TABLE "CashTransaction" ADD COLUMN "entryNo" SERIAL;
ALTER TABLE "CashTransaction" ADD COLUMN "createdById" TEXT;
ALTER TABLE "CashTransaction" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "CashTransaction" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Number the existing entries in the order they happened.
UPDATE "CashTransaction" t SET "entryNo" = r.rn
FROM (SELECT id, row_number() OVER (ORDER BY date, COALESCE(time, ''), "createdAt", id) AS rn FROM "CashTransaction") r
WHERE t.id = r.id;
SELECT setval(pg_get_serial_sequence('"CashTransaction"', 'entryNo'), (SELECT COALESCE(MAX("entryNo"), 1) FROM "CashTransaction"));

CREATE UNIQUE INDEX "CashTransaction_entryNo_key" ON "CashTransaction"("entryNo");

-- Link entries to the user account when the recorded name matches exactly one user.
UPDATE "CashTransaction" c SET "createdById" = u.id
FROM "User" u
WHERE c."createdById" IS NULL AND c."enteredBy" = u.name
  AND (SELECT COUNT(*) FROM "User" x WHERE x.name = u.name) = 1;
