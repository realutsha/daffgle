"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";

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

    if (!user || !isEmailAllowed(user.email)) {
      if (user) {
        await supabase.auth.signOut();
      }
      router.push("/login?error=domain_restricted");
      return;
    }

    setCurrentUserId(user.id);

    // Fetch active help requests where current user is requester or helper, along with participant profiles
    const { data: activeRequests, error } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(id, anonymous_username, department, is_online, last_seen), helper:profiles!helper_id(id, anonymous_username, department, is_online, last_seen)")
      .or(`requester_id.eq.${user.id},helper_id.eq.${user.id}`)
      .in("status", ["accepted", "solved"]);

    if (error) {
      console.warn("Chat load warning:", error.message);
      setConversations([]);
      setLoading(false);
      return;
    }

    const finalChats: Conversation[] = [];

    for (const req of activeRequests || []) {
      const otherProfile = req.requester_id === user.id ? req.helper : req.requester;
      if (!otherProfile) continue;

      let lastMsgText = "👋 Chat accepted. Start conversing!";
      let lastMsgTime = req.created_at;
      let unreadCount = 0;

      if (req.conversation_id) {
        // Query the messages for this conversation with correct columns
        const { data: messages } = await supabase
          .from("messages")
          .select("message, created_at, sender_id, seen")
          .eq("conversation_id", req.conversation_id)
          .order("created_at", { ascending: false });

        if (messages && messages.length > 0) {
          lastMsgText = messages[0].message;
          lastMsgTime = messages[0].created_at;
          unreadCount = messages.filter(
            (m) => m.sender_id !== user.id && m.seen === false
          ).length;
        }
      }

      finalChats.push({
        id: req.conversation_id,
        anonymous_username: otherProfile.anonymous_username,
        department: otherProfile.department,
        last_message: lastMsgText,
        last_message_time: lastMsgTime,
        unread_count: unreadCount,
        is_online: otherProfile.is_online,
        last_seen: otherProfile.last_seen,
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
    const init = async () => {
      await loadChats();
    };
    init();
  }, [loadChats]);

  useEffect(() => {
    if (!currentUserId) return;

    // Listen for any inserts or updates on the messages table to reload our chats list in real-time
    const channel = supabase
      .channel("chat-page-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
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
      <main className="min-h-screen bg-[#0E1621] text-white">
        <div className="mx-auto w-full max-w-2xl px-5 py-5 space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-24 animate-pulse rounded-full bg-[#2AABEE]/20" />
              <div className="h-4 w-44 animate-pulse rounded-full bg-[#2AABEE]/10" />
            </div>
            <div className="h-10 w-20 animate-pulse rounded-2xl bg-[#2B5278]/30" />
          </div>
          {/* Search Box Skeleton */}
          <div className="h-14 w-full animate-pulse rounded-2xl bg-[#0F1A24] border border-[#22303D]" />
          
          {/* Conversation List Skeletons */}
          <div className="space-y-4 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-3xl bg-[#17212B] p-4 border border-[#22303D]/10">
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-[#2B5278]/25" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-4 w-28 animate-pulse rounded bg-[#2AABEE]/20" />
                    <div className="h-3 w-10 animate-pulse rounded bg-gray-600/30" />
                  </div>
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-600/20" />
                  <div className="h-4 w-[85%] animate-pulse rounded bg-gray-500/10 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
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
                  My Chats
                </h1>

                <p className="mt-1 text-sm text-gray-400">
                  Your anonymous conversations
                </p>
              </div>

              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-2xl bg-[#2B5278] px-4 py-2 text-sm font-bold transition hover:opacity-90 cursor-pointer"
              >
                Help Hub
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
                Start helping others or create a request in the Help Hub.
              </p>

              <button
                onClick={() => router.push("/dashboard")}
                className="mt-6 rounded-2xl bg-[#2AABEE] px-6 py-3 text-sm font-black cursor-pointer"
              >
                Open Help Hub
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
                  className="w-full rounded-3xl border border-transparent bg-[#17212B] p-4 text-left transition hover:border-[#2AABEE]/40 hover:bg-[#1C2B3A] cursor-pointer"
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
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533] cursor-pointer"
            >
              Help Hub
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="rounded-2xl bg-[#2AABEE] py-3 text-sm font-black text-white shadow-lg shadow-[#2AABEE]/20 cursor-pointer"
            >
              My Chats
            </button>

            <button
              onClick={() => router.push("/profile")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533] cursor-pointer"
            >
              Profile
            </button>
          </div>
        </nav>
      </div>
    </main>
  );
}