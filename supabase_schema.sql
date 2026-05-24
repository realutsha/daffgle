-- Migration: Anonymous Campus Network Upgrade (Daffgle)
-- 1. Add `hall` field to `profiles` table and clean up gender
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hall TEXT;

-- 2. Add database/backend validation for gender and hall options
-- Male only: YKSG 1, YKSG 2, YKSG 3
-- Female only: RASG 1, RASG 2
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_gender_hall;
ALTER TABLE profiles ADD CONSTRAINT check_gender_hall CHECK (
  (gender = 'Male' AND hall IN ('YKSG 1', 'YKSG 2', 'YKSG 3')) OR
  (gender = 'Female' AND hall IN ('RASG 1', 'RASG 2'))
);

-- 3. Create `help_requests` table
CREATE TABLE IF NOT EXISTS help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'I Need',
  status TEXT NOT NULL DEFAULT 'open',
  helper_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requester_hall TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Item must be from predefined options
  CONSTRAINT check_item CHECK (
    item IN ('Calculator', 'Charger', 'Pen', 'Notebook', 'Water Bottle', 'Umbrella', 'Power Bank', 'Extension Cable')
  ),
  
  -- Status must be one of: open, accepted, solved, cancelled
  CONSTRAINT check_status CHECK (
    status IN ('open', 'accepted', 'solved', 'cancelled')
  ),
  
  -- Prevent user from accepting their own request
  CONSTRAINT prevent_self_help CHECK (
    helper_id IS NULL OR requester_id <> helper_id
  )
);

-- 4. Enable Row Level Security (RLS) on help_requests
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

-- 5. Set up RLS Policies for `help_requests`
DROP POLICY IF EXISTS "Users can read same-hall open requests or own requests" ON help_requests;
CREATE POLICY "Users can read same-hall open requests or own requests"
ON help_requests
FOR SELECT
TO authenticated
USING (
  (status = 'open' AND requester_hall = (SELECT hall FROM profiles WHERE id = auth.uid())) OR
  requester_id = auth.uid() OR
  helper_id = auth.uid() OR
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

DROP POLICY IF EXISTS "Users can create requests for themselves" ON help_requests;
CREATE POLICY "Users can create requests for themselves"
ON help_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid() AND
  requester_hall = (SELECT hall FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Requester can update own request, helper can accept" ON help_requests;
CREATE POLICY "Requester can update own request, helper can accept"
ON help_requests
FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid() OR
  (status = 'open' AND requester_hall = (SELECT hall FROM profiles WHERE id = auth.uid()) AND requester_id <> auth.uid()) OR
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

-- 6. Add request cooldown: max 3 open help requests per user per hour
CREATE OR REPLACE FUNCTION check_request_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  open_count INT;
BEGIN
  -- Count open help requests created by the user in the last hour
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
