-- CreateEnum
CREATE TYPE "ChamberPostStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "chamber_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chamber_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ChamberPostStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chamber_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamber_post_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamber_post_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chamber_posts_chamber_id_idx" ON "chamber_posts"("chamber_id");

-- CreateIndex
CREATE INDEX "chamber_posts_status_published_at_idx" ON "chamber_posts"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "chamber_post_reads_post_id_user_id_key" ON "chamber_post_reads"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "chamber_post_reads_user_id_idx" ON "chamber_post_reads"("user_id");

-- AddForeignKey
ALTER TABLE "chamber_posts" ADD CONSTRAINT "chamber_posts_chamber_id_fkey" FOREIGN KEY ("chamber_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamber_post_reads" ADD CONSTRAINT "chamber_post_reads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "chamber_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamber_post_reads" ADD CONSTRAINT "chamber_post_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
