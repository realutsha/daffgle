"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  is_online?: boolean;
  last_seen?: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  seen?: boolean;
};

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isUserActuallyOnline(isOnline: boolean | undefined, lastSeen: string | undefined) {
  if (!isOnline) return false;
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen).getTime();
  const now = Date.now();
  return now - lastSeenDate < 90000;
}

export default function PrivateChatPage() {
  const router = useRouter();
  const params = useParams();
  const otherUserId = params.userId as string;

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const loadChat = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUserId(user.id);
    await setUserOnline(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, anonymous_username, department, is_online, last_seen")
      .eq("id", otherUserId)
      .single();

    if (!profileData) {
      router.replace("/dashboard");
      return;
    }

    setOtherUser(profileData);

    const { data: messageData, error } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at, seen")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    if (!error) {
      setMessages(messageData || []);
    }

    await supabase
      .from("messages")
      .update({ seen: true })
      .eq("sender_id", otherUserId)
      .eq("receiver_id", user.id)
      .eq("seen", false);

    setLoading(false);
    scrollToBottom();
  }, [otherUserId, router, scrollToBottom]);

  useEffect(() => {
    let userId = "";
    let interval: NodeJS.Timeout;

    const init = async () => {
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
      await loadChat();

      interval = setInterval(async () => {
        await setUserOnline(user.id);
      }, 30000);
    };

    init();

    const channel = supabase
      .channel(`private-chat-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${otherUserId}`,
        },
        (payload) => {
          if (payload.new.receiver_id === currentUserId) {
            loadChat();
          }
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`profile-status-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${otherUserId}`,
        },
        () => {
          loadChat();
        }
      )
      .subscribe();

    const handleVisibilityChange = async () => {
      if (!userId) return;

      if (document.hidden) {
        await setUserOffline(userId);
      } else {
        await setUserOnline(userId);
        await loadChat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);

      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);

      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (userId) {
        setUserOffline(userId);
      }
    };
  }, [otherUserId, loadChat, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const cleanText = text.trim();

    if (!cleanText || !currentUserId || !otherUserId) return;

    setSending(true);
    setText("");

    const { error } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: cleanText,
      seen: false,
    });

    if (error) {
      console.error("Send message error:", error);
      setText(cleanText);
    } else {
      await loadChat();
    }

    setSending(false);
  };

  const deleteMessage = async (messageId: string) => {
    const confirmDelete = window.confirm("Delete this message?");
    if (!confirmDelete) return;

    await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", currentUserId);

    await loadChat();
  };

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#0E1621] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-3xl bg-[#2AABEE]" />
          <p className="text-sm text-gray-400">Opening private chat...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0E1621] text-white">
      <header className="z-30 border-b border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F1A24] text-xl font-black transition hover:bg-[#182533]"
          >
            ‹
          </button>

          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2B5278] text-lg font-black">
            {otherUser?.anonymous_username?.charAt(0).toUpperCase() || "U"}

            {isUserActuallyOnline(otherUser?.is_online, otherUser?.last_seen) && (
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-[#17212B] bg-green-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black">
              {otherUser?.anonymous_username}
            </h1>
            <p className="truncate text-xs text-gray-400">
              {isUserActuallyOnline(otherUser?.is_online, otherUser?.last_seen) ? "Online now" : otherUser?.department}
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl bg-[#2AABEE] px-4 py-2 text-xs font-black"
          >
            Online
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto bg-[#0F1A24] px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex justify-center">
            <div className="rounded-2xl border border-[#22303D] bg-[#17212B] px-4 py-2 text-center text-xs text-gray-400">
              Messages auto-delete after 7 days. Keep Daffgle safe and
              respectful.
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="mt-24 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-4xl bg-[#17212B] text-4xl">
                👻
              </div>
              <h2 className="text-xl font-black">Start the conversation</h2>
              <p className="mt-2 text-sm text-gray-400">
                Send the first anonymous message.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => {
                const isMine = message.sender_id === currentUserId;

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.01 }}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      onDoubleClick={() => isMine && deleteMessage(message.id)}
                      className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-lg md:max-w-[60%] ${
                        isMine
                          ? "rounded-br-md bg-[#2B5278] text-white"
                          : "rounded-bl-md bg-[#182533] text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap wrap-break-word text-[15px] leading-6">
                        {message.content}
                      </p>

                      <div
                        className={`mt-1 flex items-center gap-1 text-[10px] ${
                          isMine ? "justify-end text-blue-100" : "text-gray-400"
                        }`}
                      >
                        <span>{formatTime(message.created_at)}</span>
                        {isMine && <span>{message.seen ? "Seen" : "Sent"}</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      <footer className="border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-end gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Write a message..."
            rows={1}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border border-[#22303D] bg-[#0E1621] px-5 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#2AABEE]"
          />

          <button
            onClick={sendMessage}
            disabled={!canSend}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2AABEE] text-lg font-black shadow-lg shadow-[#2AABEE]/20 transition hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ➤
          </button>
        </div>

        <p className="mx-auto mt-2 max-w-5xl px-2 text-[10px] text-gray-500">
          Tip: double click your own message to delete it.
        </p>
      </footer>
    </main>
  );
}