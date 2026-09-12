# NgeBekasinYuk Server-Enforced Authorization Matrix
### Hardening Pass #3 Dual-Layer Verification Standards

## 1. Dual-Layer Authorization Architecture

Authorization enforces strict separation of concerns across two defense layers:
1. **Layer 1: Coarse Edge Routing Guard (`src/proxy.ts`)**
   Cryptographically validates HMAC-SHA256 session signatures and checks coarse route roles for page navigation without burdening the database on static requests.
2. **Layer 2: Authoritative Database Validation (`validateAuthoritativeSession()`)**
   High-risk mutating endpoints query PostgreSQL to guarantee the user exists, `accountStatus === "ACTIVE"`, `token.sessionVersion === dbUser.sessionVersion`, and the authoritative database role authorizes the specific action.

---

## 2. Role-Based Access Control (RBAC) & Ownership Matrix

| Action | Anonymous | Buyer | Seller | Admin | Server Enforcement Boundary |
|---|---|---|---|---|---|
| View Public Listings | Yes | Yes | Yes | Yes | Public Catalog Query |
| Search & Filter Products | Yes | Yes | Yes | Yes | Public Search Query |
| Register / Login | Yes | Redirect | Redirect | Redirect | `/api/auth/login`, `/api/auth/register` |
| Create Product Listing | No | No | Yes (Self) | Yes | Authoritative check `dbUser.role === "SELLER"` |
| Update/Delete Listing | No | No | Owner Seller | Admin Override | Validates `listing.sellerId === dbUser.id` |
| Create Order / Checkout | No | Yes | Yes (as buyer) | No | Validates active buyer session |
| Confirm Payment Webhook | No | No | No | System | Strictly disabled in `APP_ENV=production` |
| Ship Order | No | No | Owner Seller | Admin Override | Validates `order.sellerId === dbUser.id` |
| Confirm Item Receipt | No | Owner Buyer | No | No | Validates `order.buyerId === dbUser.id` |
| Open Inspection Dispute | No | Owner Buyer | No | No | Validates `order.buyerId === dbUser.id` |
| Submit Dispute Evidence | No | Owner Buyer | Owner Seller | Admin | Validates dispute participation |
| Request Step-Up Grant | No | No | No | Admin | `/api/admin/step-up` (authoritative DB admin + distributed TOTP) |
| Decide Dispute Verdict | No | No | No | Admin (Step-Up) | `/api/disputes/[id]/verdict` (single-use grant consumed in DB) |
| Withdraw Seller Wallet | No | No | Owner Seller | No | `/api/wallet/withdraw` (validates hashed PIN + conditional lock) |
| Access Admin Console | No | No | No | Admin | `src/proxy.ts` verifies HMAC signature & `role === "ADMIN"` |
| Access Chat Conversation | No | Participant | Participant | Admin Policy | Validates user is buyer or seller of conversation |
| Access User Notifications | No | Owner | Owner | Owner | Validates `notification.userId === dbUser.id` |

---

## 3. Resource Ownership & Invariant Verification

1. **Authoritative Session Invariant**:
   `assert(dbUser.accountStatus === "ACTIVE")` and `assert(token.sessionVersion === dbUser.sessionVersion)`.
   If a user is suspended, disabled, downgraded, or their password is reset, all prior session tokens fail authoritative validation immediately.
2. **Buyer Ownership**:
   `assert(order.buyerId === dbUser.id)` must hold for:
   - Order receipt confirmation
   - Inspection dispute opening
   - Viewing private checkout / payment detail
3. **Seller Ownership**:
   `assert(order.sellerId === dbUser.id)` must hold for:
   - Marking order shipped
   - Submitting seller dispute evidence
   - Accessing seller wallet and requesting disbursements
4. **Single-Use Admin Step-Up Invariant**:
   `assert(grant.adminId === dbUser.id && grant.action === expectedAction && grant.resourceId === expectedResource && grant.consumedAt === null)`.
   Step-up grants are consumable exactly once within an atomic database transaction. Re-use attempts are strictly rejected.
5. **Distributed Replay Invariant**:
   `assert(dbUser.lastTotpStep === null || dbUser.lastTotpStep < submittedStep)`.
   Prevents OTP reuse across multiple instances and survives process restarts.
