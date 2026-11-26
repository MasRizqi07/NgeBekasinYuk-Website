-- Expand-only migration: add catalog listing cursor pagination and category indexes
CREATE INDEX "ProductListing_status_createdAt_id_idx" ON "ProductListing"("status", "createdAt" DESC, "id");
CREATE INDEX "ProductListing_category_idx" ON "ProductListing"("category");
