-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('cabinet_user', 'platform_admin', 'regulator', 'chamber');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trial', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "ComplianceItemType" AS ENUM ('doc', 'text', 'radio', 'checkbox');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('draft', 'submitted');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('eq', 'not_eq', 'in', 'not_in');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'in_app');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('prospect', 'client', 'ancien_client');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('email', 'appel', 'rdv', 'note');

-- CreateEnum
CREATE TYPE "StorageMode" AS ENUM ('hosted', 'external');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('aws', 'gdrive', 'sharepoint', 'other');

-- CreateEnum
CREATE TYPE "DocumentEntityType" AS ENUM ('cabinet', 'contact', 'product', 'supplier', 'compliance_answer');

-- CreateEnum
CREATE TYPE "ShareEntityType" AS ENUM ('contact', 'document', 'collaborator_training', 'cabinet_compliance', 'cabinet');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "global_role" "GlobalRole" NOT NULL DEFAULT 'cabinet_user',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "siret" TEXT,
    "orias_number" TEXT,
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "settings" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_members" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "can_manage_suppliers" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_products" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_contacts" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cabinet_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_phases" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_items" (
    "id" UUID NOT NULL,
    "phase_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ComplianceItemType" NOT NULL,
    "config" JSONB NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "validity_months" INTEGER,
    "alert_before_days" INTEGER[],
    "due_days_after_signup" INTEGER,
    "order" INTEGER NOT NULL,

    CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_conditions" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "depends_on_item_id" UUID NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "expected_value" TEXT NOT NULL,

    CONSTRAINT "compliance_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_compliance_answers" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "answered_by" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "status" "AnswerStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cabinet_compliance_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_notifications" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "days_before" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "compliance_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "created_by" UUID NOT NULL,
    "avg_public_rating" DOUBLE PRECISION,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_edits" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "edited_by" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "diff" JSONB NOT NULL,
    "edited_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_suppliers" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "private_rating" INTEGER,
    "private_note" TEXT,
    "internal_tags" TEXT[],
    "custom_fields" JSONB,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cabinet_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_public_ratings" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_public_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "website" TEXT,
    "created_by" UUID NOT NULL,
    "avg_public_rating" DOUBLE PRECISION,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_edits" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "edited_by" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "diff" JSONB NOT NULL,
    "edited_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_products" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_commercialized" BOOLEAN NOT NULL DEFAULT false,
    "supplier_id" UUID,
    "private_rating" INTEGER,
    "private_note" TEXT,
    "internal_tags" TEXT[],
    "custom_fields" JSONB,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cabinet_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_suppliers" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_public_ratings" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "product_public_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "url" TEXT,
    "created_by" UUID NOT NULL,
    "avg_public_rating" DOUBLE PRECISION,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_edits" (
    "id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "edited_by" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "diff" JSONB NOT NULL,
    "edited_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_tools" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "private_rating" INTEGER,
    "private_note" TEXT,
    "internal_tags" TEXT[],
    "custom_fields" JSONB,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "cabinet_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_public_ratings" (
    "id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tool_public_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "type" "ContactType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "InteractionType" NOT NULL,
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_storage_config" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "provider" "StorageProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_storage_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storage_mode" "StorageMode" NOT NULL,
    "storage_path" TEXT,
    "external_config_id" UUID,
    "external_path" TEXT,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "entity_type" "DocumentEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "label" TEXT,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_catalog" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "category" TEXT,
    "default_hours" DOUBLE PRECISION,
    "created_by" UUID NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "training_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborator_trainings" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "training_date" DATE NOT NULL,
    "hours_completed" DOUBLE PRECISION,
    "certificate_document_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "collaborator_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "cabinet_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_to" UUID NOT NULL,
    "entity_type" "ShareEntityType" NOT NULL,
    "entity_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cabinet_members_cabinet_id_idx" ON "cabinet_members"("cabinet_id");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_members_cabinet_id_user_id_key" ON "cabinet_members"("cabinet_id", "user_id");

-- CreateIndex
CREATE INDEX "compliance_items_phase_id_idx" ON "compliance_items"("phase_id");

-- CreateIndex
CREATE INDEX "compliance_conditions_item_id_idx" ON "compliance_conditions"("item_id");

-- CreateIndex
CREATE INDEX "cabinet_compliance_answers_cabinet_id_idx" ON "cabinet_compliance_answers"("cabinet_id");

-- CreateIndex
CREATE INDEX "cabinet_compliance_answers_expires_at_idx" ON "cabinet_compliance_answers"("expires_at");

-- CreateIndex
CREATE INDEX "compliance_notifications_cabinet_id_idx" ON "compliance_notifications"("cabinet_id");

-- CreateIndex
CREATE INDEX "compliance_notifications_answer_id_days_before_idx" ON "compliance_notifications"("answer_id", "days_before");

-- CreateIndex
CREATE INDEX "suppliers_created_at_idx" ON "suppliers"("created_at");

-- CreateIndex
CREATE INDEX "supplier_edits_supplier_id_idx" ON "supplier_edits"("supplier_id");

-- CreateIndex
CREATE INDEX "cabinet_suppliers_cabinet_id_idx" ON "cabinet_suppliers"("cabinet_id");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_suppliers_cabinet_id_supplier_id_key" ON "cabinet_suppliers"("cabinet_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_public_ratings_supplier_id_idx" ON "supplier_public_ratings"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_public_ratings_supplier_id_cabinet_id_key" ON "supplier_public_ratings"("supplier_id", "cabinet_id");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "products"("created_at");

-- CreateIndex
CREATE INDEX "product_edits_product_id_idx" ON "product_edits"("product_id");

-- CreateIndex
CREATE INDEX "cabinet_products_cabinet_id_idx" ON "cabinet_products"("cabinet_id");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_products_cabinet_id_product_id_key" ON "cabinet_products"("cabinet_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_suppliers_product_id_supplier_id_key" ON "product_suppliers"("product_id", "supplier_id");

-- CreateIndex
CREATE INDEX "product_public_ratings_product_id_idx" ON "product_public_ratings"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_public_ratings_product_id_cabinet_id_key" ON "product_public_ratings"("product_id", "cabinet_id");

-- CreateIndex
CREATE INDEX "tools_created_at_idx" ON "tools"("created_at");

-- CreateIndex
CREATE INDEX "tool_edits_tool_id_idx" ON "tool_edits"("tool_id");

-- CreateIndex
CREATE INDEX "cabinet_tools_cabinet_id_idx" ON "cabinet_tools"("cabinet_id");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_tools_cabinet_id_tool_id_key" ON "cabinet_tools"("cabinet_id", "tool_id");

-- CreateIndex
CREATE INDEX "tool_public_ratings_tool_id_idx" ON "tool_public_ratings"("tool_id");

-- CreateIndex
CREATE UNIQUE INDEX "tool_public_ratings_tool_id_cabinet_id_key" ON "tool_public_ratings"("tool_id", "cabinet_id");

-- CreateIndex
CREATE INDEX "contacts_cabinet_id_idx" ON "contacts"("cabinet_id");

-- CreateIndex
CREATE INDEX "interactions_contact_id_idx" ON "interactions"("contact_id");

-- CreateIndex
CREATE INDEX "cabinet_storage_config_cabinet_id_idx" ON "cabinet_storage_config"("cabinet_id");

-- CreateIndex
CREATE INDEX "documents_cabinet_id_idx" ON "documents"("cabinet_id");

-- CreateIndex
CREATE INDEX "document_links_document_id_idx" ON "document_links"("document_id");

-- CreateIndex
CREATE INDEX "document_links_entity_type_entity_id_idx" ON "document_links"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "collaborator_trainings_cabinet_id_idx" ON "collaborator_trainings"("cabinet_id");

-- CreateIndex
CREATE INDEX "collaborator_trainings_user_id_idx" ON "collaborator_trainings"("user_id");

-- CreateIndex
CREATE INDEX "shares_cabinet_id_idx" ON "shares"("cabinet_id");

-- CreateIndex
CREATE INDEX "shares_granted_to_is_active_idx" ON "shares"("granted_to", "is_active");

-- AddForeignKey
ALTER TABLE "cabinet_members" ADD CONSTRAINT "cabinet_members_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_members" ADD CONSTRAINT "cabinet_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "compliance_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_conditions" ADD CONSTRAINT "compliance_conditions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "compliance_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_conditions" ADD CONSTRAINT "compliance_conditions_depends_on_item_id_fkey" FOREIGN KEY ("depends_on_item_id") REFERENCES "compliance_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_compliance_answers" ADD CONSTRAINT "cabinet_compliance_answers_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_compliance_answers" ADD CONSTRAINT "cabinet_compliance_answers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "compliance_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_compliance_answers" ADD CONSTRAINT "cabinet_compliance_answers_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_notifications" ADD CONSTRAINT "compliance_notifications_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_notifications" ADD CONSTRAINT "compliance_notifications_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "cabinet_compliance_answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_edits" ADD CONSTRAINT "supplier_edits_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_edits" ADD CONSTRAINT "supplier_edits_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_edits" ADD CONSTRAINT "supplier_edits_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_suppliers" ADD CONSTRAINT "cabinet_suppliers_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_suppliers" ADD CONSTRAINT "cabinet_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_public_ratings" ADD CONSTRAINT "supplier_public_ratings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_public_ratings" ADD CONSTRAINT "supplier_public_ratings_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edits" ADD CONSTRAINT "product_edits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edits" ADD CONSTRAINT "product_edits_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_edits" ADD CONSTRAINT "product_edits_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_products" ADD CONSTRAINT "cabinet_products_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_products" ADD CONSTRAINT "cabinet_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_public_ratings" ADD CONSTRAINT "product_public_ratings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_public_ratings" ADD CONSTRAINT "product_public_ratings_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_edits" ADD CONSTRAINT "tool_edits_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_edits" ADD CONSTRAINT "tool_edits_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_edits" ADD CONSTRAINT "tool_edits_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_tools" ADD CONSTRAINT "cabinet_tools_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_tools" ADD CONSTRAINT "cabinet_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_public_ratings" ADD CONSTRAINT "tool_public_ratings_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_public_ratings" ADD CONSTRAINT "tool_public_ratings_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_storage_config" ADD CONSTRAINT "cabinet_storage_config_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_external_config_id_fkey" FOREIGN KEY ("external_config_id") REFERENCES "cabinet_storage_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_catalog" ADD CONSTRAINT "training_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_certificate_document_id_fkey" FOREIGN KEY ("certificate_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_granted_to_fkey" FOREIGN KEY ("granted_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
