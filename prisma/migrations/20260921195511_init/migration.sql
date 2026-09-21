-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ENTRY');

-- CreateEnum
CREATE TYPE "ModuleName" AS ENUM ('OPERATIONS', 'FINANCIAL', 'PEOPLE', 'ADMIN');

-- CreateEnum
CREATE TYPE "CowGender" AS ENUM ('FEMALE', 'MALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CowStatus" AS ENUM ('MILKING', 'DRY', 'HEIFER', 'CALF', 'DORMANT', 'SOLD', 'DEAD');

-- CreateEnum
CREATE TYPE "HeatDetectionMethod" AS ENUM ('VISUAL', 'ACTIVITY_MONITOR', 'TAIL_PAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "BreedingMethod" AS ENUM ('AI', 'NATURAL', 'EMBRYO_TRANSFER');

-- CreateEnum
CREATE TYPE "PregnancyResult" AS ENUM ('PREGNANT', 'OPEN', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "PregnancyCheckMethod" AS ENUM ('PALPATION', 'ULTRASOUND', 'BLOOD_TEST', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "CalvingDifficulty" AS ENUM ('UNASSISTED', 'EASY_PULL', 'HARD_PULL', 'VET_ASSISTED', 'CAESAREAN');

-- CreateEnum
CREATE TYPE "CalfOutcome" AS ENUM ('ALIVE', 'STILLBORN', 'DIED_WITHIN_24H');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "FeedDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashMode" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "CapitalEntryType" AS ENUM ('CONTRIBUTION', 'WITHDRAWAL', 'LOAN', 'REPAYMENT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "ModuleName" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cow" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "gender" "CowGender" NOT NULL DEFAULT 'UNKNOWN',
    "status" "CowStatus" NOT NULL DEFAULT 'DORMANT',
    "condition" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "lastCalvingDate" TIMESTAMP(3),
    "nextAiDate" TIMESTAMP(3),
    "dryDate" TIMESTAMP(3),
    "expectedCalving" TIMESTAMP(3),
    "targetSellDate" TIMESTAMP(3),
    "lactationNumber" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeatEvent" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "detectionMethod" "HeatDetectionMethod" NOT NULL DEFAULT 'VISUAL',
    "intensity" TEXT,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insemination" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "heatEventId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "method" "BreedingMethod" NOT NULL DEFAULT 'AI',
    "semenBatch" TEXT,
    "bullTag" TEXT,
    "technician" TEXT,
    "serviceNumber" INTEGER NOT NULL DEFAULT 1,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insemination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregnancyCheck" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "inseminationId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "method" "PregnancyCheckMethod" NOT NULL DEFAULT 'PALPATION',
    "result" "PregnancyResult" NOT NULL,
    "notes" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PregnancyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calving" (
    "id" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "inseminationId" TEXT,
    "sireTag" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "gestationDays" INTEGER,
    "difficulty" "CalvingDifficulty" NOT NULL DEFAULT 'UNASSISTED',
    "assistedBy" TEXT,
    "retainedPlacenta" BOOLEAN NOT NULL DEFAULT false,
    "complications" TEXT,
    "calfCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calf" (
    "id" TEXT NOT NULL,
    "calvingId" TEXT NOT NULL,
    "cowId" TEXT,
    "sex" "CowGender" NOT NULL DEFAULT 'UNKNOWN',
    "outcome" "CalfOutcome" NOT NULL DEFAULT 'ALIVE',
    "birthWeight" DOUBLE PRECISION,
    "tag" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkingRecord" (
    "id" TEXT NOT NULL,
    "cowId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "shift" "Shift" NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkSale" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "buyer" TEXT NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION,
    "fatPct" DOUBLE PRECISION,
    "snf" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" "CashMode" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "cashTransactionId" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "feedType" TEXT NOT NULL,
    "direction" "FeedDirection" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "account" TEXT,
    "party" TEXT,
    "category" TEXT NOT NULL,
    "mode" "CashMode" NOT NULL DEFAULT 'CASH',
    "amountIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enteredBy" TEXT,
    "projectLand" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "partner" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankAccount" TEXT,
    "type" "CapitalEntryType" NOT NULL DEFAULT 'OTHER',
    "venture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDataItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterDataItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "depreciationPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearLived" INTEGER NOT NULL DEFAULT 0,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "valuationDate" TIMESTAMP(3),
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleAccess_userId_module_key" ON "ModuleAccess"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "Cow_tag_key" ON "Cow"("tag");

-- CreateIndex
CREATE INDEX "HeatEvent_cowId_idx" ON "HeatEvent"("cowId");

-- CreateIndex
CREATE INDEX "HeatEvent_detectedAt_idx" ON "HeatEvent"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Insemination_heatEventId_key" ON "Insemination"("heatEventId");

-- CreateIndex
CREATE INDEX "Insemination_cowId_idx" ON "Insemination"("cowId");

-- CreateIndex
CREATE INDEX "Insemination_date_idx" ON "Insemination"("date");

-- CreateIndex
CREATE INDEX "PregnancyCheck_cowId_idx" ON "PregnancyCheck"("cowId");

-- CreateIndex
CREATE INDEX "PregnancyCheck_date_idx" ON "PregnancyCheck"("date");

-- CreateIndex
CREATE INDEX "Calving_damId_idx" ON "Calving"("damId");

-- CreateIndex
CREATE INDEX "Calving_date_idx" ON "Calving"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Calf_cowId_key" ON "Calf"("cowId");

-- CreateIndex
CREATE INDEX "Calf_calvingId_idx" ON "Calf"("calvingId");

-- CreateIndex
CREATE INDEX "MilkingRecord_date_idx" ON "MilkingRecord"("date");

-- CreateIndex
CREATE INDEX "MilkingRecord_cowId_idx" ON "MilkingRecord"("cowId");

-- CreateIndex
CREATE INDEX "MilkSale_date_idx" ON "MilkSale"("date");

-- CreateIndex
CREATE INDEX "MilkSale_buyer_idx" ON "MilkSale"("buyer");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_cashTransactionId_key" ON "CustomerPayment"("cashTransactionId");

-- CreateIndex
CREATE INDEX "CustomerPayment_buyer_idx" ON "CustomerPayment"("buyer");

-- CreateIndex
CREATE INDEX "CustomerPayment_date_idx" ON "CustomerPayment"("date");

-- CreateIndex
CREATE INDEX "FeedTransaction_date_idx" ON "FeedTransaction"("date");

-- CreateIndex
CREATE INDEX "FeedTransaction_feedType_idx" ON "FeedTransaction"("feedType");

-- CreateIndex
CREATE INDEX "CashTransaction_date_idx" ON "CashTransaction"("date");

-- CreateIndex
CREATE INDEX "CashTransaction_category_idx" ON "CashTransaction"("category");

-- CreateIndex
CREATE INDEX "CapitalEntry_date_idx" ON "CapitalEntry"("date");

-- CreateIndex
CREATE INDEX "CapitalEntry_partner_idx" ON "CapitalEntry"("partner");

-- CreateIndex
CREATE INDEX "MasterDataItem_category_idx" ON "MasterDataItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MasterDataItem_category_code_key" ON "MasterDataItem"("category", "code");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ModuleAccess" ADD CONSTRAINT "ModuleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeatEvent" ADD CONSTRAINT "HeatEvent_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insemination" ADD CONSTRAINT "Insemination_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insemination" ADD CONSTRAINT "Insemination_heatEventId_fkey" FOREIGN KEY ("heatEventId") REFERENCES "HeatEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyCheck" ADD CONSTRAINT "PregnancyCheck_inseminationId_fkey" FOREIGN KEY ("inseminationId") REFERENCES "Insemination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calving" ADD CONSTRAINT "Calving_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calving" ADD CONSTRAINT "Calving_inseminationId_fkey" FOREIGN KEY ("inseminationId") REFERENCES "Insemination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calf" ADD CONSTRAINT "Calf_calvingId_fkey" FOREIGN KEY ("calvingId") REFERENCES "Calving"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calf" ADD CONSTRAINT "Calf_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkingRecord" ADD CONSTRAINT "MilkingRecord_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
