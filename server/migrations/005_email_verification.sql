ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET email_verified = true,
    email_verification_otp_hash = NULL,
    email_verification_expires = NULL,
    email_verification_attempts = 0
WHERE email LIKE '%@example.com';
