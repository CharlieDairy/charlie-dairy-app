-- CreateTable
CREATE TABLE "VaccineDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repeatIntervalDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccineDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccinationRecord" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "vaccineDefId" TEXT,
    "vaccineName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "administeredBy" TEXT,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentRecord" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "medicineDefId" TEXT,
    "medicineName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dosage" TEXT,
    "reason" TEXT,
    "cost" DOUBLE PRECISION,
    "administeredBy" TEXT,
    "notes" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaccineDef_name_key" ON "VaccineDef"("name");

-- CreateIndex
CREATE INDEX "VaccinationRecord_cowId_idx" ON "VaccinationRecord"("cowId");

-- CreateIndex
CREATE INDEX "VaccinationRecord_date_idx" ON "VaccinationRecord"("date");

-- CreateIndex
CREATE INDEX "VaccinationRecord_nextDueDate_idx" ON "VaccinationRecord"("nextDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineDef_name_key" ON "MedicineDef"("name");

-- CreateIndex
CREATE INDEX "TreatmentRecord_cowId_idx" ON "TreatmentRecord"("cowId");

-- CreateIndex
CREATE INDEX "TreatmentRecord_date_idx" ON "TreatmentRecord"("date");

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_vaccineDefId_fkey" FOREIGN KEY ("vaccineDefId") REFERENCES "VaccineDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_medicineDefId_fkey" FOREIGN KEY ("medicineDefId") REFERENCES "MedicineDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
