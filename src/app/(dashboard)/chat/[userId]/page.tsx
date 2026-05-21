"use client";

import { supabase } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  created_at: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const targetUserId = params.userId as string;

  const [currentUserId, setCurrentUserId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<any>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const loadChat = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      const myId = userData.user.id;
      setCurrentUserId(myId);

      const { data: target } = await supabase
        .from("profiles")
        .select("id, anonymous_username, department")
        .eq("id", targetUserId)
        .single();

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

        chatId = newConversation?.id;
      }

      if (!chatId) return;

      setConversationId(chatId);

      const { data: loadedMessages } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, message, seen, created_at")
        .eq("conversation_id", chatId)
        .order("created_at", { ascending: true });

      if (loadedMessages) {
        setMessages(loadedMessages);
      }
      const realtimeChannel = supabase
  .channel(`chat-${chatId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${chatId}`,
    },
    (payload) => {
      const newMessage = payload.new as Message;

      setMessages((prev) => {
        const exists = prev.find((msg) => msg.id === newMessage.id);

        if (exists) return prev;

        return [...prev, newMessage];
      });
    }
  )
  .subscribe();

setChannel(realtimeChannel);
    };

    loadChat();
  return () => {
  if (channel) {
    supabase.removeChannel(channel);
  }
};
}, [router, targetUserId, channel]);

  const sendMessage = async () => {
    if (!text.trim() || !conversationId || !currentUserId) return;

    const messageText = text.trim();
    setText("");

    const { data } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        message: messageText,
      })
      .select("id, conversation_id, sender_id, message, seen, created_at")
      .single();

    
  };

  return (
    <main className="flex h-screen flex-col bg-[#0E1621] text-white">
      <header className="flex items-center gap-4 border-b border-[#22303D] bg-[#17212B] p-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-xl bg-[#2B5278] px-4 py-2 text-sm"
        >
          Back
        </button>

        <div>
          <h1 className="text-lg font-bold">
            {targetUser?.anonymous_username || "Loading..."}
          </h1>
          <p className="text-sm text-gray-400">{targetUser?.department}</p>
        </div>
      </header>

      <section className="flex flex-1 flex-col bg-[#0F1A24]">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="mt-10 text-center text-gray-500">
              No messages yet. Start the conversation.
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
                    <p className="wrap-break-word">{msg.message}</p>
                    <p className="mt-1 text-right text-[10px] text-gray-300">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-3 border-t border-[#22303D] bg-[#17212B] p-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Write a message..."
            className="flex-1 rounded-2xl bg-[#0F1A24] px-4 py-3 text-white placeholder:text-gray-500"
          />

          <button
            onClick={sendMessage}
            className="rounded-2xl bg-[#2AABEE] px-5 font-semibold"
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
}