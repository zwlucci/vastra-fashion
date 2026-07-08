ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_dispatch_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_receipt_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_receipt_dispatch_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_processed_at TIMESTAMPTZ;
