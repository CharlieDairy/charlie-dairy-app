-- Existing ENTRY users become EDITOR; VIEWER is new. (ADD VALUE can't be used
-- in the same transaction, so assigning VIEWER to anyone is the next migration.)
ALTER TYPE "Role" RENAME VALUE 'ENTRY' TO 'EDITOR';
ALTER TYPE "Role" ADD VALUE 'VIEWER';
