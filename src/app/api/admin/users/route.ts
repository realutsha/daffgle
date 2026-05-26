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
    const { data: { user: currentUser }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !currentUser) {
      return NextResponse.json(
        { error: "Session expired or invalid: " + (authError?.message || "No user") },
        { status: 401 }
      );
    }

    const currentEmail = currentUser.email || "";
    const isAdmin = currentEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // 4. Console log:
    //    - current authenticated email
    //    - admin comparison result
    console.log("Current Authenticated Email:", currentEmail);
    console.log("Admin Comparison Result:", isAdmin);

    // B. Enforce email verification check for the designated administrator
    if (!isAdmin) {
      console.warn(`[Admin Users API] Forbidden access attempt by email: ${currentEmail}`);
      return NextResponse.json(
        { error: "Forbidden: Admin eyes only!" },
        { status: 403 }
      );
    }

    console.log(`[Admin Users API] Authorized fetch of auth.users list for admin: ${currentUser.id}`);

    // 2. Initialize admin client with service role key to securely fetch real emails
    // Enforce persistSession: false for clean server environment
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { users },
      error,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("[Admin Users API] Failed to list auth users:", error.message);
      return NextResponse.json(
        { error: "Database error listing users: " + error.message },
        { status: 500 }
      );
    }

    // Add temporary server log of the first user structure exactly as requested
    if (users && users.length > 0) {
      console.log("[Admin Users API Temporary Log] First user structure:");
      console.log(users[0]);
    } else {
      console.log("[Admin Users API Temporary Log] No users found in auth database.");
    }

    // Fetch database profiles
    let dbProfiles: any[] = [];
    try {
      const { data: profiles, error: profileErr } = await supabaseAdmin.from("profiles").select("*");
      if (profileErr) {
        console.error("[Admin Users API] Database error selecting profiles:", profileErr.message);
      }
      dbProfiles = profiles || [];
    } catch (profileErr) {
      console.error("[Admin Users API] Failed to query database profiles:", profileErr);
    }

    const authMap = new Map(
      users.map((user) => [
        String(user.id).trim().toLowerCase(),
        user.email,
      ])
    );

    const emailMap: Record<string, string | null> = {};

    for (const profile of dbProfiles) {
      const normalizedProfileId = String(profile.id).trim().toLowerCase();
      const matchedEmail = authMap.get(normalizedProfileId) ?? null;

      console.log("PROFILE ID:", normalizedProfileId);
      console.log("MATCHED EMAIL:", authMap.get(normalizedProfileId));

      if (profile.id) {
        emailMap[profile.id] = matchedEmail;
        emailMap[normalizedProfileId] = matchedEmail;
      }
    }

    // 5. Return raw debug data temporarily:
    return NextResponse.json({
      profiles: dbProfiles.map(p => ({
        ...p,
        real_email: authMap.get(String(p.id).trim().toLowerCase()) ?? null
      })),
      authUsers: users,
      authMap: Array.from(authMap.entries()),
      emails: emailMap,
      success: true
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
