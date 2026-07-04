ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('card', 'cod')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('paid', 'pending', 'refunded')),
  ADD COLUMN IF NOT EXISTS delivery_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cardholder_name TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_expiry TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'none'
    CHECK (return_status IN ('none', 'requested', 'approved', 'rejected', 'completed')),
  ADD COLUMN IF NOT EXISTS return_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);
