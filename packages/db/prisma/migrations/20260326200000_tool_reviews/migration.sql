CREATE TABLE "tool_reviews" (
  "id"         TEXT NOT NULL,
  "tool_id"    UUID NOT NULL,
  "cabinet_id" UUID NOT NULL,
  "rating"     INTEGER NOT NULL,
  "comment"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tool_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tool_reviews_tool_id_cabinet_id_key" UNIQUE ("tool_id", "cabinet_id"),
  CONSTRAINT "tool_reviews_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE CASCADE,
  CONSTRAINT "tool_reviews_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE
);
