CREATE TABLE "contact_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sold_at" DATE NOT NULL,
    "amount" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_products_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id"),
    CONSTRAINT "contact_products_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id"),
    CONSTRAINT "contact_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id")
);

CREATE INDEX "contact_products_cabinet_id_contact_id_idx" ON "contact_products"("cabinet_id", "contact_id");
