/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";
import { 
  FloatingBottomNav, 
  Skeleton 
} from "@/components/ui/PremiumUI";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { Search, ChevronUp, ChevronDown, MessageSquare, ShieldAlert } from "lucide-react";

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

const sweepSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.5,
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
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter conversations based on search query
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

  // Separate conversations into Active (Online) and Directory (All)
  const activeConversations = useMemo(() => {
    return filteredConversations.filter((chat) =>
      isUserActuallyOnline(chat.is_online, chat.last_seen)
    );
  }, [filteredConversations]);

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, cur) => acc + cur.unread_count, 0);
  }, [conversations]);

  // Load chat conversations from Supabase database
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

    // Fetch active help requests
    const { data: activeRequests, error } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(id, anonymous_username, department, is_online, last_seen), helper:profiles!helper_id(id, anonymous_username, department, is_online, last_seen)")
      .or(`requester_id.eq.${user.id},helper_id.eq.${user.id}`)
      .in("status", ["accepted", "solved"]);

    // Fetch active Night Owl sessions
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

    // Process Help Hub chats
    for (const req of activeRequests || []) {
      const otherProfile = req.requester_id === user.id ? req.helper : req.requester;
      if (!otherProfile) continue;

      let lastMsgText = "👋 Chat accepted. Start conversing!";
      let lastMsgTime = req.created_at;
      let unreadCount = 0;

      if (req.conversation_id) {
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

    // Process Night Owl chats
    for (const sess of activeNightSessions || []) {
      const otherProfile = sess.requester_id === user.id ? sess.accepter : sess.requester;
      if (!otherProfile) continue;

      let lastMsgText = "👋 Night Owl chat accepted. Start conversing!";
      let lastMsgTime = sess.created_at;
      let unreadCount = 0;

      if (sess.conversation_id) {
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

  // Lifecycle effects
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

  // Bottom Navigation tabs
  const bottomNavItems = [
    { label: "Home", icon: "🏠", onClick: () => router.push("/"), isActive: false },
    { label: "Help Hub", icon: "🤝", onClick: () => router.push("/dashboard"), isActive: false },
    { label: "Chats", icon: "💬", onClick: () => router.push("/chat"), isActive: true, badge: totalUnreadCount },
    { label: "Sanctuary", icon: "🦉", onClick: () => router.push("/night-owl"), isActive: false },
    { label: "Profile", icon: "👤", onClick: () => router.push("/profile"), isActive: false },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0E1621] text-white px-4 pt-safe flex items-center justify-center">
        <div className="w-full max-w-[440px] space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-28 rounded-xl" />
              <Skeleton className="h-4 w-44 rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 pt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-3xl bg-[#17212B] p-4 border border-white/[0.08] animate-pulse">
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
    <main className="min-h-screen bg-[#0E1621] text-white pb-32 pt-safe flex items-center justify-center select-none relative overflow-hidden">
      {/* Visual Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-44 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2AABEE]/8 via-transparent to-transparent pointer-events-none" />

      {/* Main Responsive Stacked List Container */}
      <div className="relative w-full max-w-[440px] h-[680px] bg-[#17212B]/75 backdrop-blur-[24px] rounded-[40px] border border-white/[0.08] flex flex-col overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]">
        
        {/* Header glows */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#2AABEE] to-transparent opacity-80" />

        {/* 1. Main Chat Card Interface */}
        <div className="flex flex-col h-full">
          <div className="p-8 pb-3">
            {/* Header branding */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5 uppercase">
                My Chats
                <span className="text-[10px] bg-[#2AABEE] px-2 py-0.5 rounded-full text-white font-black leading-none">
                  {activeConversations.length}
                </span>
              </h2>
              
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-bold text-[#2AABEE] px-4 py-2 transition cursor-pointer shadow-sm"
              >
                Help Hub
              </button>
            </div>

            {/* Premium Search box */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400/60 z-10 h-4.5 w-4.5" />
              <input
                type="text"
                placeholder="Search teammates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full pl-11 pr-4 bg-[#0E1621] border border-white/[0.08] focus:border-[#2AABEE]/45 focus:outline-none rounded-2xl text-sm text-white placeholder:text-gray-400/40 transition-all w-full box-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
              />
            </div>
          </div>

          {/* Active Chats feed listing */}
          <div className="flex-1 overflow-y-auto px-8 pb-24 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {!featureToggles.chats ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-12"
                >
                  <div className="text-center p-6 border border-white/[0.06] bg-[#0E1621]/40 rounded-3xl space-y-3">
                    <ShieldAlert className="h-10 w-10 text-[#FF4D4D] mx-auto animate-pulse" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Subsystem Restricted</h3>
                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                      The secure private chat network is temporarily paused by administrators. Active chats remain fully encrypted.
                    </p>
                  </div>
                </motion.div>
              ) : activeConversations.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-14 text-center space-y-4"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0E1621]/80 border border-white/[0.06] text-2xl select-none shadow-inner">
                    💬
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider leading-none">No active online chats</h3>
                    <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                      All classmates are offline. Check the conversation directory below to view all your chat logs.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                  className="space-y-2"
                >
                  {activeConversations.map((chat) => (
                    <motion.div
                      key={`active-${chat.id}`}
                      variants={{
                        hidden: { opacity: 0, x: 10, y: 15 },
                        visible: { opacity: 1, x: 0, y: 0 },
                      }}
                      transition={sweepSpring}
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      className="flex items-center group py-3 px-3 rounded-2xl border border-transparent hover:border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-all duration-200"
                    >
                      <div className="relative mr-4 shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#0E1621] border border-white/[0.08] text-base font-black text-[#2AABEE] shadow-inner select-none transition group-hover:scale-105">
                          {chat.anonymous_username.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#17212B] rounded-full flex items-center justify-center shadow-sm">
                          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse-glow" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white tracking-tight leading-none mb-1.5 truncate group-hover:text-[#2AABEE] transition-colors">
                          {chat.anonymous_username}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-semibold truncate">
                          {chat.last_message}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
                        <span className="text-[9px] font-semibold text-gray-500">
                          {formatTime(chat.last_message_time)}
                        </span>
                        {chat.unread_count > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2AABEE] px-1.5 text-[9px] font-black text-white shadow-lg shadow-[#2AABEE]/20">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 2. Premium Drawer Conversation Directory (All chats) */}
        <motion.div
          layout
          initial={false}
          animate={{
            height: isExpanded ? "calc(100% - 20px)" : "68px",
            width: isExpanded ? "calc(100% - 20px)" : "calc(100% - 40px)",
            bottom: isExpanded ? "10px" : "20px",
            left: isExpanded ? "10px" : "20px",
            borderRadius: isExpanded ? "32px" : "24px",
          }}
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 30,
            mass: 0.8,
          }}
          className="absolute z-50 overflow-hidden border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col group/bar bg-[#17212B]"
          style={{ cursor: isExpanded ? "default" : "pointer" }}
          onClick={() => !isExpanded && setIsExpanded(true)}
        >
          {/* Drawer Header */}
          <div
            className={`flex items-center justify-between px-4 h-[68px] shrink-0 transition-colors ${
              isExpanded ? "border-b border-white/[0.06] bg-[#0E1621]/20" : "hover:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0E1621] border border-white/[0.08] flex items-center justify-center text-[#2AABEE] shadow-inner transition-transform group-hover/bar:scale-105">
                <MessageSquare className="h-5 w-5" />
              </div>
              <motion.div layout="position">
                <h4 className="text-sm font-black text-white tracking-tight leading-none uppercase">
                  Conversation Directory
                </h4>
                <p className="text-[10px] font-bold leading-none text-gray-400 mt-1 select-none">
                  {filteredConversations.length} total channels active
                </p>
              </motion.div>
            </div>

            <div className="flex items-center gap-3">
              {!isExpanded && (
                <div className="flex items-center gap-2">
                  {/* Face avatars stack preview */}
                  <div className="flex -space-x-3 select-none">
                    {conversations.slice(0, 3).map((chat) => (
                      <div
                        key={`avatar-${chat.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0E1621] border border-[#17212B] text-[10px] font-black text-[#2AABEE] shadow-md z-1"
                      >
                        {chat.anonymous_username.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {conversations.length > 3 && (
                      <div className="w-8 h-8 rounded-full border border-[#17212B] bg-[#0E1621] flex items-center justify-center shadow-md relative z-0">
                        <span className="text-[9px] font-black leading-none text-gray-400">
                          +{conversations.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Expansion Indicator */}
                  <ChevronUp className="h-4.5 w-4.5 text-gray-500 shrink-0" />
                </div>
              )}

              {isExpanded && (
                <button
                  className="h-9 w-9 rounded-xl text-gray-400 hover:text-white transition-all flex items-center justify-center bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                >
                  <ChevronDown className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>

          {/* Directory Content List */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#17212B]">
            {/* Input inside expanded drawer */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="px-6 py-4"
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 z-10 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search directory..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-10 bg-[#0E1621] border border-white/[0.08] focus:border-[#2AABEE]/45 focus:outline-none rounded-xl text-xs text-white placeholder:text-gray-500 w-full box-border pl-10 pr-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 py-2 pb-10 no-scrollbar">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-10 text-gray-400/60 text-xs uppercase font-bold select-none tracking-wide">
                  No directory records found
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate={isExpanded ? "visible" : "hidden"}
                  variants={{
                    visible: {
                      transition: { staggerChildren: 0.03, delayChildren: 0.1 },
                    },
                    hidden: {
                      transition: { staggerChildren: 0.02, staggerDirection: -1 },
                    },
                  }}
                  className="space-y-2"
                >
                  {filteredConversations.map((chat) => {
                    const isOnline = isUserActuallyOnline(chat.is_online, chat.last_seen);
                    return (
                      <motion.div
                        key={`list-${chat.id}`}
                        variants={{
                          hidden: { opacity: 0, x: 10, y: 15 },
                          visible: { opacity: 1, x: 0, y: 0 },
                        }}
                        transition={sweepSpring}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/chat/${chat.id}`);
                        }}
                        className="flex items-center group py-3 px-3 rounded-2xl hover:bg-white/[0.02] border border-transparent hover:border-white/[0.04] cursor-pointer transition-all duration-200"
                      >
                        <div className="relative mr-4 shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#0E1621] border border-white/[0.08] text-base font-black text-[#2AABEE] shadow-inner select-none transition group-hover:scale-105">
                            {chat.anonymous_username.charAt(0).toUpperCase()}
                          </div>
                          {isOnline && (
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#17212B] rounded-full flex items-center justify-center shadow-sm">
                              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse-glow" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-white tracking-tight leading-none mb-1.5 truncate group-hover:text-[#2AABEE] transition-colors">
                            {chat.anonymous_username}
                          </h3>
                          <div className="flex items-center gap-1.5 select-none">
                            {isOnline && <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                            <p className={`text-[11px] font-semibold truncate ${isOnline ? "text-green-400" : "text-gray-400"}`}>
                              {isOnline ? "Online now" : chat.department}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
                          <span className="text-[9px] font-semibold text-gray-500">
                            {formatTime(chat.last_message_time)}
                          </span>
                          {chat.unread_count > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2AABEE] px-1.5 text-[9px] font-black text-white shadow-lg shadow-[#2AABEE]/20">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* 3. Floating Mobile Bottom Tab Navigation */}
        <FloatingBottomNav items={bottomNavItems} />
      </div>
    </main>
  );
}