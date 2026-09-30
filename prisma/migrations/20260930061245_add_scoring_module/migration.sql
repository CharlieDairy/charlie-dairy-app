-- CreateEnum
CREATE TYPE "ScoringFactorKey" AS ENUM ('VACCINATION_COMPLIANCE', 'TREATMENT_FREQUENCY', 'HEALTH_RECENCY');

-- CreateEnum
CREATE TYPE "HealthScheduleType" AS ENUM ('VACCINATION', 'DEWORMING', 'CHECKUP');

-- CreateEnum
CREATE TYPE "ProductionTargetType" AS ENUM ('MILK_DAILY', 'WEIGHT');

-- CreateTable
CREATE TABLE "ScoringFactor" (
    "id" TEXT NOT NULL,
    "key" "ScoringFactorKey" NOT NULL,
    "label" TEXT NOT NULL,
    "weightPct" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HealthScheduleType" NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTarget" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "type" "ProductionTargetType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoringFactor_key_key" ON "ScoringFactor"("key");

-- CreateIndex
CREATE INDEX "ProductionTarget_cowId_idx" ON "ProductionTarget"("cowId");

-- AddForeignKey
ALTER TABLE "ProductionTarget" ADD CONSTRAINT "ProductionTarget_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default scoring weights (must sum to 100)
INSERT INTO "ScoringFactor" ("id", "key", "label", "weightPct", "updatedAt") VALUES
  ('scoringfactor_vaccination', 'VACCINATION_COMPLIANCE', 'Vaccination Compliance', 40, CURRENT_TIMESTAMP),
  ('scoringfactor_treatment', 'TREATMENT_FREQUENCY', 'Treatment Frequency', 30, CURRENT_TIMESTAMP),
  ('scoringfactor_recency', 'HEALTH_RECENCY', 'Health Check Recency', 30, CURRENT_TIMESTAMP);
