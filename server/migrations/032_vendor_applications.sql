DO $$ BEGIN
  CREATE TYPE vendor_application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  business_email TEXT NOT NULL,
  business_address TEXT NOT NULL,
  business_description TEXT NOT NULL,
  subscription_plan TEXT NOT NULL CHECK (subscription_plan IN ('monthly', 'annual')),
  subscription_price NUMERIC(10, 2) NOT NULL CHECK (subscription_price IN (299, 2499)),
  status vendor_application_status NOT NULL DEFAULT 'pending',
  admin_message TEXT,
  supporting_document TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'not_required', 'paid')),
  subscription_status TEXT NOT NULL DEFAULT 'pending_admin_review' CHECK (subscription_status IN ('pending_admin_review', 'pending_payment', 'active', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_applications_one_pending
  ON vendor_applications(user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_vendor_applications_status_created
  ON vendor_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_applications_user_created
  ON vendor_applications(user_id, created_at DESC);

ALTER TABLE vendor_applications
  DROP CONSTRAINT IF EXISTS vendor_applications_subscription_price_check;

UPDATE vendor_applications
SET subscription_price = 2499
WHERE subscription_plan = 'annual'
  AND subscription_price <> 2499;

ALTER TABLE vendor_applications
  ADD CONSTRAINT vendor_applications_subscription_price_check
  CHECK (subscription_price IN (299, 2499));

DROP TRIGGER IF EXISTS vendor_applications_set_updated_at ON vendor_applications;
CREATE TRIGGER vendor_applications_set_updated_at BEFORE UPDATE ON vendor_applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE order_notifications DROP CONSTRAINT IF EXISTS order_notifications_type_check;
ALTER TABLE order_notifications
  ADD CONSTRAINT order_notifications_type_check CHECK (type IN (
    'order_placed',
    'status_updated',
    'order_cancelled',
    'return_requested',
    'return_updated',
    'payment_updated',
    'price_drop',
    'cod_refusal_recorded',
    'vendor_application_submitted',
    'vendor_application_approved',
    'vendor_application_rejected'
  ));
