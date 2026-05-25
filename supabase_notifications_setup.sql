-- Migration: Daffgle Push Notification Tokens Schema
-- Enforces: unique device tokens, RLS, and strict user ownership.

-- 1. Create table for storing device FCM tokens
CREATE TABLE IF NOT EXISTS notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Create index on user_id for high-performance notification query dispatching
CREATE INDEX IF NOT EXISTS idx_notification_tokens_user_id ON notification_tokens(user_id);

-- 3. Enable Row-Level Security (RLS) to secure tokens at the database level
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Policies: Only authenticated users can manage their own tokens
DROP POLICY IF EXISTS "Users can manage their own notification tokens" ON notification_tokens;
CREATE POLICY "Users can manage their own notification tokens"
ON notification_tokens
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
