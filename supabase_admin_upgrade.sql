-- ==========================================================
-- Migration: Daffgle Admin Command Center Database Schema
-- Safe upgrade script. Run in Supabase SQL Editor.
-- ==========================================================
 
-- 1. Extend profiles with Shadow Banning and Remote Logout columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_logout BOOLEAN DEFAULT false;
 
-- 2. Create app_settings single-row table
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_locked BOOLEAN DEFAULT false,
  maintenance_title TEXT DEFAULT 'System Maintenance',
  maintenance_message TEXT DEFAULT 'Daffgle is currently undergoing scheduled systems upgrade. We will be back shortly.',
  estimated_reopen_time TIMESTAMP WITH TIME ZONE,
  feature_toggles JSONB DEFAULT '{"chats": true, "help_hub": true, "sanctuary": true, "registrations": true, "profile_editing": true, "notifications": true}'::jsonb,
  emergency_alert JSONB DEFAULT NULL, -- Format: {"title": "Security Alert", "message": "High-risk activity suspected", "active": true, "type": "warning"}
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
 
-- Insert default singleton settings
INSERT INTO app_settings (id, is_locked) 
VALUES (1, false) 
ON CONFLICT (id) DO NOTHING;
 
-- 3. Create global_notices table
CREATE TABLE IF NOT EXISTS global_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'emergency'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
 
-- 4. Create admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
 
-- 5. Enable Row-Level Security (RLS) on new tables
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
 
-- 6. Setup RLS Policies for app_settings
-- Read settings: Allow all authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON app_settings;
CREATE POLICY "Allow authenticated users to read settings"
ON app_settings FOR SELECT TO authenticated USING (true);
 
-- Write settings: Only allow authenticated admin profiles
DROP POLICY IF EXISTS "Allow admins to edit settings" ON app_settings;
CREATE POLICY "Allow admins to edit settings"
ON app_settings FOR ALL TO authenticated
USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
 
-- 7. Setup RLS Policies for global_notices
-- Read notices: Allow all authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to read notices" ON global_notices;
CREATE POLICY "Allow authenticated users to read notices"
ON global_notices FOR SELECT TO authenticated USING (true);
 
-- Write notices: Only allow authenticated admin profiles
DROP POLICY IF EXISTS "Allow admins to modify notices" ON global_notices;
CREATE POLICY "Allow admins to modify notices"
ON global_notices FOR ALL TO authenticated
USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
 
-- 8. Setup RLS Policies for admin_logs
-- Read logs: Only allow admins
DROP POLICY IF EXISTS "Allow admins to view logs" ON admin_logs;
CREATE POLICY "Allow admins to view logs"
ON admin_logs FOR SELECT TO authenticated
USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
 
-- Insert logs: Allow admins
DROP POLICY IF EXISTS "Allow admins to insert logs" ON admin_logs;
CREATE POLICY "Allow admins to insert logs"
ON admin_logs FOR INSERT TO authenticated
WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
 
-- 9. Enhance profiles RLS policies to allow admin moderation bypass
DROP POLICY IF EXISTS "Allow admins to moderate all profiles" ON profiles;
CREATE POLICY "Allow admins to moderate all profiles"
ON profiles FOR UPDATE TO authenticated
USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
