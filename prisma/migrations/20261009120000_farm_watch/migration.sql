-- CreateEnum
CREATE TYPE "WatchSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'SNOOZED', 'RESOLVED');

-- CreateTable
CREATE TABLE "WatchFinding" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "WatchSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "suggestion" TEXT,
    "metric" JSONB,
    "financeOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" "WatchStatus" NOT NULL DEFAULT 'OPEN',
    "snoozedUntil" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WatchFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "byUser" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "ruleErrors" JSONB,

    CONSTRAINT "WatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchReview" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "brief" TEXT NOT NULL,
    "gaps" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "coverage" JSONB,

    CONSTRAINT "WatchReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchFinding_key_key" ON "WatchFinding"("key");

-- CreateIndex
CREATE INDEX "WatchFinding_status_severity_idx" ON "WatchFinding"("status", "severity");

-- CreateIndex
CREATE INDEX "WatchFinding_category_idx" ON "WatchFinding"("category");

