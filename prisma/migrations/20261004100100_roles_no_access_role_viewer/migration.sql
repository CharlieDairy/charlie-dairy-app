-- Accounts that had no AccessRole (so previously saw nothing) must not be
-- widened to full Editor access by the rename above: make them View Only.
UPDATE "User" SET "role" = 'VIEWER' WHERE "role" = 'EDITOR' AND "accessRoleId" IS NULL;
