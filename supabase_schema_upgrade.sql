-- Migration: Daffgle Campus Network Upgrade
-- Enforces: karma, profile edit limits, reports, warning badges, and administrative auditing.

-- 1. Upgrade `profiles` table with reputation, cooldown tracking, and warning badges
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS karma INT DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_edit_count INT DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_profile_edit_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS warning_badge TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT TRUE NOT NULL;

-- Enforce warning badge options via CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_warning_badge;
ALTER TABLE profiles ADD CONSTRAINT check_warning_badge CHECK (
  warning_badge IS NULL OR 
  warning_badge IN ('Under Investigation', 'Reported User', 'Fake Helper Suspected')
);

-- 2. Create or upgrade `reports` table with linked request and conversation references
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add linked request and conversation columns for admin audits
ALTER TABLE reports ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES help_requests(id) ON DELETE SET NULL;

-- Enforce valid report reasons
ALTER TABLE reports DROP CONSTRAINT IF EXISTS check_report_reason;
ALTER TABLE reports ADD CONSTRAINT check_report_reason CHECK (
  reason IN ('Fake helper', 'Did not help', 'Abusive behavior', 'Harassment', 'Spam', 'Suspicious activity')
);

-- Enable RLS on reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 3. Create or upgrade `moderation_logs` table for administrative tracing
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on moderation_logs
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- 4. Enable Row Level Security Policies for Reports & Logs
DROP POLICY IF EXISTS "Users can insert reports" ON reports;
CREATE POLICY "Users can insert reports"
ON reports
FOR INSERT
TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can view and update reports" ON reports;
CREATE POLICY "Admins can view and update reports"
ON reports
FOR ALL
TO authenticated
USING (
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

DROP POLICY IF EXISTS "Admins can manage moderation logs" ON moderation_logs;
CREATE POLICY "Admins can manage moderation logs"
ON moderation_logs
FOR ALL
TO authenticated
USING (
  (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 5. Trigger-based Profile Edit Cooldown (30-day block after 2 free edits) & Gender/Hall validation
CREATE OR REPLACE FUNCTION check_profile_edit_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger check only if user identity attributes are modified
  IF (OLD.anonymous_username IS DISTINCT FROM NEW.anonymous_username OR
      OLD.department IS DISTINCT FROM NEW.department OR
      OLD.gender IS DISTINCT FROM NEW.gender OR
      OLD.hall IS DISTINCT FROM NEW.hall) THEN

    -- Backend/DB Hall and Gender matching validation
    IF NEW.gender = 'Male' AND NEW.hall NOT IN ('YKSG 1', 'YKSG 2', 'YKSG 3') THEN
      RAISE EXCEPTION 'Male users can only select YKSG 1, YKSG 2, or YKSG 3.';
    ELSIF NEW.gender = 'Female' AND NEW.hall NOT IN ('RASG 1', 'RASG 2') THEN
      RAISE EXCEPTION 'Female users can only select RASG 1 or RASG 2.';
    END IF;

    -- Cooldown rule: First 2 edits are free (profile_edit_count = 0 and 1 are free)
    IF OLD.profile_edit_count >= 2 THEN
      IF OLD.last_profile_edit_at IS NOT NULL AND OLD.last_profile_edit_at > now() - interval '30 days' THEN
        RAISE EXCEPTION 'Profile edit cooldown active. You can edit your profile again in % days.', 
          EXTRACT(DAY FROM (OLD.last_profile_edit_at + interval '30 days' - now()))::INT;
      END IF;
    END IF;

    -- Securely increment edit count and update modification timestamp
    NEW.profile_edit_count := COALESCE(OLD.profile_edit_count, 0) + 1;
    NEW.last_profile_edit_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind cooldown trigger to profiles table
DROP TRIGGER IF EXISTS trg_check_profile_edit_cooldown ON profiles;
CREATE TRIGGER trg_check_profile_edit_cooldown
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_profile_edit_cooldown();

-- 6. Trigger to automatically increment helper karma when a request status changes to 'solved'
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

-- Bind helper karma trigger to help_requests table
DROP TRIGGER IF EXISTS trg_increment_helper_karma ON help_requests;
CREATE TRIGGER trg_increment_helper_karma
AFTER UPDATE ON help_requests
FOR EACH ROW
EXECUTE FUNCTION increment_helper_karma();

-- 7. Trigger to automatically assign Reported User warning badge when a user is reported
CREATE OR REPLACE FUNCTION set_reported_user_badge()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET warning_badge = 'Reported User'
  WHERE id = NEW.reported_id AND warning_badge IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind reported user trigger to reports table
DROP TRIGGER IF EXISTS trg_set_reported_user_badge ON reports;
CREATE TRIGGER trg_set_reported_user_badge
AFTER INSERT ON reports
FOR EACH ROW
EXECUTE FUNCTION set_reported_user_badge();
