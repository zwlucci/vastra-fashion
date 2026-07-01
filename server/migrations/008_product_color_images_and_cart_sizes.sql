ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS selected_color TEXT NOT NULL DEFAULT '';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS selected_color TEXT NOT NULL DEFAULT '';

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key,
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_selected_size_key;

DROP INDEX IF EXISTS idx_cart_items_user_product_size;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product_size_color
  ON cart_items(user_id, product_id, selected_size, selected_color);
