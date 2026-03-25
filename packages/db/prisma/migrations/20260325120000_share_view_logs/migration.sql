CREATE TABLE "share_view_logs" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "share_id"   UUID        NOT NULL,
  "viewer_id"  UUID        NOT NULL,
  "viewed_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ip_address" TEXT,

  CONSTRAINT "share_view_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "share_view_logs_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "shares"("id") ON DELETE CASCADE,
  CONSTRAINT "share_view_logs_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "share_view_logs_share_id_idx" ON "share_view_logs"("share_id");
CREATE INDEX "share_view_logs_viewer_id_idx" ON "share_view_logs"("viewer_id");
