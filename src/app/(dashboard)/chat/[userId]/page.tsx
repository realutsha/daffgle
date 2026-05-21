"use client";

import { supabase } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type TargetUser = {
  id: string;
  anonymous_username: string;
  department: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  seen: boolean;
  delivered?: boolean;
  seen_at?: string | null;
  created_at: string;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";

const TYPING_TIMEOUT_MS = 2000;

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const targetUserId = params.userId as string;

  const [currentUserId, setCurrentUserId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  const [isBlocked, setIsBlocked] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const markMessagesAsSeen = async (chatId: string, myId: string) => {
    await supabase
      .from("messages")
      .update({
        seen: true,
        seen_at: new Date().toISOString(),
      })
      .eq("conversation_id", chatId)
      .neq("sender_id", myId)
      .eq("seen", false);
  };

  const checkBlockStatus = async (myId: string, otherId: string) => {
    const { data } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", myId)
      .eq("blocked_id", otherId)
      .maybeSingle();

    setIsBlocked(!!data);
  };

  useEffect(() => {
    let messageChannel: any = null;
    let typingChannel: any = null;

    const loadChat = async () => {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      const myId = userData.user.id;

      if (myId === targetUserId) {
        router.push("/dashboard");
        return;
      }

      setCurrentUserId(myId);
      await checkBlockStatus(myId, targetUserId);

      const { data: target } = await supabase
        .from("profiles")
        .select("id, anonymous_username, department")
        .eq("id", targetUserId)
        .single();

      if (!target) {
        router.push("/dashboard");
        return;
      }

      setTargetUser(target);

      const { data: existingConversation } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(user_one.eq.${myId},user_two.eq.${targetUserId}),and(user_one.eq.${targetUserId},user_two.eq.${myId})`
        )
        .maybeSingle();

      let chatId = existingConversation?.id;

      if (!chatId) {
        const { data: newConversation } = await supabase
          .from("conversations")
          .insert({
            user_one: myId,
            user_two: targetUserId,
          })
          .select("id")
          .single();

        if (!newConversation) {
          setError("Could not start conversation.");
          setLoading(false);
          return;
        }

        chatId = newConversation.id;
      }

      setConversationId(chatId);

      const { data: loadedMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", chatId)
        .order("created_at", { ascending: true });

      setMessages(loadedMessages || []);

      await markMessagesAsSeen(chatId, myId);

      setLoading(false);

      setTimeout(() => {
        scrollToBottom();
      }, 100);

      messageChannel = supabase
        .channel(`messages-${chatId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${chatId}`,
          },
          async (payload) => {
            const newMessage = payload.new as Message;

            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, newMessage];
            });

            if (newMessage.sender_id !== myId) {
              await markMessagesAsSeen(chatId, myId);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${chatId}`,
          },
          (payload) => {
            const updated = payload.new as Message;

            setMessages((prev) =>
              prev.map((msg) => (msg.id === updated.id ? updated : msg))
            );
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnectionStatus("connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnectionStatus("disconnected");
          } else {
            setConnectionStatus("connecting");
          }
        });

      typingChannel = supabase.channel(`typing-${chatId}`, {
        config: {
          broadcast: {
            self: false,
          },
        },
      });

      typingChannel
        .on("broadcast", { event: "typing" }, (payload: any) => {
          if (payload.payload?.senderId !== targetUserId) return;

          setIsTyping(true);

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, TYPING_TIMEOUT_MS);
        })
        .subscribe();

      typingChannelRef.current = typingChannel;
    };

    loadChat();

    return () => {
      if (messageChannel) supabase.removeChannel(messageChannel);
      if (typingChannel) supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [router, targetUserId, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleTyping = (value: string) => {
    setText(value);

    if (!typingChannelRef.current || !currentUserId || isBlocked) return;

    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        senderId: currentUserId,
      },
    });
  };

  const sendMessage = async () => {
    const messageText = text.trim();

    if (!messageText || !conversationId || !currentUserId || isBlocked) return;

    setText("");
    setError("");

    const { error: sendError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      message: messageText,
      delivered: true,
      seen: false,
    });

    if (sendError) {
      setError("Message failed to send.");
      setText(messageText);
    }
  };

  const blockUser = async () => {
    if (!currentUserId || !targetUserId) return;

    const confirmed = confirm("Are you sure you want to block this user?");
    if (!confirmed) return;

    const { error: blockError } = await supabase.from("blocked_users").insert({
      blocker_id: currentUserId,
      blocked_id: targetUserId,
    });

    if (blockError) {
      alert("Failed to block user.");
      return;
    }

    setIsBlocked(true);
    setShowActions(false);
    alert("User blocked successfully.");
  };

  const submitReport = async () => {
    if (!currentUserId || !targetUserId) return;

    if (!reportReason.trim()) {
      alert("Please enter report reason.");
      return;
    }

    const { error: reportError } = await supabase.from("reports").insert({
      reporter_id: currentUserId,
      reported_id: targetUserId,
      reason: reportReason.trim(),
      details: reportDetails.trim() || null,
    });

    if (reportError) {
      alert("Failed to submit report.");
      return;
    }

    setShowReportModal(false);
    setReportReason("");
    setReportDetails("");
    alert("Report submitted.");
  };

  const renderMessageStatus = (msg: Message) => {
    if (msg.sender_id !== currentUserId) return null;

    if (msg.seen) {
      return <span className="text-[#2AABEE]">✓✓</span>;
    }

    return <span className="text-gray-400">✓</span>;
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0E1621] text-white">
      <header className="flex items-center gap-4 border-b border-[#22303D] bg-[#17212B] p-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-xl bg-[#2B5278] px-4 py-2 text-sm hover:opacity-80"
        >
          Back
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2B5278] font-bold">
          {targetUser?.anonymous_username?.charAt(0).toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">
            {targetUser?.anonymous_username || "Loading..."}
          </h1>

          <p className="text-sm text-gray-400">
            {isTyping ? (
              <span className="text-[#2AABEE]">typing...</span>
            ) : (
              targetUser?.department
            )}
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="rounded-xl bg-[#0F1A24] px-3 py-2 text-sm hover:bg-[#182533]"
          >
            ⋮
          </button>

          {showActions && (
            <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-[#22303D] bg-[#17212B] p-2 shadow-xl">
              <button
                onClick={() => {
                  setShowReportModal(true);
                  setShowActions(false);
                }}
                className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-[#0F1A24]"
              >
                Report User
              </button>

              <button
                onClick={blockUser}
                className="w-full rounded-xl px-4 py-3 text-left text-sm text-red-400 hover:bg-[#0F1A24]"
              >
                Block User
              </button>
            </div>
          )}
        </div>

        <div className="hidden text-xs text-gray-400 sm:block">
          {connectionStatus === "connected" && "● Live"}
          {connectionStatus === "connecting" && "● Connecting"}
          {connectionStatus === "disconnected" && "● Reconnecting"}
        </div>
      </header>

      {error && (
        <div className="bg-red-900/40 px-4 py-2 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="flex flex-1 flex-col bg-[#0F1A24]">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <p className="mt-10 text-center text-gray-500">
              Loading messages...
            </p>
          ) : messages.length === 0 ? (
            <p className="mt-10 text-center text-gray-500">
              No messages yet.
            </p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      isMine ? "bg-[#2B5278]" : "bg-[#182533]"
                    }`}
                  >
                    <p
                      style={{
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {msg.message}
                    </p>

                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-gray-300">
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {renderMessageStatus(msg)}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-[#182533] px-4 py-2 text-sm text-gray-400">
                typing...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {isBlocked && (
          <div className="border-t border-[#22303D] bg-red-900/30 px-4 py-3 text-center text-sm text-red-300">
            You blocked this user. Messaging disabled.
          </div>
        )}

        <div className="flex gap-3 border-t border-[#22303D] bg-[#17212B] p-4">
          <input
            value={text}
            disabled={isBlocked}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder={
              isBlocked ? "Messaging disabled" : "Write a message..."
            }
            className="flex-1 rounded-2xl bg-[#0F1A24] px-4 py-3 text-white outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <button
            onClick={sendMessage}
            disabled={!text.trim() || isBlocked}
            className="rounded-2xl bg-[#2AABEE] px-5 font-semibold hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </section>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#17212B] p-6">
            <h2 className="text-xl font-bold text-[#2AABEE]">Report User</h2>

            <input
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason"
              className="mt-4 w-full rounded-2xl bg-[#0F1A24] px-4 py-3 text-white outline-none placeholder:text-gray-500"
            />

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Extra details"
              rows={4}
              className="mt-4 w-full rounded-2xl bg-[#0F1A24] px-4 py-3 text-white outline-none placeholder:text-gray-500"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 rounded-2xl bg-[#0F1A24] py-3"
              >
                Cancel
              </button>

              <button
                onClick={submitReport}
                className="flex-1 rounded-2xl bg-[#2AABEE] py-3 font-semibold"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}