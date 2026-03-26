-- Product reviews
CREATE TABLE "product_reviews" (
  "id" TEXT NOT NULL,
  "product_id" UUID NOT NULL,
  "cabinet_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_reviews_rating_check" CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT "product_reviews_product_cabinet_unique" UNIQUE ("product_id", "cabinet_id")
);

ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supplier reviews
CREATE TABLE "supplier_reviews" (
  "id" TEXT NOT NULL,
  "supplier_id" UUID NOT NULL,
  "cabinet_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_reviews_rating_check" CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT "supplier_reviews_supplier_cabinet_unique" UNIQUE ("supplier_id", "cabinet_id")
);

ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "product_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_reviews_select" ON "product_reviews" FOR SELECT USING (true);
CREATE POLICY "product_reviews_insert" ON "product_reviews" FOR INSERT WITH CHECK (cabinet_id::text = auth.uid()::text);
CREATE POLICY "product_reviews_update" ON "product_reviews" FOR UPDATE USING (cabinet_id::text = auth.uid()::text);

ALTER TABLE "supplier_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_reviews_select" ON "supplier_reviews" FOR SELECT USING (true);
CREATE POLICY "supplier_reviews_insert" ON "supplier_reviews" FOR INSERT WITH CHECK (cabinet_id::text = auth.uid()::text);
CREATE POLICY "supplier_reviews_update" ON "supplier_reviews" FOR UPDATE USING (cabinet_id::text = auth.uid()::text);
