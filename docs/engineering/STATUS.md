# System Architecture Status

| Module | Server-authoritative? | Evidence (test file or route) |
|---|---|---|
| auth | yes | `apps/web/src/app/api/auth/*`, `apps/web/test/e2e/auth.spec.ts` |
| orders | yes | `apps/web/src/app/api/orders/route.ts`, `apps/web/test/integration/orderCreation.test.ts` |
| payment | yes | `apps/web/src/app/api/payment/simulate-webhook/route.ts`, `apps/web/test/e2e/buyer-order.spec.ts` |
| wallet | yes | `apps/web/src/app/api/wallet/route.ts`, `apps/web/test/integration/walletAuthority.test.ts` |
| disputes | yes | `apps/web/src/app/api/disputes/[id]/verdict/route.ts`, `apps/web/test/integration/disputeResolution.test.ts` |
| listings | client simulation | client simulation |
| chat/offers | client simulation | client simulation |
| cart | client simulation | client simulation |
| notifications | client simulation | client simulation |
| KYC | client simulation | client simulation |
| seller dashboard | client simulation | client simulation |
