-- ==========================================================
-- Rollback Script: Daffgle Production Cybersecurity Hardening
-- Enforces: Reverts all new triggers, functions, and policies
--           back to their exact pre-hardening state.
-- ==========================================================

-- 1. ROLLBACK AUTH REGISTRATION GATE
DROP TRIGGER IF EXISTS trg_check_auth_email ON auth.users;
DROP FUNCTION IF EXISTS public.check_auth_email();


-- 2. ROLLBACK MESSAGE UPDATES INTEGRITY
DROP TRIGGER IF EXISTS trg_secure_message_updates ON messages;
DROP FUNCTION IF EXISTS public.secure_message_updates();


-- 3. ROLLBACK PROFILES PROTECTION (Re-establish pre-migration trigger)
DROP TRIGGER IF EXISTS trg_check_profile_edit_cooldown ON profiles;

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

CREATE TRIGGER trg_check_profile_edit_cooldown
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_profile_edit_cooldown();


-- 4. ROLLBACK SECURE HELP REQUESTS UPDATES
DROP TRIGGER IF EXISTS trg_secure_help_request_updates ON help_requests;
DROP FUNCTION IF EXISTS public.secure_help_request_updates();


-- 5. ROLLBACK RLS ACCESS POLICIES ENFORCEMENT
-- Revert conversations insert policy
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;
CREATE POLICY "conversations_insert_policy"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_one OR auth.uid() = user_two);

-- Revert Admin capabilities policies on Profiles
DROP POLICY IF EXISTS "Allow admins to read any profile" ON profiles;
DROP POLICY IF EXISTS "Allow admins to update any profile" ON profiles;
