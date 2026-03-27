-- Make cabinet_id nullable on documents
ALTER TABLE "documents" ALTER COLUMN "cabinet_id" DROP NOT NULL;

-- Add supplier_id column
ALTER TABLE "documents" ADD COLUMN "supplier_id" UUID;

-- Foreign key to suppliers
ALTER TABLE "documents" ADD CONSTRAINT "documents_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL;

-- Index
CREATE INDEX "documents_supplier_id_idx" ON "documents"("supplier_id");
