import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "madhurzamutsha@gmail.com";

export async function GET(req: NextRequest) {
  try {
    // 1. Verify user session from the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization credentials required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[Admin Users API] Missing required server-side configuration variables.");
      return NextResponse.json(
        { error: "Internal Server Configuration Error: Credentials missing" },
        { status: 500 }
      );
    }

    // A. Verify token and retrieve user details from Supabase Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Session expired or invalid: " + (authError?.message || "No user") },
        { status: 401 }
      );
    }

    // B. Enforce email verification check for the designated administrator
    if (!user.email || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      console.warn(`[Admin Users API] Unauthorized access attempt by email: ${user.email}`);
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this resource." },
        { status: 403 }
      );
    }

    // C. Verify is_admin is true in the database profile
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_admin) {
      console.warn(`[Admin Users API] Forbidden profile access for user: ${user.id}`);
      return NextResponse.json(
        { error: "Forbidden: Admin eyes only!" },
        { status: 403 }
      );
    }

    console.log(`[Admin Users API] Authorized fetch of auth.users list for admin: ${user.id}`);

    // 2. Initialize admin client with service role key to securely fetch real emails
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    // 3. Retrieve the full list of auth users from Supabase Auth
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("[Admin Users API] Failed to list auth users:", listError.message);
      return NextResponse.json(
        { error: "Database error listing users: " + listError.message },
        { status: 500 }
      );
    }

    // Fetch database profiles to count matches and inspect columns
    let profilesCount = 0;
    let matchedIds: string[] = [];
    let firstProfileKeys: string[] = [];
    try {
      const { data: profiles } = await adminClient.from("profiles").select("*");
      if (profiles) {
        profilesCount = profiles.length;
        matchedIds = profiles.map(p => p.id);
        if (profiles.length > 0) {
          firstProfileKeys = Object.keys(profiles[0]);
        }
      }
    } catch (profileErr) {
      console.error("[Admin Users API Debug] Failed to query profiles count:", profileErr);
    }

    // 4. Build a secure dictionary mapping user IDs to their real emails
    const emailMap: Record<string, string> = {};
    for (const u of users || []) {
      if (u.id && u.email) {
        emailMap[u.id.trim().toLowerCase()] = u.email;
      }
    }

    // Temporary console logs for diagnostic tracing
    console.log("[Admin Users API Debug] Fetched auth users count:", users?.length || 0);
    if (users) {
      users.forEach(u => {
        console.log(`[Admin Users API Debug] Auth User: ID=${u.id}, Email=${u.email}`);
      });
    }
    console.log("[Admin Users API Debug] Matched profile IDs in DB:", matchedIds);
    console.log("[Admin Users API Debug] Profiles table columns:", firstProfileKeys);
    
    // Print the resolved map
    for (const [pId, email] of Object.entries(emailMap)) {
      console.log(`[Admin Users API Debug] Resolved Email Match: Profile ID=${pId} -> Real Email=${email}`);
    }

    return NextResponse.json({
      success: true,
      emails: emailMap,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[Admin Users API] Critical failure:", err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
