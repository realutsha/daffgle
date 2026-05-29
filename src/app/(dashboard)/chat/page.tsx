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
import { Search, MessageSquare, ShieldAlert, Sparkles } from "lucide-react";

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
  stiffness: 400,
  damping: 30,
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
      <main className="min-h-screen bg-[#0E1621] text-white px-4 py-8 md:py-12 flex justify-center items-start">
        <div className="w-full max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-28 rounded-xl" />
              <Skeleton className="h-4 w-44 rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 pt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-[24px] bg-[#17212B] p-4 border border-white/[0.08] animate-pulse">
                <Skeleton className="h-12 w-12 rounded-[16px] shrink-0" variant="avatar" />
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
    <main className="min-h-screen bg-[#0E1621] text-white pb-36 pt-8 px-4 md:px-6 flex justify-center items-start relative overflow-hidden">
      {/* Premium Ambient Background Orb */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#39FF88]/4 blur-[130px] pointer-events-none" />

      {/* Main Wide Community Dashboard (up to 1400px maximum width) */}
      <div className="relative w-full max-w-7xl bg-[#17212B]/90 backdrop-blur-xl rounded-[32px] border border-white/[0.08] p-6 sm:p-8 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        
        {/* Soft upper gradient indicator */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#2AABEE]/40 to-transparent opacity-80" />

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3 uppercase select-none">
              My Chats
              <span className="text-xs bg-[#2AABEE] px-2.5 py-1 rounded-full text-white font-black leading-none shadow-[0_0_12px_rgba(42,171,238,0.25)]">
                {conversations.length} Active
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-1.5 select-none font-semibold">
              Encrypted, location-shielded communication logs
            </p>
          </div>
          
          <button
            onClick={() => router.push("/dashboard")}
            className="self-start sm:self-auto rounded-2xl bg-[#1D2733] border border-white/5 hover:border-[#39FF88]/20 hover:bg-[#17212B] text-xs font-bold text-[#39FF88] px-5 py-3 transition cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Go to Help Hub
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-gray-400/50 z-10 h-4.5 w-4.5" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 w-full pl-12 pr-4 bg-[#0E1621] border border-white/[0.08] focus:border-[#39FF88]/30 focus:shadow-[0_0_15px_rgba(57,255,136,0.06)] focus:outline-none rounded-2xl text-sm text-white placeholder:text-gray-400/30 transition-all box-border shadow-inner"
          />
        </div>

        {/* Two-Column Grid: Proportional spacing, avoids tall empty boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/[0.06] pt-8 min-h-[380px]">
          
          {/* COLUMN 1: ACTIVE CHATS (ONLINE PEERS) */}
          <div className="flex flex-col">
            <h3 className="text-xs font-black uppercase text-[#39FF88] tracking-widest select-none flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0 shadow-[0_0_8px_#22c55e]" />
              Active Online ({activeConversations.length})
            </h3>

            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-2 max-h-[500px]">
              <AnimatePresence mode="popLayout">
                {!featureToggles.chats ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center p-6 border border-white/5 bg-[#1D2733]/40 rounded-2xl space-y-3"
                  >
                    <ShieldAlert className="h-9 w-9 text-red-400 mx-auto animate-pulse" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Subsystem Restricted</h4>
                    <p className="text-[10px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                      The secure private chat network is temporarily paused.
                    </p>
                  </motion.div>
                ) : activeConversations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10 space-y-3 bg-[#0E1621]/30 rounded-2xl border border-white/[0.04] p-6 shadow-inner"
                  >
                    <div className="text-2xl select-none">💤</div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Online Classmates</h4>
                    <p className="text-[10px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                      All conversation logs are preserved. Browse the directory list on the right to read details offline.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.02 } } }}
                    className="space-y-2"
                  >
                    {activeConversations.map((chat) => (
                      <motion.div
                        key={`active-${chat.id}`}
                        variants={{
                          hidden: { opacity: 0, y: 6 },
                          visible: { opacity: 1, y: 0 },
                        }}
                        transition={sweepSpring}
                        onClick={() => router.push(`/chat/${chat.id}`)}
                        whileHover={{ y: -2, scale: 1.012 }}
                        className="flex items-center group py-3.5 px-4 rounded-2xl bg-[#0E1621]/45 border border-white/[0.04] hover:border-[#39FF88]/20 hover:bg-[#1D2733] cursor-pointer transition-all duration-200"
                      >
                        <div className="relative mr-4 shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#17212B] border border-white/[0.08] text-sm font-black text-[#2AABEE] shadow-inner select-none transition group-hover:scale-105">
                            {chat.anonymous_username.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#17212B] rounded-full flex items-center justify-center shadow-sm">
                            <div className="w-2 h-2 bg-[#39FF88] rounded-full animate-pulse shadow-[0_0_6px_#39FF88]" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-white tracking-tight leading-none mb-1.5 truncate group-hover:text-[#39FF88] transition-colors">
                            {chat.anonymous_username}
                          </h3>
                          <p className="text-[11px] text-gray-400 font-semibold truncate leading-none">
                            {chat.last_message}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
                          <span className="text-[9px] font-semibold text-gray-500 select-none">
                            {formatTime(chat.last_message_time)}
                          </span>
                          {chat.unread_count > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#39FF88] px-1.5 text-[9px] font-black text-black shadow-md shadow-[#39FF88]/20 animate-pulse">
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

          {/* COLUMN 2: CONVERSATION DIRECTORY (ALL CHATS) */}
          <div className="flex flex-col border-t md:border-t-0 md:border-l border-white/[0.06] pt-8 md:pt-0 md:pl-8">
            <h3 className="text-xs font-black uppercase text-[#2AABEE] tracking-widest select-none flex items-center gap-2 mb-4">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#2AABEE]" />
              Conversation Directory ({filteredConversations.length})
            </h3>

            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-2 max-h-[500px]">
              <AnimatePresence mode="popLayout">
                {filteredConversations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10 space-y-3 bg-[#0E1621]/30 rounded-2xl border border-white/[0.04] p-6 shadow-inner"
                  >
                    <div className="text-2xl select-none">🕊️</div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Records Found</h4>
                    <p className="text-[10px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                      Accept student helper requests or establish late-night Sanctuary matches to initiate secure chats.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.02 } } }}
                    className="space-y-2"
                  >
                    {filteredConversations.map((chat) => {
                      const isOnline = isUserActuallyOnline(chat.is_online, chat.last_seen);
                      return (
                        <motion.div
                          key={`dir-${chat.id}`}
                          variants={{
                            hidden: { opacity: 0, y: 6 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          transition={sweepSpring}
                          onClick={() => router.push(`/chat/${chat.id}`)}
                          whileHover={{ y: -2, scale: 1.012 }}
                          className="flex items-center group py-3.5 px-4 rounded-2xl bg-[#0E1621]/45 border border-white/[0.04] hover:border-[#39FF88]/20 hover:bg-[#1D2733] cursor-pointer transition-all duration-200"
                        >
                          <div className="relative mr-4 shrink-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#17212B] border border-white/[0.08] text-sm font-black text-[#2AABEE] shadow-inner select-none transition group-hover:scale-105">
                              {chat.anonymous_username.charAt(0).toUpperCase()}
                            </div>
                            {isOnline && (
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#17212B] rounded-full flex items-center justify-center shadow-sm">
                                <div className="w-2 h-2 bg-[#39FF88] rounded-full shadow-[0_0_6px_#39FF88]" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white tracking-tight leading-none mb-1.5 truncate group-hover:text-[#39FF88] transition-colors">
                              {chat.anonymous_username}
                            </h3>
                            <div className="flex items-center gap-1.5 select-none truncate">
                              {isOnline && <div className="w-1.5 h-1.5 bg-[#39FF88] rounded-full shadow-[0_0_4px_#39FF88]" />}
                              <p className={`text-[11px] font-semibold truncate ${isOnline ? "text-[#39FF88] font-bold" : "text-gray-400"}`}>
                                {isOnline ? "Online now" : chat.department}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
                            <span className="text-[9px] font-semibold text-gray-500 select-none">
                              {formatTime(chat.last_message_time)}
                            </span>
                            {chat.unread_count > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#39FF88] px-1.5 text-[9px] font-black text-black shadow-md shadow-[#39FF88]/20 animate-pulse">
                                {chat.unread_count}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Tab Navigation (Correctly positioned and responsive) */}
      <FloatingBottomNav items={bottomNavItems} />
    </main>
  );
}