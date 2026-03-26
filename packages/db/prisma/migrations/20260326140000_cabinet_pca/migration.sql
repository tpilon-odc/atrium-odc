-- CreateTable
CREATE TABLE "cabinet_pca" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id"   UUID         NOT NULL,
    "data"         JSONB        NOT NULL DEFAULT '{}',
    "is_completed" BOOLEAN      NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ,
    "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "cabinet_pca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_pca_cabinet_id_key" ON "cabinet_pca"("cabinet_id");

-- CreateIndex
CREATE INDEX "cabinet_pca_cabinet_id_idx" ON "cabinet_pca"("cabinet_id");

-- AddForeignKey
ALTER TABLE "cabinet_pca" ADD CONSTRAINT "cabinet_pca_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "cabinet_pca" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_pca_select" ON "cabinet_pca"
    FOR SELECT USING (
        cabinet_id IN (
            SELECT cabinet_id FROM cabinet_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "cabinet_pca_insert" ON "cabinet_pca"
    FOR INSERT WITH CHECK (
        cabinet_id IN (
            SELECT cabinet_id FROM cabinet_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "cabinet_pca_update" ON "cabinet_pca"
    FOR UPDATE USING (
        cabinet_id IN (
            SELECT cabinet_id FROM cabinet_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );
