# NgeBekasinYuk Server-Enforced Authorization Matrix

## 1. Role-Based Access Control (RBAC) & Ownership

Authorization is strictly validated on the server boundary. Client-side route hiding or button disabling is treated purely as user experience, not security.

| Action | Anonymous | Buyer | Seller | Admin | Server Enforcement Boundary |
|---|---|---|---|---|---|
| View Public Listings | Yes | Yes | Yes | Yes | Public Catalog Query |
| Search & Filter Products | Yes | Yes | Yes | Yes | Public Search Query |
| Register / Login | Yes | No (Redirect) | No (Redirect) | No (Redirect) | `/api/auth/login`, `/api/auth/register` |
| Create Product Listing | No | No | Yes (Self) | Yes | Validates `session.role === "SELLER"` |
| Update/Delete Listing | No | No | Owner Seller | Admin Override | Validates `listing.sellerId === session.id` |
| Create Order / Checkout | No | Yes | Yes (as buyer) | No | Validates authenticated buyer session |
| Confirm Payment Webhook | No | No | No | Yes (or System) | `/api/payment/simulate-webhook` |
| Ship Order | No | No | Owner Seller | Admin Override | Validates `order.sellerId === session.id` |
| Confirm Item Receipt | No | Owner Buyer | No | No | Validates `order.buyerId === session.id` |
| Open Inspection Dispute | No | Owner Buyer | No | No | Validates `order.buyerId === session.id` |
| Submit Dispute Evidence | No | Owner Buyer | Owner Seller | Admin | Validates dispute participation |
| Decide Dispute Verdict | No | No | No | Yes (with 2FA) | `/api/disputes/[id]/verdict` (requires ADMIN role & OTP) |
| Withdraw Seller Wallet | No | No | Owner Seller | No | `/api/wallet/withdraw` (validates hashed PIN) |
| Access Admin Console | No | No | No | Yes | `src/middleware.ts` guards `/admin/:path*` |

---

## 2. Resource Ownership Invariants

1. **Buyer Ownership**:
   `assert(order.buyerId === session.user.id)` must hold for:
   - Order receipt confirmation
   - Dispute opening
   - Viewing private checkout / payment detail
2. **Seller Ownership**:
   `assert(order.sellerId === session.user.id)` must hold for:
   - Marking order shipped
   - Submitting seller dispute evidence
   - Accessing seller wallet and requesting withdrawals
3. **Admin Privilege**:
   `assert(session.user.role === "ADMIN")` must hold for:
   - Viewing `/admin/*` routes
   - Executing dispute verdicts
   - Accessing security audit logs
