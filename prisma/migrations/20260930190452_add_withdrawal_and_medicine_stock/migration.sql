-- CreateEnum
CREATE TYPE "MedicineStockDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "MedicineDef" ADD COLUMN     "reorderLevel" DOUBLE PRECISION,
ADD COLUMN     "withdrawalDays" INTEGER;

-- AlterTable
ALTER TABLE "TreatmentRecord" ADD COLUMN     "quantityUsed" DOUBLE PRECISION,
ADD COLUMN     "withdrawalUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MedicineStockTransaction" (
    "id" TEXT NOT NULL,
    "medicineDefId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "direction" "MedicineStockDirection" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineStockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicineStockTransaction_medicineDefId_idx" ON "MedicineStockTransaction"("medicineDefId");

-- CreateIndex
CREATE INDEX "MedicineStockTransaction_date_idx" ON "MedicineStockTransaction"("date");

-- CreateIndex
CREATE INDEX "TreatmentRecord_withdrawalUntil_idx" ON "TreatmentRecord"("withdrawalUntil");

-- AddForeignKey
ALTER TABLE "MedicineStockTransaction" ADD CONSTRAINT "MedicineStockTransaction_medicineDefId_fkey" FOREIGN KEY ("medicineDefId") REFERENCES "MedicineDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
