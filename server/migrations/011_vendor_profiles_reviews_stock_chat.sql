ALTER TABLE message_conversations
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS read_by_vendor BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_alert_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_of_stock_alert_sent BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_conversations_vendor_id ON message_conversations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pinned_created_at ON reviews(pinned DESC, created_at DESC);

DROP TRIGGER IF EXISTS reviews_set_updated_at ON reviews;
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
