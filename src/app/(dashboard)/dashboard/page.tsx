"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { setupPushNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
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

type Conversation = {
  id: string;
  user_one: string;
  user_two: string;
  created_at: string;
};

type RecentChat = {
  conversation_id: string;
  user_id: string;
  anonymous_username: string;
  department: string;
  last_message: string;
  last_time: string;
};

function formatLastSeen(date: string, online: boolean) {
  if (online) return "● Online";

  const now = new Date().getTime();
  const last = new Date(date).getTime();
  const diffMinutes = Math.floor((now - last) / 1000 / 60);

  if (diffMinutes < 1) return "Last seen just now";
  if (diffMinutes < 60) return `Last seen ${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Last seen ${diffDays}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<OnlineUser[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "online">("chats");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredUsers = useMemo(() => {
    return onlineUsers.filter((user) =>
      user.anonymous_username
        .toLowerCase()
        .includes(userSearch.toLowerCase())
    );
  }, [onlineUsers, userSearch]);

  const filteredChats = useMemo(() => {
    return recentChats.filter((chat) =>
      chat.anonymous_username
        .toLowerCase()
        .includes(chatSearch.toLowerCase())
    );
  }, [recentChats, chatSearch]);

  const loadDashboard = async () => {
    setRefreshing(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const myId = userData.user.id;
    setCurrentUserId(myId);

    await setupPushNotifications(myId);
    await setUserOnline(myId);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", myId)
      .single();

    if (!profileData) {
      router.push("/setup");
      return;
    }

    if (profileData.is_banned) {
      await setUserOffline(myId);
      await supabase.auth.signOut();
      router.push("/login");
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

    setOnlineUsers(users || []);

    const suggested =
      users?.sort(() => 0.5 - Math.random()).slice(0, 3) || [];

    setSuggestedUsers(suggested);

    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_one.eq.${myId},user_two.eq.${myId}`)
      .order("created_at", { ascending: false });

    if (!conversations || conversations.length === 0) {
      setRecentChats([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const otherUserIds = conversations.map((conversation: Conversation) =>
      conversation.user_one === myId
        ? conversation.user_two
        : conversation.user_one
    );

    const { data: chatProfiles } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department")
      .in("id", otherUserIds);

    const chatList: RecentChat[] = await Promise.all(
      conversations.map(async (conversation: Conversation) => {
        const otherUserId =
          conversation.user_one === myId
            ? conversation.user_two
            : conversation.user_one;

        const otherProfile = chatProfiles?.find(
          (p) => p.id === otherUserId
        );

        const { data: lastMessage } = await supabase
          .from("messages")
          .select("message, created_at")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          conversation_id: conversation.id,
          user_id: otherUserId,
          anonymous_username:
            otherProfile?.anonymous_username || "Unknown User",
          department: otherProfile?.department || "Unknown",
          last_message: lastMessage?.message || "No messages yet",
          last_time: lastMessage?.created_at || conversation.created_at,
        };
      })
    );

    setRecentChats(chatList);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    let userId = "";
    let interval: NodeJS.Timeout;

    const setupPresence = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
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

    const handleBeforeUnload = () => {
      if (userId) {
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
          JSON.stringify({
            is_online: false,
            last_seen: new Date().toISOString(),
          })
        );
      }
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

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);

      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (userId) {
        setUserOffline(userId);
      }
    };
  }, []);

  const handleLogout = async () => {
    if (currentUserId) {
      await setUserOffline(currentUserId);
    }

    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#0E1621] text-white">
        Loading Daffgle...
      </main>
    );
  }

  return (
    <main className="flex h-dvh bg-[#0E1621] text-white">
      <aside className="flex w-full flex-col border-r border-[#22303D] bg-[#17212B] md:w-96">
        <div className="border-b border-[#22303D] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#2AABEE]">
                Daffgle
              </h1>

              <p className="text-sm text-gray-400">
                Anonymous DIU Chat
              </p>
            </div>

            <button
              onClick={loadDashboard}
              className="rounded-xl bg-[#2B5278] px-3 py-2 text-xs font-semibold hover:opacity-90"
            >
              {refreshing ? "..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-[#0F1A24] p-4">
            <p className="font-semibold">{profile?.anonymous_username}</p>
            <p className="text-sm text-gray-400">{profile?.department}</p>
            <p className="mt-2 text-xs text-green-400">● Online</p>
          </div>

          <div className="rounded-2xl bg-[#0F1A24] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2AABEE]">
                Suggested Users
              </h3>

              <span className="text-xs text-gray-500">Online now</span>
            </div>

            <div className="space-y-3">
              {suggestedUsers.length > 0 ? (
                suggestedUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => router.push(`/chat/${user.id}`)}
                    className="flex w-full items-center justify-between rounded-xl bg-[#17212B] p-3 text-left hover:bg-[#1D2A36]"
                  >
                    <div>
                      <p className="font-medium">
                        {user.anonymous_username}
                      </p>

                      <p className="text-xs text-gray-400">
                        {user.department}
                      </p>
                    </div>

                    <span className="text-xs text-green-400">
                      ● Online
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-xl bg-[#17212B] p-3 text-center text-xs text-gray-500">
                  No active users now.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("chats")}
              className={`rounded-xl py-2 text-sm font-semibold ${
                activeTab === "chats" ? "bg-[#2AABEE]" : "bg-[#0F1A24]"
              }`}
            >
              Chats
            </button>

            <button
              onClick={() => setActiveTab("online")}
              className={`rounded-xl py-2 text-sm font-semibold ${
                activeTab === "online" ? "bg-[#2AABEE]" : "bg-[#0F1A24]"
              }`}
            >
              Online
            </button>
          </div>

          {activeTab === "chats" ? (
            <>
              <input
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search recent chats..."
                className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-sm text-white placeholder:text-gray-500"
              />

              <div className="max-h-[42vh] space-y-3 overflow-y-auto">
                {filteredChats.length > 0 ? (
                  filteredChats.map((chat) => (
                    <button
                      key={chat.conversation_id}
                      onClick={() => router.push(`/chat/${chat.user_id}`)}
                      className="w-full rounded-2xl bg-[#0F1A24] p-4 text-left hover:bg-[#182533]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">
                          {chat.anonymous_username}
                        </p>

                        <p className="text-[10px] text-gray-500">
                          {new Date(chat.last_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <p className="text-sm text-gray-400">
                        {chat.department}
                      </p>

                      <p className="mt-1 truncate text-xs text-gray-500">
                        {chat.last_message}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[#0F1A24] p-4 text-center text-sm text-gray-400">
                    No recent chats yet.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-sm text-white placeholder:text-gray-500"
              />

              <div className="max-h-[42vh] space-y-3 overflow-y-auto">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-2xl bg-[#0F1A24] p-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {user.anonymous_username}
                        </p>

                        <p className="text-sm text-gray-400">
                          {user.department}
                        </p>

                        <p className="mt-1 text-xs text-green-400">
                          {formatLastSeen(user.last_seen, user.is_online)}
                        </p>
                      </div>

                      <button
                        onClick={() => router.push(`/chat/${user.id}`)}
                        className="rounded-xl bg-[#2AABEE] px-4 py-2 text-sm font-semibold hover:opacity-90"
                      >
                        Chat
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[#0F1A24] p-4 text-center text-sm text-gray-400">
                    No online users found.
                  </p>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleLogout}
            className="w-full rounded-2xl bg-[#2B5278] py-3 text-sm font-semibold hover:opacity-90"
          >
            Logout
          </button>
        </div>
      </aside>

      <section className="hidden flex-1 items-center justify-center bg-[#0F1A24] p-6 md:flex">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center"
        >
          <h2 className="text-4xl font-bold text-[#2AABEE]">
            Welcome to Daffgle
          </h2>

          <p className="mt-4 text-gray-400">
            Discover online DIU students and start anonymous conversations.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            <div className="rounded-2xl bg-[#17212B] p-4">
              <p className="text-2xl font-bold text-[#2AABEE]">
                {onlineUsers.length}
              </p>

              <p className="text-sm text-gray-400">Online users</p>
            </div>

            <div className="rounded-2xl bg-[#17212B] p-4">
              <p className="text-2xl font-bold text-[#2AABEE]">
                {recentChats.length}
              </p>

              <p className="text-sm text-gray-400">Recent chats</p>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}