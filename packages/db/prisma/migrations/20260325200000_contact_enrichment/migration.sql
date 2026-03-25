-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('celibataire', 'marie', 'pacse', 'divorce', 'veuf');

-- AlterTable
ALTER TABLE "contacts"
  ADD COLUMN "email2"         TEXT,
  ADD COLUMN "phone2"         TEXT,
  ADD COLUMN "birth_date"     DATE,
  ADD COLUMN "profession"     TEXT,
  ADD COLUMN "address"        TEXT,
  ADD COLUMN "city"           TEXT,
  ADD COLUMN "postal_code"    TEXT,
  ADD COLUMN "country"        TEXT DEFAULT 'France',
  ADD COLUMN "marital_status" "MaritalStatus",
  ADD COLUMN "dependents"     INTEGER;
