-- Refactoring : remplace les 10 colonnes individuelles + GENERATED score_global
-- par evaluation_notes JSONB et score_global NUMERIC calculé côté app

-- Supprimer d'abord la colonne GENERATED (dépend des colonnes individuelles)
ALTER TABLE "cabinet_supplier_evaluations"
  DROP COLUMN IF EXISTS "score_global";

-- Supprimer les colonnes individuelles
ALTER TABLE "cabinet_supplier_evaluations"
  DROP COLUMN IF EXISTS "score_solvabilite",
  DROP COLUMN IF EXISTS "note_solvabilite",
  DROP COLUMN IF EXISTS "score_reputation",
  DROP COLUMN IF EXISTS "note_reputation",
  DROP COLUMN IF EXISTS "score_moyens",
  DROP COLUMN IF EXISTS "note_moyens",
  DROP COLUMN IF EXISTS "score_relation",
  DROP COLUMN IF EXISTS "note_relation",
  DROP COLUMN IF EXISTS "score_remuneration",
  DROP COLUMN IF EXISTS "note_remuneration";

-- Ajouter les nouvelles colonnes
ALTER TABLE "cabinet_supplier_evaluations"
  ADD COLUMN "evaluation_notes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "score_global"     NUMERIC(3,2) DEFAULT 0;
