-- ==========================================================
-- Migration: Daffgle Production Cybersecurity Hardening
-- Enforces: Domain-restricted signup gate, admin parameters protection,
--           message updates integrity, help request immutability,
--           and strict RLS access policies.
-- ==========================================================

-- 1. AUTH REGISTRATION GATE
-- Enforces that email signups are strictly from the @diu.edu.bd university domain,
-- fully Google OAuth compatible, and whitelists designated administrators.
CREATE OR REPLACE FUNCTION public.check_auth_email()
RETURNS TRIGGER AS $$
DECLARE
  allowed BOOLEAN;
  admin_email TEXT := 'madhurzamutsha@gmail.com';
BEGIN
  -- Only enforce restrictions if an email is provided (Phone and Anon sign-ins bypass)
  IF NEW.email IS NOT NULL THEN
    allowed := (NEW.email ILIKE '%@diu.edu.bd') OR (LOWER(NEW.email) = LOWER(admin_email));
    
    IF NOT allowed THEN
      RAISE EXCEPTION 'Access denied: Only @diu.edu.bd university emails are allowed.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_auth_email ON auth.users;
CREATE TRIGGER trg_check_auth_email
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.check_auth_email();


-- 2. SECURE MESSAGE UPDATES INTEGRITY
-- Blocks other chat participants from modifying message body text or details.
-- The message recipient is ONLY allowed to update the seen column to true.
CREATE OR REPLACE FUNCTION public.secure_message_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Message authors can retract/delete or update details, but metadata is locked
  IF OLD.sender_id = auth.uid() THEN
    IF NEW.sender_id <> OLD.sender_id OR NEW.conversation_id <> OLD.conversation_id THEN
      RAISE EXCEPTION 'Access Denied: Message sender metadata is immutable.';
    END IF;
  -- Recipients can ONLY mark incoming messages as read (seen = true)
  ELSE
    IF NEW.message <> OLD.message OR 
       NEW.sender_id <> OLD.sender_id OR 
       NEW.conversation_id <> OLD.conversation_id OR 
       NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify messages sent by other users.';
    END IF;
    
    IF NEW.seen <> true THEN
      RAISE EXCEPTION 'Access Denied: Recipient can only mark message as read.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_secure_message_updates ON messages;
CREATE TRIGGER trg_secure_message_updates
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION public.secure_message_updates();


