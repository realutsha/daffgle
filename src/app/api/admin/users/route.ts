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
    // Enforce persistSession: false for clean server environment
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // 3. Retrieve the full list of auth users from Supabase Auth
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("[Admin Users API] Failed to list auth users:", listError.message);
      return NextResponse.json(
        { error: "Database error listing users: " + listError.message },
        { status: 500 }
      );
    }

    const authUsersList = users || [];

    // Console logs requested in Task 3
    console.log("[Admin Users API Debug] authUsers.length:", authUsersList.length);
    console.log("[Admin Users API Debug] First 3 auth users:");
    authUsersList.slice(0, 3).forEach((u, i) => {
      console.log(`  [${i}] ID: ${u.id}, Email: ${u.email}`);
    });

    // Fetch database profiles
    let dbProfiles: any[] = [];
    try {
      const { data: profiles, error: profileErr } = await adminClient.from("profiles").select("*");
      if (profileErr) {
        console.error("[Admin Users API Debug] Database error selecting profiles:", profileErr.message, profileErr.details);
      }
      dbProfiles = profiles || [];
    } catch (profileErr) {
      console.error("[Admin Users API Debug] Failed to query database profiles:", profileErr);
    }

    const profileIds = dbProfiles.map(p => p.id);
    console.log("[Admin Users API Debug] Profile IDs from database:", profileIds);

    // 4. Match using ALL possible fields: profile.id, profile.user_id, profile.auth_user_id
    const emailMap: Record<string, string> = {};

    for (const profile of dbProfiles) {
      const profileIdStr = String(profile.id || "").trim().toLowerCase();
      const profileUserIdStr = String(profile.user_id || "").trim().toLowerCase();
      const profileAuthUserIdStr = String(profile.auth_user_id || "").trim().toLowerCase();

      // Find matched auth user checking ALL fields
      const matchedAuthUser = authUsersList.find(u => {
        const uIdStr = String(u.id || "").trim().toLowerCase();
        return (
          (profile.id && uIdStr === profileIdStr) ||
          (profile.user_id && uIdStr === profileUserIdStr) ||
          (profile.auth_user_id && uIdStr === profileAuthUserIdStr)
        );
      });

      // 5. Return matched user email directly or null
      const resolvedEmail = matchedAuthUser?.email || null;

      if (resolvedEmail) {
        // Store resolved email mapped to all possible matching ID formats to cover any front-end match keys
        if (profile.id) {
          emailMap[String(profile.id).trim().toLowerCase()] = resolvedEmail;
        }
        if (profile.user_id) {
          emailMap[String(profile.user_id).trim().toLowerCase()] = resolvedEmail;
        }
        if (profile.auth_user_id) {
          emailMap[String(profile.auth_user_id).trim().toLowerCase()] = resolvedEmail;
        }
      }

      if (!matchedAuthUser) {
        console.log(`[Admin Users API Debug] Profile ID failed to match: ${profile.id} (username: @${profile.anonymous_username || "unknown"})`);
      }
    }

    // Populate direct auth user id to email mapping as final fallback
    for (const u of authUsersList) {
      if (u.id && u.email) {
        const lowerId = u.id.trim().toLowerCase();
        if (!emailMap[lowerId]) {
          emailMap[lowerId] = u.email;
        }
      }
    }

    // Temporary logs for resolved mapping
    console.log("[Admin Users API Debug] Finished email matching. Total resolved keys:", Object.keys(emailMap).length);

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
