-- CreateTable
CREATE TABLE "WeightStandard" (
    "id" TEXT NOT NULL,
    "breed" TEXT,
    "ageMonths" INTEGER NOT NULL,
    "minWeightKg" DOUBLE PRECISION NOT NULL,
    "maxWeightKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightStandard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeightStandard_ageMonths_idx" ON "WeightStandard"("ageMonths");

-- CreateIndex
CREATE UNIQUE INDEX "WeightStandard_breed_ageMonths_key" ON "WeightStandard"("breed", "ageMonths");
