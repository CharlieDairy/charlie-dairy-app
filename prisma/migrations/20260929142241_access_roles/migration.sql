-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT');

-- DropForeignKey
ALTER TABLE "ModuleAccess" DROP CONSTRAINT "ModuleAccess_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessRoleId" TEXT;

-- DropTable
DROP TABLE "ModuleAccess";

-- DropEnum
DROP TYPE "ModuleName";

-- CreateTable
CREATE TABLE "AccessRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRolePermission" (
    "id" TEXT NOT NULL,
    "accessRoleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,

    CONSTRAINT "AccessRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_name_key" ON "AccessRole"("name");

-- CreateIndex
CREATE INDEX "AccessRolePermission_accessRoleId_idx" ON "AccessRolePermission"("accessRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRolePermission_accessRoleId_module_action_key" ON "AccessRolePermission"("accessRoleId", "module", "action");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRolePermission" ADD CONSTRAINT "AccessRolePermission_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
