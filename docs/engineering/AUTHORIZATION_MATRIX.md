# NgeBekasinYuk Server-Enforced Authorization Matrix

## 1. Role-Based Access Control (RBAC) & Ownership

Authorization is strictly validated on the server boundary. Client-side route hiding or button disabling is treated purely as user experience, not security.

| Action | Anonymous | Buyer | Seller | Admin | Server Enforcement Boundary |
|---|---|---|---|---|---|
| View Public Listings | Yes | Yes | Yes | Yes | Public Catalog Query |
| Search & Filter Products | Yes | Yes | Yes | Yes | Public Search Query |
| Register / Login | Yes | Redirect | Redirect | Redirect | `/api/auth/login`, `/api/auth/register` |
| Create Product Listing | No | No | Yes (Self) | Yes | Validates `session.role === "SELLER"` |
| Update/Delete Listing | No | No | Owner Seller | Admin Override | Validates `listing.sellerId === session.userId` |
| Create Order / Checkout | No | Yes | Yes (as buyer) | No | Validates authenticated buyer session |
| Confirm Payment Webhook | No | No | No | System / Demo | Guarded in production (`ALLOW_DEMO_IN_PRODUCTION`) |
| Ship Order | No | No | Owner Seller | Admin Override | Validates `order.sellerId === session.userId` |
| Confirm Item Receipt | No | Owner Buyer | No | No | Validates `order.buyerId === session.userId` |
| Open Inspection Dispute | No | Owner Buyer | No | No | Validates `order.buyerId === session.userId` |
| Submit Dispute Evidence | No | Owner Buyer | Owner Seller | Admin | Validates dispute participation |
| Request Step-Up Grant | No | No | No | Admin | `/api/admin/step-up` (RFC 6238 TOTP challenge) |
| Decide Dispute Verdict | No | No | No | Admin (Step-Up) | `/api/disputes/[id]/verdict` (requires verified step-up token) |
| Withdraw Seller Wallet | No | No | Owner Seller | No | `/api/wallet/withdraw` (validates hashed PIN + conditional lock) |
| Access Admin Console | No | No | No | Admin | `middleware.ts` verifies HMAC signature & `role === "ADMIN"` |
| Access Chat Conversation | No | Participant | Participant | Admin Policy | Validates user is buyer or seller of conversation |
| Access User Notifications | No | Owner | Owner | Owner | Validates `notification.userId === session.userId` |

---

## 2. Resource Ownership Invariants

1. **Buyer Ownership**:
   `assert(order.buyerId === session.userId)` must hold for:
   - Order receipt confirmation
   - Dispute opening
   - Viewing private checkout / payment detail
2. **Seller Ownership**:
   `assert(order.sellerId === session.userId)` must hold for:
   - Marking order shipped
   - Submitting seller dispute evidence
   - Accessing seller wallet and requesting withdrawals
3. **Admin Privilege & Step-Up**:
   - `assert(session.role === "ADMIN")` verified via HMAC-SHA256 signature in `middleware.ts`.
   - `assert(stepUpGrant.adminId === session.userId && stepUpGrant.valid)` verified in `/api/disputes/[id]/verdict`.
4. **Session Versioning Invariant**:
   `assert(session.sessionVersion === dbUser.sessionVersion)` for privileged operations, ensuring immediate revocation upon role demotion or account suspension.
