import { getToken } from "firebase/messaging";
import { supabase } from "@/lib/supabase/client";
import { getFirebaseMessaging } from "./firebase";

const VAPID_KEY =
  "Pp8MhT-aJoKZ-XZsfc8nFJbL_Xr_PCtJi7GnGFag7sM";

export async function setupPushNotifications(userId: string) {
  try {
    if (typeof window === "undefined") return;

    const permission = await Notification.requestPermission();

    if (permission !== "granted") return;

    const messaging = await getFirebaseMessaging();

    if (!messaging) return;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (!token) return;

    await supabase.from("notification_tokens").upsert({
      user_id: userId,
      token,
    });
  } catch (error) {
    console.error("Notification setup failed:", error);
  }
}