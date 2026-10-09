-- CreateEnum
CREATE TYPE "CashClass" AS ENUM ('MILK_SALES', 'LIVESTOCK_SALES', 'OTHER_INCOME', 'OPEX', 'CAPEX', 'PARTNER_IN', 'PARTNER_OUT', 'OPENING', 'REVIEW');

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN "accountClass" "CashClass";
