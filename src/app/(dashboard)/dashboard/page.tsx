"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { setupPushNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender?: string;
  is_online: boolean;
  last_seen: string;
  is_banned?: boolean;
};

type OnlineUser = {
  id: string;
  anonymous_username: string;
  department: string;
  is_online: boolean;
  last_seen: string;
};

function formatLastSeen(date: string, online: boolean) {
  if (online) return "Online now";

  const now = Date.now();
  const last = new Date(date).getTime();
  const diffMinutes = Math.floor((now - last) / 1000 / 60);

  if (diffMinutes < 1) return "Active just now";
  if (diffMinutes < 60) return `Active ${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Active ${diffDays}d ago`;
}

export function isUserActuallyOnline(isOnline: boolean | undefined, lastSeen: string | undefined) {
  if (!isOnline) return false;
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen).getTime();
  const now = Date.now();
  return now - lastSeenDate < 90000;
}

export default function DashboardPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return onlineUsers;

    return onlineUsers.filter((user) => {
      return (
        user.anonymous_username.toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query)
      );
    });
  }, [onlineUsers, search]);

  const onlineCount = onlineUsers.length;

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const myId = userData.user.id;
    setCurrentUserId(myId);

    await setupPushNotifications(myId).catch(() => {});
    await setUserOnline(myId);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", myId)
      .single();

    if (!profileData) {
      router.replace("/auth/setup");
      return;
    }

    if (profileData.is_banned) {
      await setUserOffline(myId);
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    setProfile(profileData);

    const activeSince = new Date(Date.now() - 60000).toISOString();

    const { data: users } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department, is_online, last_seen")
      .neq("id", myId)
      .eq("is_online", true)
      .gt("last_seen", activeSince)
      .order("last_seen", { ascending: false });

    const uniqueUsers = Array.from(
      new Map((users || []).map((user) => [user.id, user])).values()
    );

    setOnlineUsers(uniqueUsers);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    let userId = "";
    let interval: NodeJS.Timeout;

    const setupPresence = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      userId = user.id;
      setCurrentUserId(user.id);

      await setUserOnline(user.id);
      await loadDashboard();

      interval = setInterval(async () => {
        await setUserOnline(user.id);
        await loadDashboard();
      }, 30000);
    };

    const handleVisibilityChange = async () => {
      if (!userId) return;

      if (document.hidden) {
        await setUserOffline(userId);
      } else {
        await setUserOnline(userId);
        await loadDashboard();
      }
    };

    setupPresence();

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (userId) {
        setUserOffline(userId);
      }
    };
  }, [loadDashboard, router]);

  const handleLogout = async () => {
    if (currentUserId) {
      await setUserOffline(currentUserId);
    }

    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#0E1621] text-white">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5">
          <div className="rounded-4xl border border-[#22303D] bg-[#17212B]/95 p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <div className="h-10 w-28 rounded-full bg-[#2AABEE]/20" />
              <div className="h-10 w-24 rounded-full bg-[#2AABEE]/10" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-4 w-3/4 rounded-full bg-[#2AABEE]/10" />
              <div className="h-4 rounded-full bg-[#2AABEE]/08" />
              <div className="h-4 rounded-full bg-[#2AABEE]/08" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-32 rounded-4xl border border-[#22303D] bg-[#17212B]/95 p-4 shadow-xl shadow-black/20" />
            <div className="h-32 rounded-4xl border border-[#22303D] bg-[#17212B]/95 p-4 shadow-xl shadow-black/20" />
          </div>
          <p className="text-center text-sm text-gray-400">Loading Daffgle...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#0E1621] text-white">
      <aside className="flex w-full flex-col bg-[#17212B] md:w-107.5 md:border-r md:border-[#22303D]">
        <header className="sticky top-0 z-30 border-b border-[#22303D] bg-[#17212B]/95 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-4 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#2AABEE]">
                Daffgle
              </h1>
              <p className="text-xs text-gray-400">
                Anonymous DIU realtime chat
              </p>
            </div>

            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="rounded-2xl bg-[#2B5278] px-4 py-2 text-xs font-bold transition hover:scale-[1.02] hover:opacity-90 disabled:opacity-60"
            >
              {refreshing ? "Syncing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-4 rounded-3xl border border-[#22303D] bg-[#0F1A24] p-4 shadow-xl shadow-black/10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2B5278] text-lg font-black">
                {profile?.anonymous_username?.charAt(0).toUpperCase() || "D"}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {profile?.anonymous_username}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {profile?.department}
                </p>
              </div>

              <div className="rounded-full bg-green-500/10 px-3 py-1 text-[11px] font-bold text-green-400">
                ● Online
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-[#2AABEE] py-3 text-sm font-black text-white shadow-lg shadow-[#2AABEE]/20"
            >
              Online
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533]"
            >
              Chats
            </button>
          </div>

          <div className="mt-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search online users..."
              className="w-full rounded-3xl border border-[#22303D] bg-[#0E1621] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 transition focus:border-[#2AABEE] focus:ring-2 focus:ring-[#2AABEE]/20"
            />
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-5 pb-28 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Online Users</h2>
              <p className="text-xs text-gray-400">
                Tap a username to start private anonymous chat.
              </p>
            </div>

            <span className="rounded-full bg-[#0F1A24] px-3 py-1 text-xs font-bold text-[#2AABEE]">
              {onlineCount} live
            </span>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="space-y-3">
              {filteredUsers.map((user, index) => (
                <motion.button
                  key={user.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => router.push(`/chat/${user.id}`)}
                  className="group w-full rounded-3xl border border-[#22303D] bg-[#0F1A24] p-5 text-left shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:border-[#2AABEE]/50 hover:bg-[#182533] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#2B5278] text-lg font-black">
                      {user.anonymous_username.charAt(0).toUpperCase()}
                      <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-[#17212B] bg-green-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-black">
                          {user.anonymous_username}
                        </p>

                        <span className="rounded-full bg-[#2AABEE]/10 px-3 py-1 text-[10px] font-bold text-[#2AABEE]">
                          Chat
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-400">
                        {user.department}
                      </p>

                      <p className="mt-1 text-xs font-medium text-green-400">
                        {formatLastSeen(user.last_seen, isUserActuallyOnline(user.is_online, user.last_seen))}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="mt-16 rounded-3xl border border-[#22303D] bg-[#0F1A24] p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#17212B] text-3xl">
                👻
              </div>
              <h3 className="text-lg font-black">No online users found</h3>
              <p className="mt-2 text-sm text-gray-400">
                Try refreshing, or come back when more DIU students are online.
              </p>
            </div>
          )}
        </section>

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-4 backdrop-blur md:absolute md:right-auto md:w-107.5">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full bg-[#2AABEE] py-3 text-sm font-black text-white shadow-lg shadow-[#2AABEE]/20 transition duration-200 hover:scale-[1.02]"
            >
              Online
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="rounded-full bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533]"
            >
              Chats
            </button>

            <button
              onClick={handleLogout}
              className="rounded-full bg-[#2B5278] py-3 text-sm font-bold text-white transition duration-200 hover:brightness-110"
            >
              Logout
            </button>
          </div>
        </nav>
      </aside>

      <section className="hidden flex-1 items-center justify-center bg-[#0F1A24] p-8 md:flex">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl text-center"
        >
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-4xl bg-[#17212B] text-5xl shadow-2xl">
            👻
          </div>

          <h2 className="text-5xl font-black tracking-tight text-white">
            Find online DIU students
          </h2>

          <p className="mt-5 text-lg leading-8 text-gray-400">
            This dashboard is now clean: only online users appear here.
            Conversations live separately in the Chats page.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            <div className="rounded-3xl border border-[#22303D] bg-[#17212B] p-5">
              <p className="text-3xl font-black text-[#2AABEE]">
                {onlineCount}
              </p>
              <p className="mt-1 text-sm text-gray-400">Online now</p>
            </div>

            <div className="rounded-3xl border border-[#22303D] bg-[#17212B] p-5">
              <p className="text-3xl font-black text-[#2AABEE]">1:1</p>
              <p className="mt-1 text-sm text-gray-400">Private chat only</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/chat")}
            className="mt-8 rounded-2xl bg-[#2AABEE] px-8 py-4 text-sm font-black shadow-xl shadow-[#2AABEE]/20 transition hover:scale-[1.02]"
          >
            Open Chats
          </button>
        </motion.div>
      </section>
    </main>
  );
}