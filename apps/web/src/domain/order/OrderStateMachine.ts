// NgeBekasinYuk Order State Machine
// Authoritative central transition policy enforcing business invariants, actor permissions, and ownership.

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "FUNDED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "INSPECTING"
  | "COMPLETED"
  | "DISPUTED"
  | "RESOLVED_BUYER"
  | "RESOLVED_SELLER"
  | "REFUNDED"
  | "CANCELLED";

export type ActorRole = "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";

export interface OrderTransitionContext {
  actorId: string;
  actorRole: ActorRole;
  order: {
    id: string;
    buyerId: string;
    sellerId: string;
    status: OrderStatus;
    shippingAirwayBill?: string | null;
    inspectionExpiresAt?: Date | null;
  };
  now?: Date;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

export class OrderStateTransitionError extends Error {
  public readonly code: string;
  public readonly fromStatus: OrderStatus;
  public readonly toStatus: OrderStatus;

  constructor(
    code: string,
    message: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus
  ) {
    super(message);
    this.name = "OrderStateTransitionError";
    this.code = code;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * Evaluates whether a requested order status transition is permissible.
 */
export function canTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  context: OrderTransitionContext
): TransitionValidationResult {
  const { actorId, actorRole, order, now = new Date() } = context;

  // 1. Current status must match the order's actual persisted status
  if (order.status !== fromStatus) {
    return {
      allowed: false,
      reason: `Order is currently in ${order.status}, not ${fromStatus}`,
    };
  }

  // 2. Terminal states cannot be altered
  const terminalStates: OrderStatus[] = ["COMPLETED", "REFUNDED", "CANCELLED"];
  if (terminalStates.includes(fromStatus)) {
    return {
      allowed: false,
      reason: `Order is in terminal state ${fromStatus} and cannot transition further`,
    };
  }

  // 3. No-op duplicate transitions
  if (fromStatus === toStatus) {
    return {
      allowed: false,
      reason: `Order is already in status ${toStatus}`,
    };
  }

  // 4. Role & Ownership checks
  const isBuyerOwner = actorRole === "BUYER" && actorId === order.buyerId;
  const isSellerOwner = actorRole === "SELLER" && actorId === order.sellerId;
  const isAdmin = actorRole === "ADMIN";
  const isSystem = actorRole === "SYSTEM";

  switch (fromStatus) {
    case "PENDING_PAYMENT":
      if (toStatus === "FUNDED") {
        if (!isSystem && !isAdmin) {
          return { allowed: false, reason: "Only payment webhook or admin can confirm funding" };
        }
        return { allowed: true };
      }
      if (toStatus === "CANCELLED") {
        if (!isBuyerOwner && !isSystem && !isAdmin) {
          return { allowed: false, reason: "Only buyer, system, or admin can cancel unpaid order" };
        }
        return { allowed: true };
      }
      break;

    case "FUNDED":
      if (toStatus === "PROCESSING") {
        if (!isSellerOwner && !isAdmin) {
          return { allowed: false, reason: "Only seller owner or admin can move order to processing" };
        }
        return { allowed: true };
      }
      if (toStatus === "SHIPPED") {
        if (!isSellerOwner && !isAdmin) {
          return { allowed: false, reason: "Only seller owner or admin can mark order as shipped" };
        }
        return { allowed: true };
      }
      if (toStatus === "CANCELLED") {
        if (!isAdmin) {
          return { allowed: false, reason: "Funded orders can only be cancelled/refunded via admin mediation" };
        }
        return { allowed: true };
      }
      break;

    case "PROCESSING":
      if (toStatus === "SHIPPED") {
        if (!isSellerOwner && !isAdmin) {
          return { allowed: false, reason: "Only seller owner or admin can mark order as shipped" };
        }
        return { allowed: true };
      }
      break;

    case "SHIPPED":
      if (toStatus === "DELIVERED") {
        if (!isSystem && !isAdmin) {
          return { allowed: false, reason: "Only courier webhook or admin can mark order as delivered" };
        }
        return { allowed: true };
      }
      break;

    case "DELIVERED":
      if (toStatus === "INSPECTING") {
        if (!isSystem && !isAdmin) {
          return { allowed: false, reason: "Inspecting timer is initiated by system upon delivery" };
        }
        return { allowed: true };
      }
      break;

    case "INSPECTING":
      if (toStatus === "COMPLETED") {
        if (isBuyerOwner) {
          return { allowed: true }; // Buyer explicitly confirmed receipt
        }
        if (isSystem || isAdmin) {
          // Auto-release condition: inspection window has expired
          if (order.inspectionExpiresAt && now >= order.inspectionExpiresAt) {
            return { allowed: true };
          }
          if (isAdmin) return { allowed: true };
          return {
            allowed: false,
            reason: "Inspection period has not yet expired for auto-completion",
          };
        }
        return { allowed: false, reason: "Only buyer owner or system timeout can complete inspection" };
      }
      if (toStatus === "DISPUTED") {
        if (!isBuyerOwner) {
          return { allowed: false, reason: "Only the buyer owner can open a dispute during inspection" };
        }
        if (order.inspectionExpiresAt && now > order.inspectionExpiresAt) {
          return {
            allowed: false,
            reason: "Inspection period has expired. Dispute cannot be opened automatically.",
          };
        }
        return { allowed: true };
      }
      break;

    case "DISPUTED":
      if (toStatus === "RESOLVED_BUYER" || toStatus === "RESOLVED_SELLER") {
        if (!isAdmin) {
          return { allowed: false, reason: "Only authorized administrator can decide dispute resolution" };
        }
        return { allowed: true };
      }
      break;

    case "RESOLVED_BUYER":
      if (toStatus === "REFUNDED") {
        if (!isSystem && !isAdmin) {
          return { allowed: false, reason: "Only system or admin can execute refund" };
        }
        return { allowed: true };
      }
      break;

    case "RESOLVED_SELLER":
      if (toStatus === "COMPLETED") {
        if (!isSystem && !isAdmin) {
          return { allowed: false, reason: "Only system or admin can finalize seller payout completion" };
        }
        return { allowed: true };
      }
      break;
  }

  return {
    allowed: false,
    reason: `Invalid transition path from ${fromStatus} to ${toStatus}`,
  };
}

/**
 * Asserts that a transition is permissible, throwing a typed OrderStateTransitionError if not.
 */
export function assertTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  context: OrderTransitionContext
): void {
  const result = canTransition(fromStatus, toStatus, context);
  if (!result.allowed) {
    throw new OrderStateTransitionError(
      "INVALID_ORDER_TRANSITION",
      result.reason || `Forbidden transition from ${fromStatus} to ${toStatus}`,
      fromStatus,
      toStatus
    );
  }
}
