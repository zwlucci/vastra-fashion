CREATE TABLE IF NOT EXISTS saved_checkout_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nepal',
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT '',
  detailed_address TEXT NOT NULL,
  postal_code TEXT NOT NULL DEFAULT '',
  delivery_instructions TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_checkout_addresses_one_default
  ON saved_checkout_addresses(user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_saved_checkout_addresses_user_created
  ON saved_checkout_addresses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_payment_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cod', 'card', 'esewa')),
  label TEXT NOT NULL DEFAULT '',
  cardholder_name TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  provider_reference TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    method <> 'card'
    OR (
      card_last4 IS NULL
      OR card_last4 ~ '^[0-9]{4}$'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_payment_preferences_one_default
  ON saved_payment_preferences(user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_saved_payment_preferences_user_created
  ON saved_payment_preferences(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_created
  ON password_reset_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_active
  ON password_reset_requests(user_id, expires_at)
  WHERE used_at IS NULL;

DROP TRIGGER IF EXISTS saved_checkout_addresses_set_updated_at ON saved_checkout_addresses;
CREATE TRIGGER saved_checkout_addresses_set_updated_at BEFORE UPDATE ON saved_checkout_addresses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS saved_payment_preferences_set_updated_at ON saved_payment_preferences;
CREATE TRIGGER saved_payment_preferences_set_updated_at BEFORE UPDATE ON saved_payment_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
