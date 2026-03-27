-- cabinet_supplier_evaluations
CREATE TABLE "cabinet_supplier_evaluations" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"            UUID        NOT NULL,
  "supplier_id"           UUID        NOT NULL,

  "score_solvabilite"     INT         CHECK ("score_solvabilite" BETWEEN 1 AND 5),
  "note_solvabilite"      TEXT,
  "score_reputation"      INT         CHECK ("score_reputation" BETWEEN 1 AND 5),
  "note_reputation"       TEXT,
  "score_moyens"          INT         CHECK ("score_moyens" BETWEEN 1 AND 5),
  "note_moyens"           TEXT,
  "score_relation"        INT         CHECK ("score_relation" BETWEEN 1 AND 5),
  "note_relation"         TEXT,
  "score_remuneration"    INT         CHECK ("score_remuneration" BETWEEN 1 AND 5),
  "note_remuneration"     TEXT,

  "score_global"          FLOAT GENERATED ALWAYS AS (
    (
      COALESCE("score_solvabilite", 0) +
      COALESCE("score_reputation", 0) +
      COALESCE("score_moyens", 0) +
      COALESCE("score_relation", 0) +
      COALESCE("score_remuneration", 0)
    )::float /
    NULLIF(
      (CASE WHEN "score_solvabilite" IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN "score_reputation"  IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN "score_moyens"      IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN "score_relation"    IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN "score_remuneration" IS NOT NULL THEN 1 ELSE 0 END),
    0)
  ) STORED,

  "evaluation_date"       DATE        NOT NULL DEFAULT CURRENT_DATE,
  "next_review_date"      DATE,
  "evaluateurs"           TEXT[]      NOT NULL DEFAULT '{}',
  "contrat_signe_le"      DATE,
  "contrat_duree"         TEXT,
  "contrat_preavis"       TEXT,
  "contrat_document_id"   UUID,
  "status"                TEXT        NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'completed')),
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "cabinet_supplier_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cabinet_supplier_evaluations_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE,
  CONSTRAINT "cabinet_supplier_evaluations_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE,
  CONSTRAINT "cabinet_supplier_evaluations_contrat_document_id_fkey"
    FOREIGN KEY ("contrat_document_id") REFERENCES "documents"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_cse_cabinet_id"   ON "cabinet_supplier_evaluations"("cabinet_id");
CREATE INDEX "idx_cse_supplier_id"  ON "cabinet_supplier_evaluations"("supplier_id");
CREATE INDEX "idx_cse_next_review"  ON "cabinet_supplier_evaluations"("next_review_date");

-- cabinet_supplier_verification
CREATE TABLE "cabinet_supplier_verification" (
  "id"                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"              UUID        NOT NULL,
  "supplier_id"             UUID        NOT NULL,
  "supplier_type"           TEXT        NOT NULL CHECK ("supplier_type" IN (
    'sgp', 'psi', 'psfp', 'psan', 'biens_divers', 'cif_plateforme', 'promoteur_non_regule'
  )),
  "checklist"               JSONB       NOT NULL DEFAULT '[]',
  "beneficiaires_verifies"  BOOLEAN     NOT NULL DEFAULT false,
  "beneficiaires_source"    TEXT,
  "verification_date"       DATE,
  "verified_by"             UUID,
  "decision"                TEXT        CHECK ("decision" IN ('approved', 'rejected', 'pending')),
  "decision_note"           TEXT,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "cabinet_supplier_verification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cabinet_supplier_verification_cabinet_supplier_key"
    UNIQUE ("cabinet_id", "supplier_id"),
  CONSTRAINT "cabinet_supplier_verification_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE,
  CONSTRAINT "cabinet_supplier_verification_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE,
  CONSTRAINT "cabinet_supplier_verification_verified_by_fkey"
    FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_csv_cabinet_id"  ON "cabinet_supplier_verification"("cabinet_id");
CREATE INDEX "idx_csv_supplier_id" ON "cabinet_supplier_verification"("supplier_id");
