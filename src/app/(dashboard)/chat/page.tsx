"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  anonymous_username: string;
  department: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_online: boolean;
  last_seen?: string;
};

function formatTime(date: string) {
  const messageDate = new Date(date);
  const now = new Date();

  const isToday =
    messageDate.getDate() === now.getDate() &&
    messageDate.getMonth() === now.getMonth() &&
    messageDate.getFullYear() === now.getFullYear();

  if (isToday) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return messageDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function isUserActuallyOnline(isOnline: boolean | undefined, lastSeen: string | undefined) {
  if (!isOnline) return false;
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen).getTime();
  const now = Date.now();
  return now - lastSeenDate < 90000;
}

export default function ChatPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;

    return conversations.filter((chat) => {
      return (
        chat.anonymous_username
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        chat.department.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [search, conversations]);

  const loadChats = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setCurrentUserId(user.id);

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    
    if (error) {
  console.warn("Chat load warning:", error.message);
  setConversations([]);
  setLoading(false);
  return;
}

    const latestMap = new Map();

    for (const message of messages || []) {
      const otherId =
        message.sender_id === user.id
          ? message.receiver_id
          : message.sender_id;

      if (!latestMap.has(otherId)) {
        latestMap.set(otherId, message);
      }
    }

    const userIds = Array.from(latestMap.keys());

    if (userIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department, is_online, last_seen")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((profile) => [profile.id, profile])
    );

    const finalChats: Conversation[] = [];

    for (const [otherId, message] of latestMap.entries()) {
      const profile = profileMap.get(otherId);

      if (!profile) continue;

      const unreadCount = (messages || []).filter(
        (m) =>
          m.sender_id === otherId &&
          m.receiver_id === user.id &&
          m.seen === false
      ).length;

      finalChats.push({
        id: otherId,
        anonymous_username: profile.anonymous_username,
        department: profile.department,
        last_message: message.content,
        last_message_time: message.created_at,
        unread_count: unreadCount,
        is_online: profile.is_online,
        last_seen: profile.last_seen,
      });
    }

    finalChats.sort(
      (a, b) =>
        new Date(b.last_message_time).getTime() -
        new Date(a.last_message_time).getTime()
    );

    setConversations(finalChats);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("chat-page-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          loadChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadChats]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0E1621] text-white">
        Loading chats...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0E1621] text-white">
      <div className="mx-auto w-full max-w-2xl">
        <header className="sticky top-0 z-50 border-b border-[#22303D] bg-[#17212B]/95 backdrop-blur">
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-[#2AABEE]">
                  Chats
                </h1>

                <p className="mt-1 text-sm text-gray-400">
                  Your anonymous conversations
                </p>
              </div>

              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-2xl bg-[#2B5278] px-4 py-2 text-sm font-bold transition hover:opacity-90"
              >
                Online
              </button>
            </div>

            <div className="mt-5">
              <input
                type="text"
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-5 py-4 text-sm outline-none placeholder:text-gray-500 focus:border-[#2AABEE]"
              />
            </div>
          </div>
        </header>

        <section className="px-3 pb-28 pt-3">
          {filteredConversations.length === 0 ? (
            <div className="mt-24 text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-4xl bg-[#17212B] text-5xl">
                💬
              </div>

              <h2 className="text-2xl font-black">No conversations yet</h2>

              <p className="mt-3 text-sm text-gray-400">
                Start chatting from the online users page.
              </p>

              <button
                onClick={() => router.push("/dashboard")}
                className="mt-6 rounded-2xl bg-[#2AABEE] px-6 py-3 text-sm font-black"
              >
                Open Online Users
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((chat, index) => (
                <motion.button
                  key={chat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => router.push(`/chat/${chat.id}`)}
                  className="w-full rounded-3xl border border-transparent bg-[#17212B] p-4 text-left transition hover:border-[#2AABEE]/40 hover:bg-[#1C2B3A]"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2B5278] text-lg font-black">
                      {chat.anonymous_username.charAt(0).toUpperCase()}

                      {isUserActuallyOnline(chat.is_online, chat.last_seen) && (
                        <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-[#17212B] bg-green-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black">
                            {chat.anonymous_username}
                          </p>

                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {chat.department}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[11px] text-gray-500">
                            {formatTime(chat.last_message_time)}
                          </span>

                          {chat.unread_count > 0 && (
                            <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#2AABEE] px-2 text-[11px] font-black text-white">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </div>

                      <p
                        className={`mt-2 line-clamp-1 text-sm ${
                          chat.unread_count > 0
                            ? "font-bold text-white"
                            : "text-gray-400"
                        }`}
                      >
                        {chat.last_message}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300"
            >
              Online
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="rounded-2xl bg-[#2AABEE] py-3 text-sm font-black"
            >
              Chats
            </button>
          </div>
        </nav>
      </div>
    </main>
  );
}