ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS bundle_original_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS bundle_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_product_type_check,
  ADD CONSTRAINT products_product_type_check CHECK (product_type IN ('normal', 'bundle'));

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_bundle_discount_percentage_check,
  ADD CONSTRAINT products_bundle_discount_percentage_check CHECK (bundle_discount_percentage >= 0 AND bundle_discount_percentage <= 100);

CREATE TABLE IF NOT EXISTS product_bundle_items (
  bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bundle_product_id, component_product_id),
  CHECK (bundle_product_id <> component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_product_bundle_items_component ON product_bundle_items(component_product_id);
