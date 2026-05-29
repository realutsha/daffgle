/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";
import { 
  PremiumInput, 
  FloatingBottomNav, 
  EmptyState, 
  Skeleton, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { Search } from "lucide-react";

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
  const { featureToggles } = useAppSettings();

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

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, cur) => acc + cur.unread_count, 0);
  }, [conversations]);

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

    // Fetch active Night Owl sessions where current user is requester or accepter
    const { data: activeNightSessions, error: nightError } = await supabase
      .from("night_sessions")
      .select("*, requester:profiles!requester_id(id, anonymous_username, department, is_online, last_seen), accepter:profiles!accepter_id(id, anonymous_username, department, is_online, last_seen)")
      .or(`requester_id.eq.${user.id},accepter_id.eq.${user.id}`)
      .eq("active", true);

    if (error && nightError) {
      console.warn("Chat load warning:", error?.message, nightError?.message);
      setConversations([]);
      setLoading(false);
      return;
    }

    const finalChats: Conversation[] = [];

    // Process Help Hub Chats
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

    // Process Night Owl Chats (Forcing complete anonymity)
    for (const sess of activeNightSessions || []) {
      const otherProfile = sess.requester_id === user.id ? sess.accepter : sess.requester;
      if (!otherProfile) continue;

      let lastMsgText = "👋 Night Owl chat accepted. Start conversing!";
      let lastMsgTime = sess.created_at;
      let unreadCount = 0;

      if (sess.conversation_id) {
        // Query the messages for this conversation with correct columns
        const { data: messages } = await supabase
          .from("messages")
          .select("message, created_at, sender_id, seen")
          .eq("conversation_id", sess.conversation_id)
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
        id: sess.conversation_id,
        anonymous_username: "Anonymous Owl",
        department: "Night Owl Mode",
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
    loadChats();
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

  // Floating Bottom Navigation Data
  const bottomNavItems = [
    { label: "Home", icon: "🏠", onClick: () => router.push("/"), isActive: false },
    { label: "Help Hub", icon: "🤝", onClick: () => router.push("/dashboard"), isActive: false },
    { label: "Chats", icon: "💬", onClick: () => router.push("/chat"), isActive: true, badge: totalUnreadCount },
    { label: "Sanctuary", icon: "🦉", onClick: () => router.push("/night-owl"), isActive: false },
    { label: "Profile", icon: "👤", onClick: () => router.push("/profile"), isActive: false },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-primary text-[#rgba(255,255,255,0.92)] px-4 pt-safe">
        <div className="mx-auto w-full max-w-2xl px-2 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-28 rounded-xl" />
              <Skeleton className="h-4 w-44 rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 pt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-3xl bg-brand-surface p-4 border border-brand-border animate-pulse">
                <Skeleton className="h-14 w-14 rounded-2xl shrink-0" variant="avatar" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-[75%] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-primary text-brand-text-primary pb-32 pt-safe">
      <div className="mx-auto w-full max-w-2xl px-4 md:px-6">
        
        {/* Cinematic Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-44 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-accent/8 via-transparent to-transparent pointer-events-none" />

        {/* Elegant Minimal Header */}
        <header className="sticky top-0 z-20 bg-brand-primary/90 backdrop-blur-md pt-6 pb-4 border-b border-brand-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white/95">
                My Chats
              </h1>
              <p className="mt-1 text-xs text-brand-text-secondary select-none">
                Your encrypted anonymous conversations
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-brand-surface border border-brand-border px-4 py-2.5 text-xs font-bold text-brand-accent transition hover:bg-brand-elevated cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>←</span> Help Hub
            </motion.button>
          </div>

          {/* Search bar */}
          <div className="mt-5">
            <PremiumInput
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4 opacity-50" />}
              className="py-3 px-5 rounded-2xl placeholder:text-white/20 focus:border-brand-accent/25"
            />
          </div>
        </header>

        {/* Chats feed list */}
        <section className="mt-5">
          <AnimatePresence mode="popLayout">
            {!featureToggles.chats ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="mt-12"
              >
                <EmptyState
                  icon="🔒"
                  title="Subsystem Restricted"
                  description="The secure private chat network is temporarily paused by administrators. Active chats remain fully encrypted and safe."
                />
              </motion.div>
            ) : filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="mt-12"
              >
                <EmptyState
                  icon="💬"
                  title="No conversations yet"
                  description="Offer assistance to other students or create a help request in the hub to initiate secure private chat sessions."
                  actionLabel="Explore Help Hub"
                  onActionClick={() => router.push("/dashboard")}
                />
              </motion.div>
            ) : (
              <motion.div 
                className="space-y-3"
                layout
              >
                {filteredConversations.map((chat, index) => (
                  <motion.button
                    key={chat.id}
                    layoutId={`chat-${chat.id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...premiumSpring, delay: index * 0.01 }}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="w-full rounded-[24px] border border-brand-border bg-brand-surface p-4 text-left transition duration-200 hover:border-brand-border hover:bg-brand-elevated/55 cursor-pointer block group shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar with dynamic online indicator */}
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-elevated border border-brand-border text-lg font-black text-brand-accent/90 shadow-inner select-none transition group-hover:scale-105">
                        {chat.anonymous_username.charAt(0).toUpperCase()}

                        {isUserActuallyOnline(chat.is_online, chat.last_seen) && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-brand-surface bg-green-500 shadow-sm animate-pulse-glow" />
                        )}
                      </div>

                      {/* Content block */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold text-white/95 group-hover:text-brand-accent transition duration-150">
                              {chat.anonymous_username}
                            </p>

                            <p className="mt-0.5 truncate text-[11px] font-medium tracking-wide text-brand-text-secondary select-none">
                              {chat.department}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-[10px] font-semibold text-brand-text-secondary">
                              {formatTime(chat.last_message_time)}
                            </span>

                            {chat.unread_count > 0 && (
                              <motion.span 
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-brand-accent px-2 text-[10px] font-black text-brand-primary shadow-lg shadow-brand-accent/20"
                              >
                                {chat.unread_count}
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Snippet message with bold weight for unread */}
                        <p
                          className={`mt-2.5 line-clamp-1 text-sm ${
                            chat.unread_count > 0
                              ? "font-semibold text-white"
                              : "text-brand-text-secondary/80"
                          }`}
                        >
                          {chat.last_message}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Floating Mobile Bottom Tab Nav */}
        <FloatingBottomNav items={bottomNavItems} />
      </div>
    </main>
  );
}