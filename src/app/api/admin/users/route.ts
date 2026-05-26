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

    // Fetch database profiles
    let dbProfiles: any[] = [];
    try {
      const { data: profiles, error: profileErr } = await adminClient.from("profiles").select("*");
      if (profileErr) {
        console.error("[Admin Users API] Database error selecting profiles:", profileErr.message);
      }
      dbProfiles = profiles || [];
    } catch (profileErr) {
      console.error("[Admin Users API] Failed to query database profiles:", profileErr);
    }

    // Create authMap mapping user.id -> user.email
    const authMap = new Map<string, string>(
      authUsersList.map(user => [String(user.id).trim().toLowerCase(), String(user.email || "")])
    );

    const emailMap: Record<string, string> = {};

    for (const profile of dbProfiles) {
      const profileIdKey = String(profile.id || "").trim().toLowerCase();
      const matchedEmail = authMap.get(profileIdKey) ?? "Not stored";

      // Console logs requested
      console.log(`profile.id: ${profile.id}`);
      console.log(`matched email: ${matchedEmail}`);

      if (profile.id) {
        emailMap[String(profile.id).trim().toLowerCase()] = matchedEmail;
      }
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
