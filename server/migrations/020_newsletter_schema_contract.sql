CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE newsletter_subscribers
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'newsletter_subscribers'
      AND column_name = 'subscribed'
  ) THEN
    UPDATE newsletter_subscribers
    SET is_active = subscribed
    WHERE subscribed IS DISTINCT FROM is_active;
  END IF;
END $$;

UPDATE newsletter_subscribers
SET unsubscribe_token = REPLACE(uuid_generate_v4()::text, '-', '') || REPLACE(uuid_generate_v4()::text, '-', '')
WHERE unsubscribe_token IS NULL OR LENGTH(TRIM(unsubscribe_token)) < 32;

ALTER TABLE newsletter_subscribers
  ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_lower_idx
  ON newsletter_subscribers (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_unsubscribe_token_idx
  ON newsletter_subscribers (unsubscribe_token);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_is_active_idx
  ON newsletter_subscribers (is_active)
  WHERE is_active = true;

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
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('draft', 'processing', 'completed', 'partially_failed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE newsletter_broadcasts
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS newsletter_broadcasts_created_at_idx
  ON newsletter_broadcasts (created_at DESC);
