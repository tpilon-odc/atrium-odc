/*
  Warnings:

  - A unique constraint covering the columns `[cabinet_id,item_id]` on the table `cabinet_compliance_answers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cabinet_compliance_answers_cabinet_id_item_id_key" ON "cabinet_compliance_answers"("cabinet_id", "item_id");
