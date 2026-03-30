-- userId devient nullable
ALTER TABLE "cabinet_members" ALTER COLUMN "user_id" DROP NOT NULL;

-- Champs membres externes
ALTER TABLE "cabinet_members" ADD COLUMN "external_first_name" TEXT;
ALTER TABLE "cabinet_members" ADD COLUMN "external_last_name" TEXT;
ALTER TABLE "cabinet_members" ADD COLUMN "external_email" TEXT;
ALTER TABLE "cabinet_members" ADD COLUMN "external_title" TEXT;

-- Suppression de la contrainte unique (incompatible avec userId NULL multiple)
ALTER TABLE "cabinet_members" DROP CONSTRAINT IF EXISTS "cabinet_members_cabinet_id_user_id_key";
