"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { isEmailAllowed } from "@/lib/validations/auth";
import { censorText } from "@/lib/night-owl/profanity";
import { 
  PremiumButton, 
  PremiumDialog, 
  PremiumSelect, 
  Skeleton, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { ArrowLeft, Flag, Check, CheckCheck, Loader2, Send, Trash2 } from "lucide-react";

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
  { value: "Fake helper", label: "Fake helper" },
  { value: "Did not help", label: "Did not help" },
  { value: "Abusive behavior", label: "Abusive behavior" },
  { value: "Harassment", label: "Harassment" },
  { value: "Spam", label: "Spam" },
  { value: "Suspicious activity", label: "Suspicious activity" }
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
  const conversationId = params.userId as string;

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

    // Try to load active help request matching this conversationId
    let otherProfile = null;
    let resolvedRequestId: string | null = null;

    const { data: activeRequest } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(id, anonymous_username, department, is_online, last_seen, warning_badge), helper:profiles!helper_id(id, anonymous_username, department, is_online, last_seen, warning_badge)")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (activeRequest) {
      resolvedRequestId = activeRequest.id;
      otherProfile = activeRequest.requester_id === user.id ? activeRequest.helper : activeRequest.requester;
    } else {
      // Fallback: Check active night_sessions instead!
      const { data: nightSession } = await supabase
        .from("night_sessions")
        .select("*, requester:profiles!requester_id(id, anonymous_username, department, is_online, last_seen, warning_badge), accepter:profiles!accepter_id(id, anonymous_username, department, is_online, last_seen, warning_badge)")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (nightSession) {
        resolvedRequestId = null;
        const participantProfile = nightSession.requester_id === user.id ? nightSession.accepter : nightSession.requester;
        
        if (participantProfile) {
          otherProfile = {
            id: participantProfile.id,
            anonymous_username: "Anonymous Owl",
            department: "Night Owl Mode",
            warning_badge: participantProfile.warning_badge,
            is_online: participantProfile.is_online,
            last_seen: participantProfile.last_seen
          };
        }
      }
    }

    if (!otherProfile) {
      console.warn("Active chat session matching conversation_id not found.");
      toast.error("Private chat is only accessible after accepting a help request or establishing a late-night session.");
      router.replace("/dashboard");
      return;
    }

    setLinkedRequestId(resolvedRequestId || "");
    setOtherUser(otherProfile);

    // Fetch messages for this conversation
    const { data: messageData, error } = await supabase
      .from("messages")
      .select("id, sender_id, conversation_id, message, created_at, seen")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading chat messages:", error.message);
    } else if (messageData) {
      setMessages(messageData);
    }

    // Mark incoming messages as seen
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
    const cleanText = censorText(text.trim());

    if (!cleanText || !currentUserId || !otherUser?.id || !conversationId) return;

    setSending(true);
    setText("");

    // Create temporary message for optimistic rendering
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

    // Insert to database
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

      // Trigger background push notification to chat participant
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new-message",
          targetUserId: otherUser.id,
          conversationId: conversationId
        })
      }).catch((err) => console.error("Failed to dispatch push message:", err));
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
      <main className="flex h-dvh flex-col overflow-hidden bg-brand-primary text-white">
        <header className="z-30 border-b border-brand-border bg-brand-secondary/95 px-4 py-3.5 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-12 w-12 rounded-2xl shrink-0" variant="avatar" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-brand-primary px-4 py-6 space-y-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex justify-start">
              <Skeleton className="h-12 w-[60%] rounded-2xl rounded-bl-md" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-14 w-[50%] rounded-2xl rounded-br-md" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  const isOnline = isUserActuallyOnline(otherUser?.is_online, otherUser?.last_seen);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-brand-primary text-brand-text-primary">
      
      {/* Dynamic Header */}
      <header className="z-30 border-b border-brand-border bg-brand-secondary/90 backdrop-blur-md px-4 py-3.5 pt-safe">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          
          {/* Back Action */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/chat")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-elevated/40 border border-brand-border text-lg font-bold text-white transition hover:bg-brand-elevated cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-white/80" />
          </motion.button>

          {/* User Details */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-elevated border border-brand-border text-[15px] font-black text-brand-accent shadow-inner select-none">
            {otherUser?.anonymous_username?.charAt(0).toUpperCase() || "U"}
            {isOnline && (
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-brand-secondary bg-green-500 shadow-sm animate-pulse-glow" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[15px] font-bold text-white">
                {otherUser?.anonymous_username}
              </h1>
              {otherUser?.warning_badge && (
                <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[8px] font-bold text-red-400 uppercase tracking-wider animate-pulse shrink-0">
                  ⚠️ {otherUser.warning_badge}
                </span>
              )}
            </div>
            <p className="truncate text-[11px] font-semibold text-brand-text-secondary select-none">
              {isOnline ? (
                <span className="text-green-400 font-bold">Online now</span>
              ) : (
                otherUser?.department
              )}
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowReportModal(true)}
              className="rounded-xl bg-red-500/10 border border-red-500/15 px-3 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition cursor-pointer flex items-center gap-1"
            >
              <Flag className="h-3 w-3" />
              Report
            </motion.button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-brand-elevated border border-brand-border px-4 py-2 text-[11px] font-bold transition hover:bg-brand-surface cursor-pointer hidden sm:block"
            >
              Help Hub
            </button>
          </div>
        </div>
      </header>

      {/* Messages Scroll Grid */}
      <section className="flex-1 overflow-y-auto bg-brand-primary px-4 py-6">
        <div className="mx-auto max-w-4xl">
          
          <div className="mb-6 flex justify-center">
            <div className="rounded-2xl border border-brand-border bg-brand-surface/65 px-4 py-2 text-center text-[10px] font-bold text-brand-text-secondary select-none tracking-wide max-w-sm uppercase">
              🔒 Encrypted • auto-purged after 7 days
            </div>
          </div>

          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-20 text-center space-y-4"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-surface border border-brand-border text-4xl shadow-inner select-none">
                  🕊️
                </div>
                <h2 className="text-lg font-bold text-white">Start the conversation</h2>
                <p className="text-xs text-brand-text-secondary max-w-xs mx-auto leading-relaxed">
                  Send the first completely anonymous verified message. Always stay polite and helpful.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isMine = message.sender_id === currentUserId;

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...premiumSpring, delay: index * 0.003 }}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        onDoubleClick={() => isMine && deleteMessage(message.id)}
                        className={`max-w-[82%] sm:max-w-[65%] px-4 py-3 shadow-lg transition duration-200 select-none group relative ${
                          isMine
                            ? "bg-brand-accent text-black font-semibold rounded-[20px] rounded-br-[4px] shadow-[0_0_15px_rgba(124,255,107,0.2)]"
                            : "bg-brand-surface border border-brand-border text-brand-text-primary rounded-[20px] rounded-bl-[4px]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                          {message.message}
                        </p>

                        <div
                          className={`mt-1.5 flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-wider ${
                            isMine ? "text-brand-primary/60" : "text-brand-text-secondary"
                          }`}
                        >
                          <span>{formatTime(message.created_at)}</span>
                          
                          {isMine && (
                            <span className="flex items-center select-none font-bold">
                              {message.status === "sending" ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin opacity-80" />
                              ) : message.seen ? (
                                <CheckCheck className="h-3 w-3 text-brand-accent font-black drop-shadow-[0_0_5px_#7CFF6B]" />
                              ) : (
                                <Check className="h-3 w-3 text-brand-primary/50" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Double tap delete visual cue */}
                        {isMine && (
                          <span className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition duration-150 cursor-pointer p-1 text-red-400" onClick={() => deleteMessage(message.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-start mb-2 animate-pulse"
              >
                <div className="flex items-center gap-1.5 px-4.5 py-3 bg-brand-surface border border-brand-border rounded-[20px] rounded-bl-[4px] shadow-[0_0_15px_rgba(124,255,107,0.08)]">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </section>

      {/* Modern Static Bottom Input Area */}
      <footer className="border-t border-brand-border bg-brand-secondary/95 px-4 py-3.5 backdrop-blur-md pb-safe">
        <div className="mx-auto flex max-w-4xl items-end gap-3">
          
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Write an encrypted message..."
            rows={1}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-brand-border bg-brand-primary px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-brand-accent/25 transition duration-150 leading-relaxed"
          />

          <PremiumButton
            onClick={sendMessage}
            disabled={!canSend}
            variant="primary"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl p-0 hover:scale-105"
            withNeonGlow
          >
            <Send className="h-4 w-4 text-brand-primary" />
          </PremiumButton>
        </div>

        <p className="mx-auto mt-2 max-w-4xl px-2 text-[9px] font-semibold text-brand-text-secondary select-none tracking-wide uppercase text-center">
          💡 Double tap (or click trash icon) on your own message to retract it.
        </p>
      </footer>

      {/* Custom Moderation Report Dialog */}
      <PremiumDialog
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportReason("");
          setReportDetails("");
        }}
        title="Report Participant"
        description={`File an anonymous report against @${otherUser?.anonymous_username || "User"} to Daffgle moderation center for immediate audit.`}
      >
        <div className="space-y-4">
          <PremiumSelect
            label="Report Category"
            value={reportReason}
            onChange={setReportReason}
            options={REPORT_REASONS}
            placeholder="Select a category..."
          />

          <div className="space-y-1.5 flex flex-col">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest ml-1 select-none">
              Additional Audit Context
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Provide context logs, screenshot links, or details regarding harassment..."
              rows={4}
              className="w-full rounded-2xl border border-brand-border bg-brand-primary px-4 py-3 text-white outline-none focus:border-red-400 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <PremiumButton
              onClick={() => {
                setShowReportModal(false);
                setReportReason("");
                setReportDetails("");
              }}
              variant="secondary"
              className="flex-1"
              disabled={submittingReport}
            >
              Cancel
            </PremiumButton>

            <PremiumButton
              onClick={handleReportParticipant}
              disabled={submittingReport || !reportReason}
              variant="danger"
              className="flex-1"
              withNeonGlow
            >
              {submittingReport ? "Auditing..." : "File Report"}
            </PremiumButton>
          </div>
        </div>
      </PremiumDialog>
    </main>
  );
}