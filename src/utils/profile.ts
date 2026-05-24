import { supabase } from "@/lib/supabase/client";

export interface ProfileToCheck {
  id?: string;
  anonymous_username?: string | null;
  department?: string | null;
  gender?: string | null;
  hall?: string | null;
  karma?: number;
  notification_enabled?: boolean;
  warning_badge?: string | null;
  profile_edit_count?: number;
  last_profile_edit_at?: string | null;
  is_banned?: boolean;
}

// In-memory cache for profile to satisfy:
// "Do not use localStorage as the main truth. Use Supabase profile data as source of truth. But local state can cache after successful fetch."
let cachedProfile: ProfileToCheck | null = null;
let isFetched = false;

export function getCachedProfile(): ProfileToCheck | null {
  return cachedProfile;
}

export function isProfileCached(): boolean {
  return isFetched && cachedProfile !== null;
}

export function setCachedProfile(profile: ProfileToCheck | null) {
  cachedProfile = profile;
  isFetched = true;
}

export function clearCachedProfile() {
  cachedProfile = null;
  isFetched = false;
}

/**
 * A profile is complete only if these fields exist and are non-empty:
 * - username (anonymous_username)
 * - department
 * - gender
 * - hall
 */
export function isProfileComplete(profile: ProfileToCheck | null | undefined): boolean {
  if (!profile) return false;
  return !!(
    profile.anonymous_username && profile.anonymous_username.trim() &&
    profile.department && profile.department.trim() &&
    profile.gender && profile.gender.trim() &&
    profile.hall && profile.hall.trim()
  );
}

/**
 * Helper to get the list of missing fields.
 */
export function getMissingProfileFields(profile: ProfileToCheck | null | undefined): string[] {
  const missing: string[] = [];
  if (!profile) {
    return ["Username", "Department", "Gender", "Hall"];
  }
  if (!profile.anonymous_username || !profile.anonymous_username.trim()) {
    missing.push("Username");
  }
  if (!profile.department || !profile.department.trim()) {
    missing.push("Department");
  }
  if (!profile.gender || !profile.gender.trim()) {
    missing.push("Gender");
  }
  if (!profile.hall || !profile.hall.trim()) {
    missing.push("Hall");
  }
  return missing;
}

/**
 * Safely fetches the profile from Supabase with a fallback mechanism.
 * If columns added in migrations (like karma, warning_badge) fail to select (e.g. if migrations haven't run or table doesn't have them yet),
 * it falls back to selecting only the essential four fields to handle old users and migration steps gracefully.
 */
export async function fetchProfileSafely(userId: string): Promise<{ data: ProfileToCheck | null; error: unknown }> {
  // First, try a robust fetch selecting all fields
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department, gender, hall, karma, notification_enabled, warning_badge, profile_edit_count, last_profile_edit_at, is_banned")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setCachedProfile(data);
      return { data, error: null };
    }

    // If it's a column missing error (e.g. database migration not fully run yet), fallback to essential fields
    if (error && (error.code === "PGRST204" || error.message?.includes("column") || error.message?.includes("does not exist"))) {
      console.warn("Retrying profile fetch with essential fields due to database columns mismatch:", error.message);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select("id, anonymous_username, department, gender, hall")
        .eq("id", userId)
        .single();

      if (!fallbackError && fallbackData) {
        const mappedData: ProfileToCheck = {
          ...fallbackData,
          karma: 0,
          notification_enabled: true,
          warning_badge: null,
          profile_edit_count: 0,
          last_profile_edit_at: null,
          is_banned: false
        };
        setCachedProfile(mappedData);
        return { data: mappedData, error: null };
      }
      return { data: null, error: fallbackError };
    }

    return { data: null, error };
  } catch (err) {
    console.error("fetchProfileSafely exception:", err);
    return { data: null, error: err };
  }
}
