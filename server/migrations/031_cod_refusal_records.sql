ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivery_refused';

CREATE TABLE IF NOT EXISTS cod_refusal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reported_by_vendor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'Customer refused to accept the package',
    'Customer refused to pay',
    'Customer was repeatedly unavailable and later refused',
    'Customer said they no longer wanted the order after shipment',
    'Other'
  )),
  additional_details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason TEXT,
  CHECK (revoked_at IS NULL OR revocation_reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cod_refusal_records_one_active_per_order
  ON cod_refusal_records(order_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cod_refusal_records_user_active
  ON cod_refusal_records(user_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cod_refusal_records_order
  ON cod_refusal_records(order_id);

CREATE INDEX IF NOT EXISTS idx_cod_refusal_records_vendor
  ON cod_refusal_records(reported_by_vendor_id, created_at DESC);

ALTER TABLE order_notifications
  DROP CONSTRAINT IF EXISTS order_notifications_type_check,
  ADD CONSTRAINT order_notifications_type_check
    CHECK (type IN (
      'order_placed',
      'status_updated',
      'order_cancelled',
      'return_requested',
      'return_updated',
      'payment_updated',
      'price_drop',
      'cod_refusal_recorded'
    ));
