CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  cardholder_name TEXT NOT NULL,
  encrypted_card_number TEXT NOT NULL,
  card_number_iv TEXT NOT NULL,
  card_number_auth_tag TEXT NOT NULL,
  card_last_four TEXT NOT NULL CHECK (card_last_four ~ '^[0-9]{4}$'),
  card_brand TEXT NOT NULL,
  expiry_month INTEGER NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year INTEGER NOT NULL CHECK (expiry_year BETWEEN 2024 AND 2100),
  billing_address TEXT NOT NULL,
  billing_city TEXT NOT NULL,
  billing_state TEXT NOT NULL DEFAULT '',
  billing_country TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_payment_methods_one_default
  ON saved_payment_methods(user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_user_created
  ON saved_payment_methods(user_id, created_at DESC);

DROP TRIGGER IF EXISTS saved_payment_methods_set_updated_at ON saved_payment_methods;
CREATE TRIGGER saved_payment_methods_set_updated_at BEFORE UPDATE ON saved_payment_methods
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
