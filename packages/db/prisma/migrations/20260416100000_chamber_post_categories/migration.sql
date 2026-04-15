-- CreateTable
CREATE TABLE "chamber_post_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamber_post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chamber_post_categories_order_idx" ON "chamber_post_categories"("order");

-- Insert default "Général" category
INSERT INTO "chamber_post_categories" ("id", "name", "color", "order")
VALUES ('00000000-0000-0000-0000-000000000001', 'Général', '#6366f1', 0);

-- AddColumn category_id to chamber_posts (nullable first, then fill, then set NOT NULL)
ALTER TABLE "chamber_posts" ADD COLUMN "category_id" UUID;

-- Fill existing posts with the default category
UPDATE "chamber_posts" SET "category_id" = '00000000-0000-0000-0000-000000000001';

-- Set NOT NULL constraint
ALTER TABLE "chamber_posts" ALTER COLUMN "category_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "chamber_posts_category_id_idx" ON "chamber_posts"("category_id");

-- AddForeignKey
ALTER TABLE "chamber_posts" ADD CONSTRAINT "chamber_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "chamber_post_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
