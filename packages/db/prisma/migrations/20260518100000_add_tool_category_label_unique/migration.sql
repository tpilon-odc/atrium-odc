-- AddUniqueConstraint: tool_categories.label
ALTER TABLE "tool_categories" ADD CONSTRAINT "tool_categories_label_key" UNIQUE ("label");
