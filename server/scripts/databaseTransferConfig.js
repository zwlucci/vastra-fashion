export const BACKUP_VERSION = 3;

// Parent tables must appear before tables that reference them.
export const TABLE_ORDER = [
  "users",
  "login_otps",
  "trusted_devices",
  "contact_messages",
  "products",
  "cart_items",
  "wishlist_items",
  "wardrobe_items",
  "wardrobe_combos",
  "home_collection_products",
  "orders",
  "order_items",
  "message_conversations",
  "conversation_archives",
  "conversation_messages",
  "reviews",
  "product_reviews",
  "vendor_reviews"
];

export function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
