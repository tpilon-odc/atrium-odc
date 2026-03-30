-- CreateTable
CREATE TABLE "tool_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_categories_pkey" PRIMARY KEY ("id")
);

-- Seed initial categories
INSERT INTO "tool_categories" ("label", "order") VALUES
  ('Signature électronique', 1),
  ('Agrégation de données', 2),
  ('CRM', 3),
  ('Reporting', 4),
  ('Gestion documentaire', 5),
  ('Conformité / Réglementation', 6),
  ('Planification financière', 7),
  ('Communication client', 8);
