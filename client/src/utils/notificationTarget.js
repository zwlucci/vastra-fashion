function includesAny(value, terms) {
  const text = String(value || "").toLowerCase();
  return terms.some((term) => text.includes(term));
}

export function notificationTarget(notification, role) {
  const metadata = notification.metadata || {};
  if (metadata.targetUrl && String(metadata.targetUrl).startsWith("/")) return metadata.targetUrl;
  const type = `${notification.type || ""} ${metadata.targetType || ""} ${notification.title || ""}`;

  if (role === "admin") {
    if (includesAny(type, ["product approval", "product submitted", "pending product"])) return "/admin/dashboard/product-approvals";
    if (includesAny(type, ["coupon"])) return "/admin/dashboard/coupons";
    if (includesAny(type, ["contact", "message"])) return "/admin/dashboard/contact-messages";
    if (includesAny(type, ["product review"])) return "/admin/dashboard/product-reviews";
    if (includesAny(type, ["vendor review"])) return "/admin/dashboard/vendor-reviews";
    if (includesAny(type, ["review", "testimonial"])) return "/admin/dashboard/user-reviews";
    if (includesAny(type, ["user", "vendor registration", "vendor application"])) return "/admin/dashboard/users-vendors";
    return notification.orderId ? `/orders?orderId=${notification.orderId}` : "/admin/dashboard/stat-viewer";
  }

  if (role === "vendor") {
    if (includesAny(type, ["approval", "rejected", "product"])) return "/vendor/dashboard/products";
    if (includesAny(type, ["income", "payment", "payout"])) return "/vendor/dashboard/income";
    return "/vendor/dashboard/orders";
  }

  if (includesAny(type, ["message", "chat"])) return metadata.conversationId ? `/messages?conversationId=${metadata.conversationId}` : "/messages";
  if (includesAny(type, ["wishlist"])) return "/wishlist";
  if (includesAny(type, ["cart"])) return "/cart";
  if (metadata.productId) return `/shop/${metadata.productId}`;
  return notification.orderId ? `/orders?orderId=${notification.orderId}` : "/orders";
}
