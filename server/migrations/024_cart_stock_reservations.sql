ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_status TEXT NOT NULL DEFAULT 'expired',
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_reserved_quantity_check,
  ADD CONSTRAINT cart_items_reserved_quantity_check CHECK (reserved_quantity >= 0),
  DROP CONSTRAINT IF EXISTS cart_items_reservation_status_check,
  ADD CONSTRAINT cart_items_reservation_status_check
    CHECK (reservation_status IN ('active', 'converted', 'released', 'expired'));

UPDATE cart_items
SET reservation_status = 'expired',
    reserved_quantity = 0,
    reservation_expires_at = COALESCE(reservation_expires_at, created_at)
WHERE reservation_status = 'expired'
  AND reservation_expires_at IS NULL
  AND reserved_quantity = 0;

DROP INDEX IF EXISTS idx_cart_items_user_product_size_color;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_active_reservation_unique
  ON cart_items(user_id, product_id, selected_size, selected_color)
  WHERE reservation_status = 'active';

CREATE INDEX IF NOT EXISTS idx_cart_items_reservation_expiry
  ON cart_items(reservation_status, reservation_expires_at)
  WHERE reservation_status = 'active';

CREATE INDEX IF NOT EXISTS idx_cart_items_user_reservation_status
  ON cart_items(user_id, reservation_status, created_at DESC);

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
