CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  subscribed BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_lower_idx
  ON newsletter_subscribers (LOWER(email));

CREATE INDEX IF NOT EXISTS newsletter_subscribers_active_idx
  ON newsletter_subscribers (subscribed)
  WHERE subscribed = true;

DROP TRIGGER IF EXISTS newsletter_subscribers_set_updated_at ON newsletter_subscribers;
CREATE TRIGGER newsletter_subscribers_set_updated_at BEFORE UPDATE ON newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS newsletter_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  heading TEXT NOT NULL,
  message TEXT NOT NULL,
  cta_text TEXT,
  cta_url TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'partially_failed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS newsletter_broadcasts_created_at_idx
  ON newsletter_broadcasts (created_at DESC);
