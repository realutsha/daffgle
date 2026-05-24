-- 1. Ensure the help_requests table has a conversation_id column to map requests to private chat conversations
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

-- 2. Enable Row-Level Security (RLS) on conversations and messages tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Drop all conflicting old RLS policies to avoid duplicates and syntax errors
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_select_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;

DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
DROP POLICY IF EXISTS "messages_update_policy" ON messages;
DROP POLICY IF EXISTS "messages_delete_policy" ON messages;
DROP POLICY IF EXISTS "Users can read messages if they have an active help request" ON messages;
DROP POLICY IF EXISTS "Users can insert messages only if they have an active help request" ON messages;

-- 4. Create RLS policies for conversations table
CREATE POLICY "conversations_select_policy"
ON conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM help_requests
    WHERE conversation_id = conversations.id
      AND (requester_id = auth.uid() OR helper_id = auth.uid())
  ) OR
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

CREATE POLICY "conversations_insert_policy"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Create RLS policies for messages table using conversation_id-based mapping
CREATE POLICY "messages_select_policy"
ON messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM help_requests
    WHERE conversation_id = messages.conversation_id
      AND (requester_id = auth.uid() OR helper_id = auth.uid())
  ) OR
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

CREATE POLICY "messages_insert_policy"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM help_requests
    WHERE conversation_id = messages.conversation_id
      AND (requester_id = auth.uid() OR helper_id = auth.uid())
      AND status IN ('accepted', 'solved')
  )
);

CREATE POLICY "messages_update_policy"
ON messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM help_requests
    WHERE conversation_id = messages.conversation_id
      AND (requester_id = auth.uid() OR helper_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM help_requests
    WHERE conversation_id = messages.conversation_id
      AND (requester_id = auth.uid() OR helper_id = auth.uid())
  )
);

CREATE POLICY "messages_delete_policy"
ON messages
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid() OR
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);
