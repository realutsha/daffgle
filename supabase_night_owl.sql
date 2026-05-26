-- ==========================================================
-- Migration: Daffgle "Night Owl Mode" Feature Database Setup
-- Enforces: Strict timezone constraints, complete anonymity,
--           spam protection, automated exipry, and secure RLS.
-- ==========================================================

-- 1. Helper function to calculate the next 6:00 AM BDT (Bangladesh Time, UTC+6)
CREATE OR REPLACE FUNCTION get_next_bdt_expiry()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  now_bdt TIMESTAMP;
  expiry_bdt TIMESTAMP;
BEGIN
  -- Get current timestamp in Asia/Dhaka
  now_bdt := now() AT TIME ZONE 'Asia/Dhaka';
  -- Default to today at 6:00 AM BDT
  expiry_bdt := date_trunc('day', now_bdt) + interval '6 hours';
  
  -- If current BDT time is already past 6:00 AM BDT, expire at tomorrow's 6:00 AM BDT
  IF now_bdt >= expiry_bdt THEN
    expiry_bdt := expiry_bdt + interval '1 day';
  END IF;
  
  -- Convert back to Timestamptz for database storage
  RETURN expiry_bdt AT TIME ZONE 'Asia/Dhaka';
END;
$$ LANGUAGE plpgsql;

-- 2. Create the `night_requests` table
CREATE TABLE IF NOT EXISTS night_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT get_next_bdt_expiry() NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  
  -- Limit mood selections to the 5 requested late-night moods
  CONSTRAINT check_mood CHECK (
    mood IN ('Can’t sleep', 'Studying', 'Coding all night', 'Need conversation', 'Feeling lonely')
  ),
  
  -- Limit statuses to: open, accepted, expired
  CONSTRAINT check_status CHECK (
    status IN ('open', 'accepted', 'expired')
  )
);

-- 3. Create the `night_sessions` table
CREATE TABLE IF NOT EXISTS night_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES night_requests(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT get_next_bdt_expiry() NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  
  -- Requester and Accepter must be different users
  CONSTRAINT check_different_users CHECK (
    requester_id <> accepter_id
  )
);

-- 4. Unique Partial Index: A student can only have ONE active request at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_request_per_user 
ON night_requests (requester_id) 
WHERE (active = true);

-- 5. Create index optimization for faster queries
CREATE INDEX IF NOT EXISTS idx_night_requests_active ON night_requests(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_night_sessions_active ON night_sessions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_night_sessions_participants ON night_sessions(requester_id, accepter_id);

-- 6. Trigger: Strict active-hour validation (Creation only allowed between 3:00 AM and 6:00 AM BDT)
CREATE OR REPLACE FUNCTION check_night_owl_active_hours()
RETURNS TRIGGER AS $$
DECLARE
  current_hour_bdt INT;
BEGIN
  -- Extract current hour in Asia/Dhaka timezone
  SELECT EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Dhaka'))
  INTO current_hour_bdt;

  IF current_hour_bdt < 3 OR current_hour_bdt >= 6 THEN
    RAISE EXCEPTION 'Night Owl Mode is closed. It is only accessible between 3:00 AM and 6:00 AM Bangladesh Time (BDT).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_night_owl_active_hours ON night_requests;
CREATE TRIGGER trg_check_night_owl_active_hours
BEFORE INSERT ON night_requests
FOR EACH ROW
EXECUTE FUNCTION check_night_owl_active_hours();

-- 7. Trigger: 5-minute cooldown between request submissions to prevent spamming
CREATE OR REPLACE FUNCTION check_night_request_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  last_request_time TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT created_at
  INTO last_request_time
  FROM night_requests
  WHERE requester_id = NEW.requester_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_request_time IS NOT NULL AND last_request_time > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Request cooldown: Please wait 5 minutes before submitting another Night Owl request.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_night_request_cooldown ON night_requests;
CREATE TRIGGER trg_check_night_request_cooldown
BEFORE INSERT ON night_requests
FOR EACH ROW
EXECUTE FUNCTION check_night_request_cooldown();

-- 8. Enable Row-Level Security (RLS) on both tables
ALTER TABLE night_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_sessions ENABLE ROW LEVEL SECURITY;

-- 9. Setup RLS Policies on `night_requests`
DROP POLICY IF EXISTS "Anyone authenticated can see active night requests" ON night_requests;
CREATE POLICY "Anyone authenticated can see active night requests"
ON night_requests
FOR SELECT
TO authenticated
USING (active = true);

DROP POLICY IF EXISTS "Users can only create their own requests" ON night_requests;
CREATE POLICY "Users can only create their own requests"
ON night_requests
FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Users can only delete their own requests" ON night_requests;
CREATE POLICY "Users can only delete their own requests"
ON night_requests
FOR DELETE
TO authenticated
USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "Users can update requests to accept or complete them" ON night_requests;
CREATE POLICY "Users can update requests to accept or complete them"
ON night_requests
FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid() OR
  (status = 'open' AND requester_id <> auth.uid())
)
WITH CHECK (
  (requester_id = auth.uid()) OR
  (status = 'accepted' AND active = false)
);

-- 10. Setup RLS Policies on `night_sessions`
DROP POLICY IF EXISTS "Session participants can view sessions" ON night_sessions;
CREATE POLICY "Session participants can view sessions"
ON night_sessions
FOR SELECT
TO authenticated
USING (requester_id = auth.uid() OR accepter_id = auth.uid());

DROP POLICY IF EXISTS "Session participants can insert sessions" ON night_sessions;
CREATE POLICY "Session participants can insert sessions"
ON night_sessions
FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid() OR accepter_id = auth.uid());

DROP POLICY IF EXISTS "Session participants can update sessions" ON night_sessions;
CREATE POLICY "Session participants can update sessions"
ON night_sessions
FOR UPDATE
TO authenticated
USING (requester_id = auth.uid() OR accepter_id = auth.uid());

-- 11. Authorize existing messages and conversations RLS policy for Night Owl
-- Allows participants to chat through standard private chats for active Night Owl sessions
DROP POLICY IF EXISTS "conversations_select_night_owl" ON conversations;
CREATE POLICY "conversations_select_night_owl"
ON conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM night_sessions
    WHERE conversation_id = conversations.id
      AND (requester_id = auth.uid() OR accepter_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "messages_select_night_owl" ON messages;
CREATE POLICY "messages_select_night_owl"
ON messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM night_sessions
    WHERE conversation_id = messages.conversation_id
      AND (requester_id = auth.uid() OR accepter_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "messages_insert_night_owl" ON messages;
CREATE POLICY "messages_insert_night_owl"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM night_sessions
    WHERE conversation_id = messages.conversation_id
      AND (requester_id = auth.uid() OR accepter_id = auth.uid())
      AND active = true
  )
);

-- 12. Register tables to the standard realtime publication for instant broadcasts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE night_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE night_sessions;
  END IF;
END $$;
