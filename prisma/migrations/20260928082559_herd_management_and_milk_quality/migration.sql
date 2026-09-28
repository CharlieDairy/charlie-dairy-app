-- AlterTable
ALTER TABLE "Cow" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "purchasePrice" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "MilkingRecord" ADD COLUMN     "fatPct" DOUBLE PRECISION,
ADD COLUMN     "snfPct" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CowMovement" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CowMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeightRecord_cowId_idx" ON "WeightRecord"("cowId");

-- CreateIndex
CREATE INDEX "WeightRecord_date_idx" ON "WeightRecord"("date");

-- CreateIndex
CREATE INDEX "CowMovement_cowId_idx" ON "CowMovement"("cowId");

-- CreateIndex
CREATE INDEX "CowMovement_date_idx" ON "CowMovement"("date");

-- AddForeignKey
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CowMovement" ADD CONSTRAINT "CowMovement_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
