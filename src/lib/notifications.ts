import { getToken } from "firebase/messaging";
import { supabase } from "@/lib/supabase/client";
import { getFirebaseMessaging } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export async function setupPushNotifications(userId: string) {
  try {
    // Only run notification code in the browser and when Notification is supported
    if (typeof window === "undefined" || !("Notification" in window)) {
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

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return null;
    }

    let token = "";
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });
    } catch (err) {
      console.warn("Failed to subscribe PushManager: Key may be invalid. Push notifications disabled.", err);
      return null;
    }

    if (!token) {
      return null;
    }

    await supabase.from("notification_tokens").upsert({
      user_id: userId,
      token,
    });
  } catch (error) {
    console.warn("Optional push notification setup completed with warnings:", error);
  }
}