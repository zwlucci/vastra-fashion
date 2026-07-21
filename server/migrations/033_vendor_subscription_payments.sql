UPDATE vendor_applications
SET subscription_price = 24999
WHERE subscription_plan = 'annual'
  AND subscription_price = 2499;

ALTER TABLE vendor_applications
  DROP CONSTRAINT IF EXISTS vendor_applications_subscription_price_check;

ALTER TABLE vendor_applications
  ADD CONSTRAINT vendor_applications_subscription_price_check
  CHECK (subscription_price IN (299, 24999));

ALTER TABLE vendor_applications
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expiry_date TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_vendor_applications_one_pending;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_applications_one_open
  ON vendor_applications(user_id)
  WHERE status IN ('pending', 'approved');

CREATE TABLE IF NOT EXISTS vendor_subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_application_id UUID NOT NULL REFERENCES vendor_applications(id) ON DELETE CASCADE,
  subscription_plan TEXT NOT NULL CHECK (subscription_plan IN ('monthly', 'annual')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount IN (299, 24999)),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'failed', 'cancelled')),
  transaction_reference TEXT NOT NULL,
  idempotency_key UUID NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscription_start_date TIMESTAMPTZ NOT NULL,
  subscription_expiry_date TIMESTAMPTZ NOT NULL,
  cardholder_name TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_application_id),
  UNIQUE (transaction_reference),
  UNIQUE (user_id, idempotency_key)
);

ALTER TABLE vendor_applications
  ADD COLUMN IF NOT EXISTS vendor_payment_id UUID REFERENCES vendor_subscription_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_subscription_payments_user_created
  ON vendor_subscription_payments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_subscription_payments_application
  ON vendor_subscription_payments(vendor_application_id);

DROP TRIGGER IF EXISTS vendor_subscription_payments_set_updated_at ON vendor_subscription_payments;
CREATE TRIGGER vendor_subscription_payments_set_updated_at BEFORE UPDATE ON vendor_subscription_payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
