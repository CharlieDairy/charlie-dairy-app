-- CreateEnum
CREATE TYPE "MilkUsageType" AS ENUM ('FARM_USE', 'EMPLOYEE_USE');

-- CreateTable
CREATE TABLE "MilkUsageRecord" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "MilkUsageType" NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilkUsageRecord_date_idx" ON "MilkUsageRecord"("date");
