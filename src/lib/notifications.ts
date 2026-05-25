import { getToken } from "firebase/messaging";
import { supabase } from "@/lib/supabase/client";
import { getFirebaseMessaging } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export async function setupPushNotifications(userId: string) {
  try {
    // Only run notification code in the browser and when Notification is supported
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("Push notifications not supported in this environment (running server-side or unsupported browser).");
      return null;
    }

    // Validate VAPID key existence, length, and typical placeholders
    if (
      !VAPID_KEY ||
      VAPID_KEY.trim() === "" ||
      VAPID_KEY.includes("your-") ||
      VAPID_KEY.includes("placeholder") ||
      VAPID_KEY.length < 50
    ) {
      console.warn("Push notifications skipped: NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing, too short, or a placeholder.");
      return null;
    }

    // Explicitly register the service worker first (crucial for PWA and iOS Safari support)
    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      try {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/",
        });
        console.log("Service Worker registered successfully for background push scope:", registration.scope);
      } catch (swError) {
        console.warn("Service worker registration failed. Push notifications might fail to receive in background:", swError);
      }
    }

    // Request permissions
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Push notification permission denied by the user.");
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn("FCM Messaging client is not supported or failed to initialize.");
      return null;
    }

    let token = "";
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
    } catch (err) {
      console.warn("Failed to subscribe PushManager: Key may be invalid. Push notifications disabled.", err);
      return null;
    }

    if (!token) {
      console.warn("Retrieved empty FCM token from PushManager.");
      return null;
    }

    console.log("Successfully retrieved FCM token. Upserting to Supabase...");
    
    // Save token to Supabase
    const { error } = await supabase.from("notification_tokens").upsert(
      {
        user_id: userId,
        token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    if (error) {
      console.error("Failed to upsert FCM token to Supabase:", error.message);
    } else {
      console.log("FCM token successfully registered in Supabase for user:", userId);
    }
  } catch (error) {
    console.warn("Optional push notification setup completed with warnings:", error);
  }
}