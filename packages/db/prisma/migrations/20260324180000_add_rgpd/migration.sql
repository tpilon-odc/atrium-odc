-- ────────────────────────────────────────────────────────────────────────────
-- RGPD — consentements, demandes RGPD, champs effacement
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Enums
CREATE TYPE "GdprRequestType"   AS ENUM ('ACCESS', 'ERASURE');
CREATE TYPE "GdprRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'REJECTED');

-- 2. Champs RGPD sur users
ALTER TABLE "users"
  ADD COLUMN "gdpr_anonymized_at" TIMESTAMPTZ;

-- 3. Champs RGPD sur cabinets
ALTER TABLE "cabinets"
  ADD COLUMN "deletion_requested_at" TIMESTAMPTZ,
  ADD COLUMN "deletion_scheduled_at" TIMESTAMPTZ;

-- 4. Table consent_records
CREATE TABLE "consent_records" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID        NOT NULL,
  "version"     TEXT        NOT NULL,
  "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ip_address"  TEXT,
  "user_agent"  TEXT,

  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consent_records_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "consent_records_user_id_idx" ON "consent_records"("user_id");

-- 5. Table gdpr_requests
CREATE TABLE "gdpr_requests" (
  "id"            UUID              NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"    UUID              NOT NULL,
  "requested_by"  UUID              NOT NULL,
  "type"          "GdprRequestType" NOT NULL,
  "status"        "GdprRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message"       TEXT,
  "processed_by"  UUID,
  "processed_at"  TIMESTAMPTZ,
  "response"      TEXT,
  "export_path"   TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "gdpr_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gdpr_requests_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE,
  CONSTRAINT "gdpr_requests_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id"),
  CONSTRAINT "gdpr_requests_processed_by_fkey"
    FOREIGN KEY ("processed_by") REFERENCES "users"("id")
);

CREATE INDEX "gdpr_requests_cabinet_id_idx" ON "gdpr_requests"("cabinet_id");
CREATE INDEX "gdpr_requests_status_idx"     ON "gdpr_requests"("status");

-- 6. RLS — consent_records
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;

-- L'utilisateur voit et crée ses propres consentements
CREATE POLICY "consent_records_select" ON "consent_records"
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "consent_records_insert" ON "consent_records"
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- platform_admin voit tout
CREATE POLICY "consent_records_admin" ON "consent_records"
  USING (auth.jwt() ->> 'global_role' = 'platform_admin');

-- 7. RLS — gdpr_requests
ALTER TABLE "gdpr_requests" ENABLE ROW LEVEL SECURITY;

-- Le cabinet voit ses propres demandes
CREATE POLICY "gdpr_requests_select" ON "gdpr_requests"
  FOR SELECT USING (
    cabinet_id IN (
      SELECT cabinet_id FROM cabinet_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gdpr_requests_insert" ON "gdpr_requests"
  FOR INSERT WITH CHECK (
    cabinet_id IN (
      SELECT cabinet_id FROM cabinet_members WHERE user_id = auth.uid()
    )
  );

-- platform_admin voit et modifie tout
CREATE POLICY "gdpr_requests_admin" ON "gdpr_requests"
  USING (auth.jwt() ->> 'global_role' = 'platform_admin');
