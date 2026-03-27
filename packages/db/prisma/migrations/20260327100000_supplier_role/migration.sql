-- Ajoute la valeur 'supplier' à l'enum GlobalRole
ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS 'supplier';

-- Table supplier_users : lie un utilisateur supplier à une fiche fournisseur
CREATE TABLE "supplier_users" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "supplier_id"  UUID        NOT NULL,
  "user_id"      UUID        NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "supplier_users_pkey"                  PRIMARY KEY ("id"),
  CONSTRAINT "supplier_users_supplier_id_user_id_key" UNIQUE ("supplier_id", "user_id"),
  CONSTRAINT "supplier_users_supplier_id_fkey"      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE,
  CONSTRAINT "supplier_users_user_id_fkey"          FOREIGN KEY ("user_id")     REFERENCES "users"("id")    ON DELETE CASCADE
);

CREATE INDEX "supplier_users_user_id_idx" ON "supplier_users"("user_id");
