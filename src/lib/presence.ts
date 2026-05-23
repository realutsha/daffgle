import { supabase } from "@/lib/supabase/client";

export async function setUserOnline(userId: string) {
  await supabase
    .from("profiles")
    .update({
      is_online: true,
      last_seen: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function setUserOffline(userId: string) {
  await supabase
    .from("profiles")
    .update({
      is_online: false,
      last_seen: new Date().toISOString(),
    })
    .eq("id", userId);
}