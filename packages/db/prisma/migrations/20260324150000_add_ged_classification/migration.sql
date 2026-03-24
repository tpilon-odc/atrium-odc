-- ────────────────────────────────────────────────────────────────────────────
-- PARTIE 1 : GED — dossiers, tags, export jobs
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Enum ExportStatus
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'EXPIRED');

-- 2. Table folders
CREATE TABLE "folders" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id" UUID        NOT NULL,
  "name"       TEXT        NOT NULL,
  "parent_id"  UUID,
  "is_system"  BOOLEAN     NOT NULL DEFAULT false,
  "order"      INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "folders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "folders_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE,
  CONSTRAINT "folders_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE
);

CREATE INDEX "folders_cabinet_id_idx" ON "folders"("cabinet_id");
CREATE INDEX "folders_parent_id_idx"  ON "folders"("parent_id");

-- 3. Table tags (cabinet_id nullable = tag système)
CREATE TABLE "tags" (
  "id"         UUID    NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id" UUID,
  "name"       TEXT    NOT NULL,
  "color"      TEXT,
  "is_system"  BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tags_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE,
  CONSTRAINT "tags_cabinet_id_name_key" UNIQUE ("cabinet_id", "name")
);

CREATE INDEX "tags_cabinet_id_idx" ON "tags"("cabinet_id");

-- 4. Table document_tags (pivot Document ↔ Tag)
CREATE TABLE "document_tags" (
  "document_id" UUID NOT NULL,
  "tag_id"      UUID NOT NULL,

  CONSTRAINT "document_tags_pkey" PRIMARY KEY ("document_id", "tag_id"),
  CONSTRAINT "document_tags_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
  CONSTRAINT "document_tags_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

-- 5. Table export_jobs
CREATE TABLE "export_jobs" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"   UUID          NOT NULL,
  "requested_by" UUID          NOT NULL,
  "status"       "ExportStatus" NOT NULL DEFAULT 'PENDING',
  "storage_path" TEXT,
  "expires_at"   TIMESTAMPTZ,
  "error"        TEXT,
  "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,

  CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "export_jobs_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE,
  CONSTRAINT "export_jobs_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id")
);

CREATE INDEX "export_jobs_cabinet_id_idx" ON "export_jobs"("cabinet_id");
CREATE INDEX "export_jobs_status_idx"     ON "export_jobs"("status");

-- 6. Ajouter folder_id sur documents
ALTER TABLE "documents"
  ADD COLUMN "folder_id" UUID,
  ADD CONSTRAINT "documents_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL;

CREATE INDEX "documents_folder_id_idx" ON "documents"("folder_id");

-- ────────────────────────────────────────────────────────────────────────────
-- SEED : tags système (cabinet_id = NULL, is_system = true)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO "tags" ("id", "cabinet_id", "name", "color", "is_system") VALUES
  (gen_random_uuid(), NULL, 'Urgent',        '#EF4444', true),
  (gen_random_uuid(), NULL, 'À renouveler',  '#F97316', true),
  (gen_random_uuid(), NULL, 'Archivé',       '#6B7280', true),
  (gen_random_uuid(), NULL, 'Confidentiel',  '#111827', true);
