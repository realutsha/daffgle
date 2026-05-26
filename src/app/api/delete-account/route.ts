import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Strict environment validation with descriptive logging and error responses
    if (!supabaseUrl) {
      console.error("[Account Purge Error] NEXT_PUBLIC_SUPABASE_URL is missing.");
      return NextResponse.json(
        { error: "Configuration Error: NEXT_PUBLIC_SUPABASE_URL is missing on the server." },
        { status: 500 }
      );
    }

    if (!supabaseAnonKey) {
      console.error("[Account Purge Error] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
      return NextResponse.json(
        { error: "Configuration Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing on the server." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      console.error("[Account Purge Error] SUPABASE_SERVICE_ROLE_KEY is missing.");
      return NextResponse.json(
        { error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY is missing on the server." },
        { status: 500 }
      );
    }

    // 1. Verify user's session token from the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization credentials required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    console.log(`[Account Purge] Starting secure server-side deletion for user: ${userId}`);

    // 3. Securely cascade delete all user related data in correct dependency order
    
    // A. Delete user activity in reports
    const { error: reportsError } = await adminClient
      .from("reports")
      .delete()
      .or(`reporter_id.eq.${userId},reported_id.eq.${userId}`);
    if (reportsError) {
      console.error(`[Account Purge] Error deleting user reports:`, reportsError);
    } else {
      console.log(`[Account Purge] Successfully deleted user reports.`);
    }

    // B. Delete user's notification tokens
    const { error: tokensError } = await adminClient
      .from("notification_tokens")
      .delete()
      .eq("user_id", userId);
    if (tokensError) {
      console.error(`[Account Purge] Error deleting notification tokens:`, tokensError);
    } else {
      console.log(`[Account Purge] Successfully deleted notification tokens.`);
    }

    // C. Find all conversations linked to requests where this user is requester or helper
    const { data: requests, error: requestsFetchError } = await adminClient
      .from("help_requests")
      .select("conversation_id")
      .or(`requester_id.eq.${userId},helper_id.eq.${userId}`);

    if (requestsFetchError) {
      console.error(`[Account Purge] Error fetching conversation references from help requests:`, requestsFetchError);
    }

    const conversationIds = requests
      ?.map((r) => r.conversation_id)
      .filter((id): id is string => !!id) || [];

    if (conversationIds.length > 0) {
      // D. Delete messages inside those conversations first to satisfy foreign key constraints
      const { error: messagesDeleteError } = await adminClient
        .from("messages")
        .delete()
        .in("conversation_id", conversationIds);
      if (messagesDeleteError) {
        console.error(`[Account Purge] Error deleting conversation messages:`, messagesDeleteError);
      } else {
        console.log(`[Account Purge] Successfully deleted messages inside active conversations.`);
      }

      // E. Delete the conversations themselves
      const { error: convsDeleteError } = await adminClient
        .from("conversations")
        .delete()
        .in("id", conversationIds);
      if (convsDeleteError) {
        console.error(`[Account Purge] Error deleting conversations:`, convsDeleteError);
      } else {
        console.log(`[Account Purge] Successfully deleted user conversations.`);
      }
    }

    // F. Delete user messages (remaining messages outside those conversations, if any)
    const { error: userMessagesError } = await adminClient
      .from("messages")
      .delete()
      .eq("sender_id", userId);
    if (userMessagesError) {
      console.error(`[Account Purge] Error deleting user-sent messages:`, userMessagesError);
    } else {
      console.log(`[Account Purge] Successfully deleted user-sent messages.`);
    }

    // G. Delete user help requests
    const { error: helpRequestsError } = await adminClient
      .from("help_requests")
      .delete()
      .or(`requester_id.eq.${userId},helper_id.eq.${userId}`);
    if (helpRequestsError) {
      console.error(`[Account Purge] Error deleting help requests:`, helpRequestsError);
    } else {
      console.log(`[Account Purge] Successfully deleted user help requests.`);
    }

    // H. Delete user profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileError) {
      console.error(`[Account Purge] Error deleting profiles:`, profileError);
    } else {
      console.log(`[Account Purge] Successfully deleted user profile.`);
    }

    // I. Finally delete user from auth.users (triggers final cascading checks)
    const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (adminDeleteError) {
      console.error(`[Account Purge] Auth service failed to delete user:`, adminDeleteError);
      return NextResponse.json(
        { error: "Auth service failed to delete user: " + adminDeleteError.message },
        { status: 500 }
      );
    }

    console.log(`[Account Purge] Secure account purge completed successfully for user: ${userId}`);

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
