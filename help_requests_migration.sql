-- Daffgle Campus Network - help_requests Table Migration
-- 1. Safely drop existing table (and cascade-drop associated views/triggers/policies)
DROP TABLE IF EXISTS help_requests CASCADE;

-- 2. Create the production-ready help_requests table
CREATE TABLE help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  helper_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  hall TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  karma_priority INT NOT NULL DEFAULT 0,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Predefined status options constraint
  CONSTRAINT check_status CHECK (
    status IN ('open', 'accepted', 'solved', 'cancelled')
  ),
  
  -- Prevent users from helping themselves
  CONSTRAINT prevent_self_help CHECK (
    helper_id IS NULL OR requester_id <> helper_id
  )
);

-- 3. Create high-performance indexes for foreign keys, status, and hall filters
CREATE INDEX IF NOT EXISTS idx_help_requests_hall ON help_requests(hall);
CREATE INDEX IF NOT EXISTS idx_help_requests_status ON help_requests(status);
CREATE INDEX IF NOT EXISTS idx_help_requests_requester_id ON help_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_help_requests_helper_id ON help_requests(helper_id);

-- 4. Enable Row Level Security (RLS) on help_requests
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

-- 5. Establish Row Level Security Policies
-- Policy A: Requester can read own requests
DROP POLICY IF EXISTS "requester_read_own_requests" ON help_requests;
CREATE POLICY "requester_read_own_requests"
ON help_requests
FOR SELECT
TO authenticated
USING (requester_id = auth.uid());

-- Policy B: Same-hall users can read open requests
DROP POLICY IF EXISTS "same_hall_read_open_requests" ON help_requests;
CREATE POLICY "same_hall_read_open_requests"
ON help_requests
FOR SELECT
TO authenticated
USING (status = 'open' AND hall = (SELECT hall FROM profiles WHERE id = auth.uid()));

-- Policy C: Helper can read accepted requests
DROP POLICY IF EXISTS "helper_read_accepted_requests" ON help_requests;
CREATE POLICY "helper_read_accepted_requests"
ON help_requests
FOR SELECT
TO authenticated
USING (helper_id = auth.uid());

-- Policy D: Admins can read all help requests
DROP POLICY IF EXISTS "admin_read_all_requests" ON help_requests;
CREATE POLICY "admin_read_all_requests"
ON help_requests
FOR SELECT
TO authenticated
USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);

-- Policy E: Authenticated users can create requests for themselves in their own hall
DROP POLICY IF EXISTS "users_create_own_requests" ON help_requests;
CREATE POLICY "users_create_own_requests"
ON help_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid() AND
  hall = (SELECT hall FROM profiles WHERE id = auth.uid())
);

-- Policy F: Requester can update their own request; helper can accept; admin can update all
DROP POLICY IF EXISTS "update_help_requests" ON help_requests;
CREATE POLICY "update_help_requests"
ON help_requests
FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid() OR
  (status = 'open' AND hall = (SELECT hall FROM profiles WHERE id = auth.uid()) AND requester_id <> auth.uid()) OR
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
)
WITH CHECK (
  -- Requester can change status to cancelled, solved, or keep it open
  (requester_id = auth.uid() AND (status IN ('cancelled', 'solved', 'open'))) OR
  -- Helper can change status to 'accepted' and set helper_id to themselves
  (status = 'accepted' AND helper_id = auth.uid() AND requester_id <> auth.uid()) OR
  -- Admin can manage everything
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 6. Trigger-based hourly request cooldown logic (max 3 open requests per user per hour)
CREATE OR REPLACE FUNCTION check_request_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  open_count INT;
BEGIN
  SELECT COUNT(*)
  INTO open_count
  FROM help_requests
  WHERE requester_id = NEW.requester_id
    AND status = 'open'
    AND created_at > now() - interval '1 hour';
    
  IF open_count >= 3 THEN
    RAISE EXCEPTION 'Request cooldown: max 3 open help requests per user per hour.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_request_cooldown ON help_requests;
CREATE TRIGGER trg_check_request_cooldown
BEFORE INSERT ON help_requests
FOR EACH ROW
EXECUTE FUNCTION check_request_cooldown();

-- 7. Trigger to automatically increment helper reputation (karma) when request status changes to 'solved'
CREATE OR REPLACE FUNCTION increment_helper_karma()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'solved' AND OLD.status = 'accepted' AND NEW.helper_id IS NOT NULL THEN
    UPDATE profiles
    SET karma = karma + 1
    WHERE id = NEW.helper_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_helper_karma ON help_requests;
CREATE TRIGGER trg_increment_helper_karma
AFTER UPDATE ON help_requests
FOR EACH ROW
EXECUTE FUNCTION increment_helper_karma();

-- 8. Re-register help_requests table in supabase_realtime publication for real-time broadcasts
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS help_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE help_requests;
