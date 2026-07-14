ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS return_vendor_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_vendor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_decided_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS dashboard_section_seen (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, section_key)
);

CREATE TABLE IF NOT EXISTS product_price_drop_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_price NUMERIC(10, 2) NOT NULL,
  new_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, previous_price, new_price)
);

DO $$
BEGIN
  ALTER TABLE order_notifications DROP CONSTRAINT IF EXISTS order_notifications_type_check;
  ALTER TABLE order_notifications
    ADD CONSTRAINT order_notifications_type_check
    CHECK (type IN ('order_placed', 'status_updated', 'order_cancelled', 'return_requested', 'return_updated', 'payment_updated', 'price_drop'));
END $$;

CREATE INDEX IF NOT EXISTS idx_dashboard_section_seen_user ON dashboard_section_seen(user_id, section_key);
CREATE INDEX IF NOT EXISTS idx_products_public_search ON products(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm_fallback ON products(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_orders_status_updated ON orders(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_return_vendor_status ON orders(return_status, return_requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_price_drop_events_product ON product_price_drop_events(product_id, created_at DESC);
