"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  is_online: boolean;
};

type OnlineUser = {
  id: string;
  anonymous_username: string;
  department: string;
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

export default function DashboardPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "online">("chats");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredUsers = useMemo(() => {
    return onlineUsers.filter((user) =>
      user.anonymous_username.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [onlineUsers, userSearch]);

  const filteredChats = useMemo(() => {
    return recentChats.filter((chat) =>
      chat.anonymous_username.toLowerCase().includes(chatSearch.toLowerCase())
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

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department, gender, is_online")
      .eq("id", myId)
      .single();

    if (!profileData) {
      router.push("/setup");
      return;
    }

    setProfile(profileData);

    await supabase.from("profiles").update({ is_online: true }).eq("id", myId);

    const { data: users } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department")
      .eq("is_online", true)
      .neq("id", myId);

    setOnlineUsers(users || []);

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, user_one, user_two, created_at")
      .or(`user_one.eq.${myId},user_two.eq.${myId}`)
      .order("created_at", { ascending: false });

    if (!conversations || conversations.length === 0) {
      setRecentChats([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const otherUserIds = conversations.map((conversation: Conversation) =>
      conversation.user_one === myId ? conversation.user_two : conversation.user_one
    );

    const { data: chatProfiles } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department")
      .in("id", otherUserIds);

    const chatList: RecentChat[] = await Promise.all(
      conversations.map(async (conversation: Conversation) => {
        const otherUserId =
          conversation.user_one === myId ? conversation.user_two : conversation.user_one;

        const otherProfile = chatProfiles?.find((p) => p.id === otherUserId);

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
          anonymous_username: otherProfile?.anonymous_username || "Unknown User",
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
    loadDashboard();
  }, []);

  const handleLogout = async () => {
    if (currentUserId) {
      await supabase
        .from("profiles")
        .update({ is_online: false })
        .eq("id", currentUserId);
    }

    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white">
        Loading Daffgle...
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-[#0E1621] text-white">
      <aside className="flex w-full flex-col border-r border-[#22303D] bg-[#17212B] md:w-96">
        <div className="border-b border-[#22303D] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#2AABEE]">Daffgle</h1>
              <p className="text-sm text-gray-400">Anonymous DIU Chat</p>
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

              <div className="max-h-[55vh] space-y-3 overflow-y-auto">
                {filteredChats.length > 0 ? (
                  filteredChats.map((chat) => (
                    <button
                      key={chat.conversation_id}
                      onClick={() => router.push(`/chat/${chat.user_id}`)}
                      className="w-full rounded-2xl bg-[#0F1A24] p-4 text-left hover:bg-[#182533]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{chat.anonymous_username}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(chat.last_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <p className="text-sm text-gray-400">{chat.department}</p>
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
                placeholder="Search online users..."
                className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-sm text-white placeholder:text-gray-500"
              />

              <div className="max-h-[55vh] space-y-3 overflow-y-auto">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-2xl bg-[#0F1A24] p-4"
                    >
                      <div>
                        <p className="font-semibold">{user.anonymous_username}</p>
                        <p className="text-sm text-gray-400">{user.department}</p>
                        <p className="mt-1 text-xs text-green-400">● Online</p>
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
            Select an online user or recent conversation to start anonymous chat.
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