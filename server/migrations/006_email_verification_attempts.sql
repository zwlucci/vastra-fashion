ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET email_verification_attempts = 0
WHERE email_verification_attempts IS NULL;
