-- D8 Expand-only Partial Unique Index
-- Guarantees at PostgreSQL storage engine level that a listing can never have multiple active (non-terminal) orders.
CREATE UNIQUE INDEX "order_single_active_listing_idx" ON "Order"("listingId") WHERE status NOT IN ('CANCELLED', 'REFUNDED', 'COMPLETED');
