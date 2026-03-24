-- AlterTable
ALTER TABLE "cabinets" ALTER COLUMN "ics_token" DROP DEFAULT;

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;
