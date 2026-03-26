CREATE TABLE "cabinet_pca_history" (
  "id" TEXT NOT NULL,
  "cabinet_id" UUID NOT NULL,
  "data" JSONB NOT NULL,
  "saved_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cabinet_pca_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cabinet_pca_history" ADD CONSTRAINT "cabinet_pca_history_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cabinet_pca_history" ADD CONSTRAINT "cabinet_pca_history_saved_by_fkey" FOREIGN KEY ("saved_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "cabinet_pca_history_cabinet_id_idx" ON "cabinet_pca_history"("cabinet_id");

-- RLS
ALTER TABLE "cabinet_pca_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_pca_history_select" ON "cabinet_pca_history" FOR SELECT USING (
  cabinet_id IN (SELECT cabinet_id FROM cabinet_members WHERE user_id = auth.uid())
);
