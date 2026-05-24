import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user's session token from the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization credentials required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Initialize anon client to verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Session expired or invalid: " + (authError?.message || "No user") },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2. Initialize admin client with secret service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 3. Cascade delete all user logs, reports, messages, conversations, requests and profiles
    // A. Delete user activity in reports
    await adminClient
      .from("reports")
      .delete()
      .or(`reporter_id.eq.${userId},reported_id.eq.${userId}`);

    // B. Delete user messages
    await adminClient
      .from("messages")
      .delete()
      .eq("sender_id", userId);

    // C. Find conversations where the user was either requester or helper
    const { data: requests } = await adminClient
      .from("help_requests")
      .select("conversation_id")
      .or(`requester_id.eq.${userId},helper_id.eq.${userId}`);

    const conversationIds = requests
      ?.map((r) => r.conversation_id)
      .filter((id): id is string => !!id) || [];

    // Delete conversations
    if (conversationIds.length > 0) {
      await adminClient
        .from("conversations")
        .delete()
        .in("id", conversationIds);
    }

    // D. Delete user help requests
    await adminClient
      .from("help_requests")
      .delete()
      .or(`requester_id.eq.${userId},helper_id.eq.${userId}`);

    // E. Delete user profile
    await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    // F. Finally delete user from auth.users (triggers final cascading checks)
    const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (adminDeleteError) {
      return NextResponse.json(
        { error: "Auth service failed to delete user: " + adminDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your account and all related Daffgle records have been securely purged."
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Critical Account Purge Error:", err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
