-- Fonction utilitaire updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('RDV', 'CALL', 'TASK', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- AlterTable: ics_token sur cabinets
ALTER TABLE "cabinets" ADD COLUMN IF NOT EXISTS "ics_token" UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS "cabinets_ics_token_key" ON "cabinets"("ics_token");

-- CreateTable: events
CREATE TABLE "events" (
  "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"           UUID        NOT NULL,
  "created_by"           UUID        NOT NULL,
  "contact_id"           UUID,
  "title"                TEXT        NOT NULL,
  "description"          TEXT,
  "type"                 "EventType" NOT NULL,
  "status"               "EventStatus" NOT NULL DEFAULT 'PLANNED',
  "start_at"             TIMESTAMPTZ NOT NULL,
  "end_at"               TIMESTAMPTZ NOT NULL,
  "all_day"              BOOLEAN     NOT NULL DEFAULT false,
  "location"             TEXT,
  "compliance_answer_id" UUID,
  "is_recurring"         BOOLEAN     NOT NULL DEFAULT false,
  "recurrence_rule"      TEXT,
  "deleted_at"           TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "events_cabinet_id_idx" ON "events"("cabinet_id");
CREATE INDEX "events_start_at_idx"   ON "events"("start_at");
CREATE INDEX "events_contact_id_idx" ON "events"("contact_id");

-- Foreign keys
ALTER TABLE "events" ADD CONSTRAINT "events_cabinet_id_fkey"
  FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_compliance_answer_id_fkey"
  FOREIGN KEY ("compliance_answer_id") REFERENCES "cabinet_compliance_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Trigger : création automatique d'un event COMPLIANCE ──────────────────
-- Sur INSERT ou UPDATE de cabinet_compliance_answers avec status='submitted'
-- et expires_at non null, crée (ou remplace) un event COMPLIANCE.

CREATE OR REPLACE FUNCTION create_compliance_event()
RETURNS TRIGGER AS $$
DECLARE
  v_item_label TEXT;
BEGIN
  SELECT label INTO v_item_label
  FROM compliance_items
  WHERE id = NEW.item_id;

  -- Supprime l'ancien event COMPLIANCE pour cette réponse (si existe)
  DELETE FROM events
  WHERE compliance_answer_id = NEW.id AND type = 'COMPLIANCE';

  -- Crée le nouvel event (J-1 comme rappel, end_at = date d'expiration)
  INSERT INTO events (
    id, cabinet_id, created_by, title, type,
    start_at, end_at, all_day, compliance_answer_id, updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.cabinet_id,
    NEW.answered_by,
    'Expiration — ' || v_item_label,
    'COMPLIANCE',
    NEW.expires_at - INTERVAL '1 day',
    NEW.expires_at,
    true,
    NEW.id,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_compliance_answer_submit
AFTER INSERT OR UPDATE ON cabinet_compliance_answers
FOR EACH ROW
WHEN (NEW.status = 'submitted' AND NEW.expires_at IS NOT NULL)
EXECUTE FUNCTION create_compliance_event();