-- 3. PROFILES PARAMETERS PROTECTION & COOLDOWN
-- Stops standard users from modifying system metrics (is_admin, is_banned, warning_badge, karma, etc.)
-- limits profile edits count resets, and strictly validates gender/residence hall combinations.
CREATE OR REPLACE FUNCTION public.check_profile_edit_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  -- Block standard users from manual tampering with system parameters
  IF NOT (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
    IF NEW.is_admin <> OLD.is_admin OR
       NEW.is_banned <> OLD.is_banned OR
       NEW.is_muted <> OLD.is_muted OR
       NEW.karma <> OLD.karma OR
       NEW.warning_badge IS DISTINCT FROM OLD.warning_badge THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify administrative or reputation parameters.';
    END IF;
    
    -- Verify if user-identity attributes are modified
    IF (OLD.anonymous_username IS DISTINCT FROM NEW.anonymous_username OR
        OLD.department IS DISTINCT FROM NEW.department OR
        OLD.gender IS DISTINCT FROM NEW.gender OR
        OLD.hall IS DISTINCT FROM NEW.hall) THEN

      -- Gender & Residence hall matching validation
      IF NEW.gender = 'Male' AND NEW.hall NOT IN ('YKSG 1', 'YKSG 2', 'YKSG 3') THEN
        RAISE EXCEPTION 'Male users can only select YKSG 1, YKSG 2, or YKSG 3.';
      ELSIF NEW.gender = 'Female' AND NEW.hall NOT IN ('RASG 1', 'RASG 2') THEN
        RAISE EXCEPTION 'Female users can only select RASG 1 or RASG 2.';
      END IF;

      -- Cooldown rule: First 2 edits are free, then 30-day lock
      IF OLD.profile_edit_count >= 2 THEN
        IF OLD.last_profile_edit_at IS NOT NULL AND OLD.last_profile_edit_at > now() - interval '30 days' THEN
          RAISE EXCEPTION 'Profile edit cooldown active. You can edit your profile again in % days.', 
            EXTRACT(DAY FROM (OLD.last_profile_edit_at + interval '30 days' - now()))::INT;
        END IF;
      END IF;

      -- Increment profile edit count safely
      NEW.profile_edit_count := COALESCE(OLD.profile_edit_count, 0) + 1;
      NEW.last_profile_edit_at := now();
    ELSE
      -- Block direct manual updates of cooldown stats if details were not modified
      IF NEW.profile_edit_count <> OLD.profile_edit_count OR
         NEW.last_profile_edit_at IS DISTINCT FROM OLD.last_profile_edit_at THEN
        RAISE EXCEPTION 'Access Denied: Cannot modify profile edit statistics directly.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_profile_edit_cooldown ON profiles;
CREATE TRIGGER trg_check_profile_edit_cooldown
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_edit_cooldown();


-- 4. SECURE HELP REQUESTS UPDATES
-- Limits modifications of requests to prevent helper hijacking or parameter forging.
CREATE OR REPLACE FUNCTION public.secure_help_request_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Administrators bypass checks
  IF (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Requester checks
  IF OLD.requester_id = auth.uid() THEN
    IF NEW.item <> OLD.item OR 
       NEW.action <> OLD.action OR 
       NEW.requester_id <> OLD.requester_id OR 
       NEW.requester_hall <> OLD.requester_hall OR
       NEW.helper_id IS DISTINCT FROM OLD.helper_id OR
       NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
      RAISE EXCEPTION 'Access Denied: Core help request parameters are immutable after creation.';
    END IF;
  -- Helper checks (accepting request)
  ELSE
    IF OLD.status <> 'open' THEN
      RAISE EXCEPTION 'Access Denied: This help request is no longer open for acceptance.';
    END IF;
    
    IF NEW.status <> 'accepted' OR 
       NEW.helper_id <> auth.uid() OR 
       NEW.conversation_id IS NULL THEN
      RAISE EXCEPTION 'Access Denied: Invalid acceptance parameters.';
    END IF;

    -- All other fields must match
    IF NEW.item <> OLD.item OR 
       NEW.action <> OLD.action OR 
       NEW.requester_id <> OLD.requester_id OR 
       NEW.requester_hall <> OLD.requester_hall THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify request parameters when accepting.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_secure_help_request_updates ON help_requests;
CREATE TRIGGER trg_secure_help_request_updates
BEFORE UPDATE ON help_requests
FOR EACH ROW
EXECUTE FUNCTION public.secure_help_request_updates();


-- 5. RLS ACCESS POLICIES ENFORCEMENT
-- Secure conversations creation
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;
CREATE POLICY "conversations_insert_policy"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_one OR auth.uid() = user_two) AND
  (
    EXISTS (
      SELECT 1 FROM help_requests
      WHERE conversation_id = conversations.id
        AND (requester_id = auth.uid() OR helper_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM night_sessions
      WHERE conversation_id = conversations.id
        AND (requester_id = auth.uid() OR accepter_id = auth.uid())
    )
  )
);

-- Admin capabilities policies for Profiles
DROP POLICY IF EXISTS "Allow admins to read any profile" ON profiles;
CREATE POLICY "Allow admins to read any profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) = true
);

DROP POLICY IF EXISTS "Allow admins to update any profile" ON profiles;
CREATE POLICY "Allow admins to update any profile"
ON profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) = true
)
WITH CHECK (
  (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) = true
);
