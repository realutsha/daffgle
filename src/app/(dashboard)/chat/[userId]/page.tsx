"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { isEmailAllowed } from "@/lib/validations/auth";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  warning_badge?: string | null;
  is_online?: boolean;
  last_seen?: string;
};

type Message = {
  id: string;
  sender_id: string;
  conversation_id: string;
  message: string;
  created_at: string;
  seen?: boolean;
  status?: "sending" | "sent" | "error";
};

const REPORT_REASONS = [
  "Fake helper",
  "Did not help",
  "Abusive behavior",
  "Harassment",
  "Spam",
  "Suspicious activity"
];

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
  const conversationId = params.userId as string; // Treated directly as conversation_id from URL

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Associated Request tracking
  const [linkedRequestId, setLinkedRequestId] = useState("");

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

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

    if (!user || !isEmailAllowed(user.email)) {
      if (user) {
        await supabase.auth.signOut();
      }
      router.replace("/login?error=domain_restricted");
      return;
    }

    setCurrentUserId(user.id);
    await setUserOnline(user.id);

    // 1. Fetch the active help request matching this conversationId (include warning_badge)
    const { data: activeRequest, error: reqError } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(id, anonymous_username, department, is_online, last_seen, warning_badge), helper:profiles!helper_id(id, anonymous_username, department, is_online, last_seen, warning_badge)")
      .eq("conversation_id", conversationId)
      .single();

    if (reqError || !activeRequest) {
      console.warn("Active help request matching conversation_id not found:", reqError?.message);
      toast.error("Private chat is only accessible after accepting a help request.");
      router.replace("/dashboard");
      return;
    }

    setLinkedRequestId(activeRequest.id);

    // 2. Identify the other participant's profile
    const otherProfile = activeRequest.requester_id === user.id ? activeRequest.helper : activeRequest.requester;
    if (!otherProfile) {
      toast.error("Participant profile not found.");
      router.replace("/dashboard");
      return;
    }

    setOtherUser(otherProfile);

    // 3. Fetch messages for this conversation
    const { data: messageData, error } = await supabase
      .from("messages")
      .select("id, sender_id, conversation_id, message, created_at, seen")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading chat messages:", error.message, error.details);
    } else if (messageData) {
      setMessages(messageData);
    }

    // 4. Mark incoming messages as seen
    await supabase
      .from("messages")
      .update({ seen: true })
      .eq("conversation_id", conversationId)
      .eq("sender_id", otherProfile.id)
      .eq("seen", false);

    setLoading(false);
    scrollToBottom();
  }, [conversationId, router, scrollToBottom]);

  // Handle initial page load, presence, and status looping
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (userId) {
        setUserOffline(userId);
      }
    };
  }, [loadChat, router]);

  // Subscribe to other user's presence/profile updates
  useEffect(() => {
    if (!otherUser?.id) return;

    const profileChannel = supabase
      .channel(`profile-status-${otherUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${otherUser.id}`,
        },
        () => {
          loadChat();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [otherUser?.id, loadChat]);

  // Realtime subscription specifically for conversation messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`private-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (payload.new && payload.new.conversation_id === conversationId) {
            loadChat();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, loadChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const cleanText = text.trim();

    if (!cleanText || !currentUserId || !otherUser?.id || !conversationId) return;

    setSending(true);
    setText("");

    // 1. Create temporary message for optimistic rendering
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      conversation_id: conversationId,
      message: cleanText,
      created_at: new Date().toISOString(),
      seen: false,
      status: "sending"
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom();

    // 2. Insert to database
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        conversation_id: conversationId,
        message: cleanText,
        seen: false,
      })
      .select("id, sender_id, conversation_id, message, created_at, seen")
      .single();

    if (error) {
      console.error("Send message error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(cleanText);
      toast.error("Message failed to send. Please try again.");
    } else if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...data, status: "sent" } : m))
      );
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

  const handleReportParticipant = async () => {
    if (!otherUser?.id || !reportReason) {
      toast.error("Please choose a reason.");
      return;
    }

    try {
      setSubmittingReport(true);

      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_id: otherUser.id,
        reason: reportReason,
        details: reportDetails || null,
        conversation_id: conversationId,
        request_id: linkedRequestId || null,
        status: "pending"
      });

      if (error) {
        toast.error("Report failed: " + error.message);
        return;
      }

      toast.success(`User @${otherUser.anonymous_username} reported to admin center.`);
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
      
      // Reload to see badge update
      await loadChat();
    } catch {
      toast.error("Failed to submit report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <main className="flex h-dvh flex-col overflow-hidden bg-[#0E1621] text-white">
        <header className="z-30 border-b border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-[#0F1A24] border border-[#22303D]/10" />
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-[#2B5278]/25" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-[#2AABEE]/20" />
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-[#0F1A24] px-4 py-5 space-y-4">
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex justify-start">
              <div className="h-12 w-[60%] animate-pulse rounded-3xl rounded-bl-md bg-[#182533]/60" />
            </div>
            <div className="flex justify-end">
              <div className="h-14 w-[50%] animate-pulse rounded-3xl rounded-br-md bg-[#2B5278]/40" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0E1621] text-white">
      {/* Header */}
      <header className="z-30 border-b border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F1A24] text-xl font-black transition hover:bg-[#182533] cursor-pointer"
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
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-base font-black">
                {otherUser?.anonymous_username}
              </h1>
              {otherUser?.warning_badge && (
                <span className="rounded-full bg-red-650/15 border border-red-500/25 px-2 py-0.5 text-[8px] font-black text-red-400 uppercase tracking-wide animate-pulse">
                  ⚠️ {otherUser.warning_badge}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-gray-400">
              {isUserActuallyOnline(otherUser?.is_online, otherUser?.last_seen) ? "Online now" : otherUser?.department}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="rounded-2xl bg-red-950/20 border border-red-900/35 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-950/45 transition cursor-pointer"
            >
              Report User
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-[#2AABEE] px-4 py-2 text-xs font-black cursor-pointer hidden sm:block"
            >
              Help Hub
            </button>
          </div>
        </div>
      </header>

      {/* Messages List Area */}
      <section className="flex-1 overflow-y-auto bg-[#0F1A24] px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex justify-center">
            <div className="rounded-2xl border border-[#22303D] bg-[#17212B] px-4 py-2 text-center text-xs text-gray-400">
              Messages auto-delete after 7 days. Keep Daffgle safe, respectful, and anonymized.
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
                    transition={{ delay: index * 0.005 }}
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
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-6">
                        {message.message}
                      </p>

                      <div
                        className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                          isMine ? "text-blue-100/90" : "text-gray-400"
                        }`}
                      >
                        <span>{formatTime(message.created_at)}</span>
                        {isMine && (
                          <span className="flex items-center gap-0.5 select-none font-bold">
                            {message.status === "sending" ? (
                              <svg className="h-3 w-3 animate-spin text-blue-100" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : message.seen ? (
                              <span className="text-green-300 font-extrabold text-[11px] tracking-tighter">✓✓</span>
                            ) : (
                              <span className="text-blue-200 font-semibold text-[11px] tracking-tighter">✓</span>
                            )}
                          </span>
                        )}
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

      {/* Footer Text Area */}
      <footer className="border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur pb-safe">
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

      {/* Modal to Report Participant */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl space-y-6"
            >
              <div>
                <h3 className="text-2xl font-black text-red-400 tracking-tight">Report Participant</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Report student @<span className="text-white font-bold">{otherUser?.anonymous_username}</span> to Daffgle moderation center.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">
                    Select Report Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-red-400 outline-none transition"
                  >
                    <option value="">-- Choose reason --</option>
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">
                    Provide Audit Details
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Enter details, harassment logs, abusive behavior context..."
                    rows={4}
                    className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white outline-none focus:border-red-400 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportReason("");
                    setReportDetails("");
                  }}
                  disabled={submittingReport}
                  className="flex-1 rounded-2xl bg-[#0F1A24] border border-[#22303D] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleReportParticipant}
                  disabled={submittingReport || !reportReason}
                  className="flex-1 rounded-2xl bg-red-650 py-3 text-sm font-black text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-red-600/20"
                >
                  {submittingReport ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}