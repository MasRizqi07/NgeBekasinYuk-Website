-- Expand-only migration for Phase 11: chat conversations, single pending offer, and negotiated order links

-- 1. Expand columns (all nullable)
ALTER TABLE "ChatMessage" ADD COLUMN "offerId" TEXT;
ALTER TABLE "PriceOffer" ADD COLUMN "consumedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "offerId" TEXT;

-- 2. Unique and partial unique constraints
CREATE UNIQUE INDEX "Conversation_buyerId_listingId_key" ON "Conversation"("buyerId", "listingId");
CREATE UNIQUE INDEX "Order_offerId_key" ON "Order"("offerId");
CREATE UNIQUE INDEX "price_offer_single_pending_per_convo_idx" ON "PriceOffer"("conversationId") WHERE status = 'PENDING';

-- 3. Query performance & rate-limit indexes
CREATE INDEX "Conversation_buyerId_lastTimestamp_id_idx" ON "Conversation"("buyerId", "lastTimestamp" DESC, "id");
CREATE INDEX "Conversation_sellerId_lastTimestamp_id_idx" ON "Conversation"("sellerId", "lastTimestamp" DESC, "id");
CREATE INDEX "ChatMessage_conversationId_createdAt_id_idx" ON "ChatMessage"("conversationId", "createdAt", "id");
CREATE INDEX "ChatMessage_senderId_createdAt_idx" ON "ChatMessage"("senderId", "createdAt");
CREATE INDEX "PriceOffer_conversationId_createdAt_idx" ON "PriceOffer"("conversationId", "createdAt");

-- 4. Foreign key relations
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PriceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PriceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
