CREATE TABLE IF NOT EXISTS message_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_message_id UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'vendor', 'admin', 'system-admin')),
  body TEXT NOT NULL,
  image_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  read_by_user BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';

DROP INDEX IF EXISTS idx_message_conversations_contact_message_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_conversations_contact_message_id
  ON message_conversations(contact_message_id);

CREATE INDEX IF NOT EXISTS idx_message_conversations_user_id
  ON message_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id
  ON conversation_messages(conversation_id);

DROP TRIGGER IF EXISTS message_conversations_set_updated_at ON message_conversations;
CREATE TRIGGER message_conversations_set_updated_at BEFORE UPDATE ON message_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
