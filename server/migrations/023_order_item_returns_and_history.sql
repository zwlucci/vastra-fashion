ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'none'
    CHECK (return_status IN ('none', 'requested', 'approved', 'rejected', 'completed')),
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_vendor_response TEXT,
  ADD COLUMN IF NOT EXISTS return_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_item_return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
  customer_reason TEXT,
  vendor_response TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_item_id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  status TEXT NOT NULL,
  status_category TEXT NOT NULL DEFAULT 'order'
    CHECK (status_category IN ('order', 'payment', 'return', 'refund')),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS order_item_return_requests_set_updated_at ON order_item_return_requests;
CREATE TRIGGER order_item_return_requests_set_updated_at BEFORE UPDATE ON order_item_return_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO order_item_return_requests (
  order_id, order_item_id, user_id, vendor_id, status, customer_reason,
  vendor_response, requested_at, decided_at, completed_at, created_at, updated_at
)
SELECT
  orders.id,
  order_items.id,
  orders.user_id,
  products.vendor_id,
  orders.return_status,
  orders.return_reason,
  orders.return_vendor_reason,
  COALESCE(orders.return_requested_at, orders.updated_at, orders.created_at),
  orders.return_decided_at,
  orders.return_processed_at,
  COALESCE(orders.return_requested_at, orders.updated_at, orders.created_at),
  COALESCE(orders.return_decided_at, orders.updated_at, orders.created_at)
FROM orders
JOIN order_items ON order_items.order_id = orders.id
LEFT JOIN products ON products.id = order_items.product_id
WHERE orders.return_status IN ('requested', 'approved', 'rejected', 'completed')
ON CONFLICT (order_item_id) DO NOTHING;

UPDATE order_items
SET
  return_status = orders.return_status,
  return_requested_at = COALESCE(orders.return_requested_at, orders.updated_at, orders.created_at),
  return_reason = orders.return_reason,
  return_vendor_response = orders.return_vendor_reason,
  return_decided_at = orders.return_decided_at,
  returned_at = orders.return_processed_at
FROM orders
WHERE order_items.order_id = orders.id
  AND orders.return_status IN ('requested', 'approved', 'rejected', 'completed')
  AND order_items.return_status = 'none';

INSERT INTO order_status_history (order_id, status, status_category, note, created_at)
SELECT id, 'order_placed', 'order', 'Order placed', created_at
FROM orders
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history AS history
  WHERE history.order_id = orders.id
    AND history.order_item_id IS NULL
    AND history.status = 'order_placed'
    AND history.status_category = 'order'
);

INSERT INTO order_status_history (order_id, status, status_category, note, created_at)
SELECT id, status::text, 'order', NULL, COALESCE(updated_at, created_at)
FROM orders
WHERE status <> 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM order_status_history AS history
    WHERE history.order_id = orders.id
      AND history.order_item_id IS NULL
      AND history.status = orders.status::text
      AND history.status_category = 'order'
  );

INSERT INTO order_status_history (order_id, status, status_category, note, created_at)
SELECT id,
       CASE WHEN payment_method = 'cod' THEN 'cash_on_delivery_selected' ELSE 'payment_confirmed' END,
       'payment',
       NULL,
       created_at
FROM orders
WHERE payment_method IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM order_status_history AS history
    WHERE history.order_id = orders.id
      AND history.order_item_id IS NULL
      AND history.status = CASE WHEN orders.payment_method = 'cod' THEN 'cash_on_delivery_selected' ELSE 'payment_confirmed' END
      AND history.status_category = 'payment'
  );

INSERT INTO order_status_history (order_id, order_item_id, actor_id, actor_role, status, status_category, note, created_at)
SELECT order_id, order_item_id, user_id, 'user', 'return_requested', 'return', customer_reason, requested_at
FROM order_item_return_requests
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history AS history
  WHERE history.order_id = order_item_return_requests.order_id
    AND history.order_item_id = order_item_return_requests.order_item_id
    AND history.status = 'return_requested'
    AND history.status_category = 'return'
);

INSERT INTO order_status_history (order_id, order_item_id, actor_id, actor_role, status, status_category, note, created_at)
SELECT order_id,
       order_item_id,
       vendor_id,
       'vendor',
       CASE status WHEN 'approved' THEN 'return_accepted' WHEN 'rejected' THEN 'return_rejected' WHEN 'completed' THEN 'product_returned' ELSE status END,
       'return',
       vendor_response,
       COALESCE(decided_at, completed_at, updated_at)
FROM order_item_return_requests
WHERE status IN ('approved', 'rejected', 'completed')
  AND NOT EXISTS (
    SELECT 1 FROM order_status_history AS history
    WHERE history.order_id = order_item_return_requests.order_id
      AND history.order_item_id = order_item_return_requests.order_item_id
      AND history.status = CASE order_item_return_requests.status WHEN 'approved' THEN 'return_accepted' WHEN 'rejected' THEN 'return_rejected' WHEN 'completed' THEN 'product_returned' ELSE order_item_return_requests.status END
      AND history.status_category = 'return'
  );

CREATE INDEX IF NOT EXISTS idx_order_item_returns_vendor_status ON order_item_return_requests(vendor_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_item_returns_order ON order_item_return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_return_status ON order_items(return_status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created ON order_status_history(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_item ON order_status_history(order_item_id, created_at);
