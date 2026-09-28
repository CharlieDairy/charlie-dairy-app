-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE');

-- AlterTable
ALTER TABLE "Cow" ADD COLUMN     "breed" TEXT;

-- CreateTable
CREATE TABLE "CowCustomFieldDef" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CowCustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CowCustomFieldValue" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CowCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CowCustomFieldValue_cowId_idx" ON "CowCustomFieldValue"("cowId");

-- CreateIndex
CREATE INDEX "CowCustomFieldValue_fieldDefId_idx" ON "CowCustomFieldValue"("fieldDefId");

-- CreateIndex
CREATE UNIQUE INDEX "CowCustomFieldValue_cowId_fieldDefId_key" ON "CowCustomFieldValue"("cowId", "fieldDefId");

-- AddForeignKey
ALTER TABLE "CowCustomFieldValue" ADD CONSTRAINT "CowCustomFieldValue_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "Cow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CowCustomFieldValue" ADD CONSTRAINT "CowCustomFieldValue_fieldDefId_fkey" FOREIGN KEY ("fieldDefId") REFERENCES "CowCustomFieldDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
