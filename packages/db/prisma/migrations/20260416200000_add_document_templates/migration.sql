-- CreateEnum
CREATE TYPE "TemplateTargetEntity" AS ENUM ('CONTACT', 'CABINET', 'COMPLIANCE');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_key" TEXT NOT NULL,
    "target_entity" "TemplateTargetEntity" NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template_generations" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "contact_id" UUID,
    "generated_by" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_template_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_cabinet_id_idx" ON "document_templates"("cabinet_id");

-- CreateIndex
CREATE INDEX "document_template_generations_template_id_idx" ON "document_template_generations"("template_id");

-- CreateIndex
CREATE INDEX "document_template_generations_contact_id_idx" ON "document_template_generations"("contact_id");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_generations" ADD CONSTRAINT "document_template_generations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_generations" ADD CONSTRAINT "document_template_generations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_generations" ADD CONSTRAINT "document_template_generations_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
