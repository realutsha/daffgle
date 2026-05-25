import { NextResponse } from "next/server";
import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// 1. Lazy initialize Firebase Admin SDK to prevent duplicate initialization errors in Next.js hot-reloads
if (!admin.apps.length) {
  let serviceAccount: admin.ServiceAccount | undefined;

  // Option A: Check environment variables first (production/Vercel standard)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log("[FCM Server] Initialized Firebase Admin from environment variable.");
    } catch (e) {
      console.error("[FCM Server] Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", e);
    }
  }

  // Option B: Fallback to local service account json file (development/local standard)
  if (!serviceAccount) {
    const serviceAccountPath = path.join(process.cwd(), "firebase-service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        console.log("[FCM Server] Initialized Firebase Admin from local JSON file.");
      } catch (fileError) {
        console.error("[FCM Server] Failed to read local firebase-service-account.json file:", fileError);
      }
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.warn("[FCM Server] Warning: Firebase Service Account credentials not found. Push notifications will be mocked.");
  }
}

// 2. Initialize Supabase Admin Client using service role key to securely bypass RLS and resolve tokens
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bqxtknjkibjlxwnsaxcl.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type) {
      return NextResponse.json({ success: false, error: "Missing notification type parameter." }, { status: 400 });
    }

    let title = "Daffgle";
    let messageBody = "New update available!";
    let url = "/dashboard";
    let tag = "daffgle-alert";
    let targetUserIds: string[] = [];

    // 3. Resolve notification details based on event type
    switch (type) {
      case "same-hall-request": {
        const { hall, itemId, requesterId } = body;
        if (!hall || !itemId || !requesterId) {
          return NextResponse.json({ success: false, error: "Missing required parameters for same-hall-request." }, { status: 400 });
        }

        // Fetch all other users in the same hall who have notifications enabled
        const { data: recipientProfiles, error: pError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("hall", hall)
          .eq("notification_enabled", true)
          .neq("id", requesterId);

        if (pError) {
          console.error("[FCM Server] Error fetching same-hall profiles:", pError);
          break;
        }

        if (recipientProfiles && recipientProfiles.length > 0) {
          targetUserIds = recipientProfiles.map((p) => p.id);
        }

        title = "Help Hub Request";
        messageBody = `Someone from ${hall} needs a ${itemId.toLowerCase()}`;
        url = "/dashboard";
        tag = `hall-request-${hall}`;
        break;
      }

      case "request-accepted": {
        const { targetUserId, conversationId, item } = body;
        if (!targetUserId || !conversationId || !item) {
          return NextResponse.json({ success: false, error: "Missing parameters for request-accepted." }, { status: 400 });
        }

        targetUserIds = [targetUserId];
        title = "Request Accepted";
        messageBody = "Your help request was accepted";
        url = `/chat/${conversationId}`;
        tag = `accept-${conversationId}`;
        break;
      }

      case "new-message": {
        const { targetUserId, conversationId } = body;
        if (!targetUserId || !conversationId) {
          return NextResponse.json({ success: false, error: "Missing parameters for new-message." }, { status: 400 });
        }

        targetUserIds = [targetUserId];
        title = "New Message";
        messageBody = "You received a new message";
        url = `/chat/${conversationId}`;
        tag = `chat-${conversationId}`;
        break;
      }

      case "admin-warning": {
        const { targetUserId } = body;
        if (!targetUserId) {
          return NextResponse.json({ success: false, error: "Missing target user ID for admin-warning." }, { status: 400 });
        }

        targetUserIds = [targetUserId];
        title = "System Alert";
        messageBody = "Admin reviewed a report";
        url = "/profile";
        tag = "admin-alert";
        break;
      }

      case "report-update": {
        const { targetUserId, status } = body;
        if (!targetUserId || !status) {
          return NextResponse.json({ success: false, error: "Missing parameters for report-update." }, { status: 400 });
        }

        targetUserIds = [targetUserId];
        title = "Report Processed";
        messageBody = `Admin reviewed a report`;
        url = "/dashboard";
        tag = "report-update";
        break;
      }

      case "karma-completed": {
        const { targetUserId, item } = body;
        if (!targetUserId || !item) {
          return NextResponse.json({ success: false, error: "Missing parameters for karma-completed." }, { status: 400 });
        }

        targetUserIds = [targetUserId];
        title = "Help Completed!";
        messageBody = `Help request completed! You earned +1 Karma.`;
        url = "/dashboard";
        tag = "karma-update";
        break;
      }

      default:
        return NextResponse.json({ success: false, error: "Unsupported notification type." }, { status: 400 });
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ success: true, message: "No recipient users found for this notification event." });
    }

    // 4. Retrieve stored FCM push tokens for target users from Supabase
    const { data: tokenRecords, error: tError } = await supabaseAdmin
      .from("notification_tokens")
      .select("token")
      .in("user_id", targetUserIds);

    if (tError) {
      console.error("[FCM Server] Error fetching FCM tokens:", tError);
      return NextResponse.json({ success: false, error: tError.message }, { status: 500 });
    }

    const tokens = tokenRecords?.map((r) => r.token) || [];

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Recipients resolved but no FCM tokens registered. Falling back to Supabase realtime.",
      });
    }

    // 5. Send FCM Web Push notifications if Admin SDK is initialized
    if (admin.apps.length > 0) {
      const messages = tokens.map((token) => ({
        token: token,
        notification: {
          title: title,
          body: messageBody,
        },
        data: {
          url: url,
          tag: tag,
        },
        webpush: {
          notification: {
            icon: "/globe.svg",
            badge: "/globe.svg",
            clickAction: url,
          },
        },
      }));

      const response = await admin.messaging().sendEach(messages);
      console.log(`[FCM Server] Sent ${response.successCount} push notifications. Failures: ${response.failureCount}`);
      
      // Cleanup broken or invalid tokens (standard FCM token lifecycle management)
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((res, idx) => {
          if (!res.success && res.error) {
            const code = res.error.code;
            if (
              code === "messaging/invalid-registration-token" ||
              code === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          console.log(`[FCM Server] Cleaning up ${invalidTokens.length} expired or invalid FCM tokens...`);
          await supabaseAdmin.from("notification_tokens").delete().in("token", invalidTokens);
        }
      }

      return NextResponse.json({
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
      });
    } else {
      console.log("[FCM Server] Mock Mode: Push notification would have been dispatched: ", { title, messageBody, url, tokensCount: tokens.length });
      return NextResponse.json({
        success: true,
        mocked: true,
        message: "Firebase Admin SDK is not initialized. Notification printed in backend logs.",
      });
    }
  } catch (error) {
    console.error("[FCM Server] Error sending notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}