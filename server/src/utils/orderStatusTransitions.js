import { AppError } from "./errors.js";

export const ORDER_STATUS_SEQUENCE = ["pending", "processing", "shipped", "delivered"];
export const FINAL_ORDER_STATUSES = ["delivered", "cancelled"];
export const USER_CANCELLABLE_STATUSES = ["pending", "processing"];
export const VENDOR_CANCELLABLE_STATUSES = ["pending", "processing"];

const allowedTransitions = ORDER_STATUS_SEQUENCE.reduce((transitions, status, index) => {
  transitions[status] = ORDER_STATUS_SEQUENCE[index + 1] ? [ORDER_STATUS_SEQUENCE[index + 1]] : [];
  return transitions;
}, { cancelled: [] });

export function normalizeOrderStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export function getNextOrderStatus(status) {
  const normalized = normalizeOrderStatus(status);
  return allowedTransitions[normalized]?.[0] || null;
}

export function assertForwardOrderTransition(currentStatus, requestedStatus, returnStatus = "none") {
  const current = normalizeOrderStatus(currentStatus);
  const requested = normalizeOrderStatus(requestedStatus);
  const next = getNextOrderStatus(current);

  if (!allowedTransitions[current] || !allowedTransitions[requested]) {
    throw new AppError("Unsupported order status.", 400);
  }
  if (returnStatus && returnStatus !== "none") {
    throw new AppError("Orders with an active return cannot re-enter delivery progression.", 409);
  }
  if (!next) {
    throw new AppError(`This order is finalized as ${current} and cannot be updated.`, 409);
  }
  if (requested !== next) {
    throw new AppError(`Order status can only move from ${current} to ${next}.`, 409);
  }

  return requested;
}

export function canUserCancelOrder(order) {
  return USER_CANCELLABLE_STATUSES.includes(normalizeOrderStatus(order?.status)) && (!order?.return_status || order.return_status === "none");
}

export function canVendorCancelOrder(order) {
  return VENDOR_CANCELLABLE_STATUSES.includes(normalizeOrderStatus(order?.status)) && (!order?.return_status || order.return_status === "none");
}

export function assertOrderCancellable(order, actorRole = "user") {
  const allowed = actorRole === "vendor" ? canVendorCancelOrder(order) : canUserCancelOrder(order);
  if (!allowed) {
    throw new AppError("Only pending or processing orders without active returns can be cancelled.", 409);
  }
}
