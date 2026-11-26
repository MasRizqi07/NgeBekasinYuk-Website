# System Architecture Status

| Module | Server-authoritative? | Evidence (test file or route) |
|---|---|---|
| auth | yes | `apps/web/src/app/api/auth/*`, `apps/web/test/e2e/auth.spec.ts` |
| orders | yes | `apps/web/src/app/api/orders/route.ts`, `apps/web/test/integration/orderCreation.test.ts` |
| payment | yes — simulated provider (`DemoPaymentProvider`), no real gateway | `apps/web/src/app/api/payment/simulate-webhook/route.ts`, `apps/web/test/e2e/buyer-order.spec.ts` |
| wallet | yes | `apps/web/src/app/api/wallet/route.ts`, `apps/web/test/integration/walletAuthority.test.ts` |
| disputes | yes | `apps/web/src/app/api/disputes/[id]/verdict/route.ts`, `apps/web/test/integration/disputeResolution.test.ts` |
| listings (status) | yes | `apps/web/src/app/api/orders/route.ts`, `apps/web/src/app/api/listings/[id]/archive/route.ts`, `apps/web/src/app/api/listings/[id]/relist/route.ts`, `apps/web/test/integration/orderReservationConcurrency.test.ts` |
| listings (catalog) | yes | `apps/web/src/app/api/listings/*`, `apps/web/test/integration/listingsApi.test.ts`, `apps/web/test/e2e/seller-listing.spec.ts` |
| chat/offers | yes | `apps/web/src/app/api/conversations/*`, `apps/web/src/app/api/orders/route.ts`, `apps/web/test/integration/chatOffers.test.ts`, `apps/web/test/integration/offerCheckoutConcurrency.test.ts`, `apps/web/test/e2e/chat-offers.spec.ts` |
| cart | IDs-only client convenience; live prices/availability server-validated | `apps/web/src/stores/useCartStore.ts`, `apps/web/src/hooks/useResolvedCartListings.ts`, `apps/web/src/app/api/orders/route.ts` |
| notifications | client simulation | client simulation |
| KYC | client simulation | client simulation |
| seller dashboard | yes | `apps/web/src/app/(main)/my-listings/page.tsx`, `apps/web/src/app/(main)/sell/page.tsx` |
| order simulation | demo-only (gated by DEMO_PAYMENT_PROVIDER, 404 in production) | `apps/web/src/app/api/orders/[id]/simulate/route.ts`, `apps/web/test/integration/orderSimulationD4.test.ts` |

*Decision D7 updated in Phase 10: After REFUND_BUYER, a listing transitions to ARCHIVED; owners can now relist via `POST /api/listings/[id]/relist` when zero non-terminal orders exist.*

