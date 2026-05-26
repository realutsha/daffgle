-- ==========================================================
-- Migration: Daffgle Profiles Table Row-Level Security (RLS)
-- Enforces: Strict modification constraints on fields like is_admin,
--           is_banned, is_muted, and reputation karma.
-- ==========================================================

-- 1. Enable RLS on the profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Select Policy: Authenticated users can view profiles (to show usernames, departments, and halls)
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
CREATE POLICY "Allow authenticated users to read profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. Insert Policy: Users can only create their own profile during onboarding registration
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON profiles;
CREATE POLICY "Allow users to insert their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 4. Delete Policy: Users can delete their own profile (aligned with cascade purge script)
DROP POLICY IF EXISTS "Allow users to delete their own profile" ON profiles;
CREATE POLICY "Allow users to delete their own profile"
ON profiles
FOR DELETE
TO authenticated
USING (id = auth.uid());

-- 5. Update Policy: Strict column constraints to prevent privilege escalation!
-- Authenticated users can only update their own profile and are strictly forbidden from modifying
-- administrative flags, ban status, mute status, or karma scores directly from the client.
DROP POLICY IF EXISTS "Allow users to update their own identity details" ON profiles;
CREATE POLICY "Allow users to update their own identity details"
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() AND
  
  -- Prevent privilege escalation: new is_admin must match old is_admin
  is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid()) AND
  
  -- Prevent unbanning: new is_banned must match old is_banned
  is_banned = (SELECT is_banned FROM profiles WHERE id = auth.uid()) AND
  
  -- Prevent unmuting: new is_muted must match old is_muted
  is_muted = (SELECT is_muted FROM profiles WHERE id = auth.uid()) AND
  
  -- Prevent karma scores manipulation: new karma must match old karma
  karma = (SELECT karma FROM profiles WHERE id = auth.uid())
);
