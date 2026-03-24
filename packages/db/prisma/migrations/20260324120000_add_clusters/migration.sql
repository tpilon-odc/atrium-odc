-- ── Nouveaux enums ────────────────────────────────────────────────────────────

CREATE TYPE "ClusterRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "ChannelType" AS ENUM ('ASYNC', 'REALTIME');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- ── Ajout de la valeur 'message' à DocumentEntityType ────────────────────────
-- ALTER TYPE ne peut pas être dans une transaction, Prisma le gère via shadow DB

ALTER TYPE "DocumentEntityType" ADD VALUE 'message';

-- ── clusters ──────────────────────────────────────────────────────────────────

CREATE TABLE "clusters" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "created_by"  UUID        NOT NULL,
  "is_public"   BOOLEAN     NOT NULL DEFAULT true,
  "is_verified" BOOLEAN     NOT NULL DEFAULT false,
  "avatar_url"  TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "clusters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clusters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "clusters_is_public_idx" ON "clusters"("is_public");

-- ── cluster_members ───────────────────────────────────────────────────────────

CREATE TABLE "cluster_members" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "cluster_id" UUID           NOT NULL,
  "cabinet_id" UUID           NOT NULL,
  "role"       "ClusterRole"  NOT NULL DEFAULT 'MEMBER',
  "joined_at"  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  "invited_by" UUID,

  CONSTRAINT "cluster_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cluster_members_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cluster_members_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cluster_members_cluster_id_cabinet_id_key" UNIQUE ("cluster_id", "cabinet_id")
);

CREATE INDEX "cluster_members_cabinet_id_idx" ON "cluster_members"("cabinet_id");

-- ── channels ──────────────────────────────────────────────────────────────────

CREATE TABLE "channels" (
  "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
  "cluster_id"      UUID          NOT NULL,
  "name"            TEXT          NOT NULL,
  "type"            "ChannelType" NOT NULL DEFAULT 'ASYNC',
  "is_private"      BOOLEAN       NOT NULL DEFAULT false,
  "created_by"      UUID          NOT NULL,
  "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "last_message_at" TIMESTAMPTZ,

  CONSTRAINT "channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "channels_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "channels_cluster_id_idx" ON "channels"("cluster_id");

-- ── messages ──────────────────────────────────────────────────────────────────

CREATE TABLE "messages" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "channel_id"        UUID        NOT NULL,
  "author_user_id"    UUID        NOT NULL,
  "author_cabinet_id" UUID        NOT NULL,
  "content"           TEXT        NOT NULL,
  "parent_id"         UUID,
  "deleted_at"        TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "messages_author_cabinet_id_fkey" FOREIGN KEY ("author_cabinet_id") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "messages_channel_id_idx" ON "messages"("channel_id");
CREATE INDEX "messages_parent_id_idx" ON "messages"("parent_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- Trigger updated_at sur messages
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON "messages"
  FOR EACH ROW EXECUTE FUNCTION update_messages_updated_at();

-- Trigger last_message_at sur channels
CREATE OR REPLACE FUNCTION update_channel_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "channels"
  SET "last_message_at" = now()
  WHERE "id" = NEW.channel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER channel_last_message_at
  AFTER INSERT ON "messages"
  FOR EACH ROW EXECUTE FUNCTION update_channel_last_message_at();

-- ── message_reactions ─────────────────────────────────────────────────────────

CREATE TABLE "message_reactions" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "user_id"    UUID NOT NULL,
  "cabinet_id" UUID NOT NULL,
  "emoji"      TEXT NOT NULL,

  CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_reactions_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji")
);

-- ── message_reports ───────────────────────────────────────────────────────────

CREATE TABLE "message_reports" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "message_id"  UUID           NOT NULL,
  "reported_by" UUID           NOT NULL,
  "reason"      TEXT           NOT NULL,
  "status"      "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "message_reports_status_idx" ON "message_reports"("status");
