-- CreateEnum
CREATE TYPE "ImportToolSlug" AS ENUM ('O2S', 'QUANTALYS', 'WEALTHCOME');

-- CreateTable
CREATE TABLE "cabinet_import_tools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "tool" "ImportToolSlug" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_import_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_tool_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_tool_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_import_tools_cabinet_id_tool_key" ON "cabinet_import_tools"("cabinet_id", "tool");

-- AddForeignKey
ALTER TABLE "cabinet_import_tools" ADD CONSTRAINT "cabinet_import_tools_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_tool_requests" ADD CONSTRAINT "import_tool_requests_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
