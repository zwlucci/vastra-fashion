CREATE TABLE IF NOT EXISTS conversation_archives (
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_archives_user_id
  ON conversation_archives(user_id, archived_at DESC);
