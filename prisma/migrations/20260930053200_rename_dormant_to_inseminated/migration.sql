-- Rename the CowStatus enum value DORMANT -> INSEMINATED in place.
-- This preserves every existing Cow row's status automatically (Postgres
-- updates all references to the enum value), unlike recreating the type,
-- which would fail to cast any existing 'DORMANT' row into a type that no
-- longer has that label.
ALTER TYPE "CowStatus" RENAME VALUE 'DORMANT' TO 'INSEMINATED';

ALTER TABLE "Cow" ALTER COLUMN "status" SET DEFAULT 'INSEMINATED';
