CREATE TABLE "notifications" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"  UUID        NOT NULL,
  "user_id"     UUID        NOT NULL,
  "type"        TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "message"     TEXT        NOT NULL,
  "entity_type" TEXT        NOT NULL,
  "entity_id"   UUID        NOT NULL,
  "is_read"     BOOLEAN     NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_cabinet_id_fkey"
  FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "notifications_cabinet_id_idx" ON "notifications"("cabinet_id");
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
