CREATE TABLE IF NOT EXISTS home_collection_products (
  collection_key TEXT PRIMARY KEY CHECK (collection_key IN ('Men', 'Women', 'Unisex')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_collection_products_product_id
  ON home_collection_products(product_id);
