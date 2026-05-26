"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { setupPushNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { isEmailAllowed } from "@/lib/validations/auth";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";
import { 
  PremiumCard, 
  PremiumButton, 
  PremiumInput, 
  PremiumSelect, 
  PremiumDialog, 
  FloatingBottomNav, 
  Skeleton, 
  EmptyState, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { Search, Plus, Sparkles, MessageSquare, AlertTriangle, ShieldCheck, Flame, RefreshCw } from "lucide-react";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  hall?: string;
  karma: number;
  warning_badge?: string | null;
  is_online: boolean;
  is_admin: boolean;
  is_banned: boolean;
};

type HelpRequest = {
  id: string;
  requester_id: string;
  title: string;
  description: string;
  status: 'open' | 'accepted' | 'solved' | 'cancelled';
  helper_id: string | null;
  hall: string;
  karma_priority: number;
  conversation_id?: string | null;
  created_at: string;
  updated_at: string;
  requester?: {
    anonymous_username: string;
    department: string;
    gender: string;
    karma: number;
    warning_badge?: string | null;
    is_online: boolean;
    last_seen: string;
  };
  helper?: {
    anonymous_username: string;
    department: string;
    gender: string;
    karma: number;
    warning_badge?: string | null;
    is_online: boolean;
    last_seen: string;
  };
};

const PREDEFINED_ITEMS = [
  { value: "Calculator", label: "Calculator" },
  { value: "Charger", label: "Charger" },
  { value: "Pen", label: "Pen" },
  { value: "Notebook", label: "Notebook" },
  { value: "Water Bottle", label: "Water Bottle" },
  { value: "Umbrella", label: "Umbrella" },
  { value: "Power Bank", label: "Power Bank" },
  { value: "Extension Cable", label: "Extension Cable" }
];

const REPORT_REASONS = [
  { value: "Fake helper", label: "Fake helper" },
  { value: "Did not help", label: "Did not help" },
  { value: "Abusive behavior", label: "Abusive behavior" },
  { value: "Harassment", label: "Harassment" },
  { value: "Spam", label: "Spam" },
  { value: "Suspicious activity", label: "Suspicious activity" }
];

function formatTimeAgo(date: string) {
  const now = Date.now();
  const past = new Date(date).getTime();
  const diffMs = now - past;
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function isUserActuallyOnline(isOnline: boolean | undefined, lastSeen: string | undefined) {
  if (!isOnline) return false;
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen).getTime();
  const now = Date.now();
  return now - lastSeenDate < 90000;
}

export default function HelpHubDashboardPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "my_requests" | "my_helpins">("available");
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Background Chats Unread Counter
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);

  // Reporting state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportTargetName, setReportTargetName] = useState("");
  const [reportRequestId, setReportRequestId] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // Help lists
  const [availableRequests, setAvailableRequests] = useState<HelpRequest[]>([]);
  const [myRequests, setMyRequests] = useState<HelpRequest[]>([]);
  const [myHelpins, setMyHelpins] = useState<HelpRequest[]>([]);

  // Stable callback handler for accepting requests
  const handleHelpNow = useCallback(async (request: HelpRequest | Record<string, any>) => {
    const requestItem = String(request.title || "");
    const requestId = String(request.id || "");

    const confirmHelp = window.confirm(`Accept request for "${requestItem}"? This will open a private, secure, and anonymous 1-on-1 chat.`);
    if (!confirmHelp) return;

    try {
      // 1. Insert conversation
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .insert({
          user_one: String(request.requester_id || ""),
          user_two: currentUserId
        })
        .select("id")
        .single();

      if (convError || !convData) {
        toast.error("Failed to create chat: " + (convError?.message || "Unknown error"));
        return;
      }

      // 2. Link helper to request
      const { error } = await supabase
        .from("help_requests")
        .update({
          status: "accepted",
          helper_id: currentUserId,
          conversation_id: convData.id
        })
        .eq("id", requestId);

      if (error) {
        toast.error(error.message);
        return;
      }

      // 3. Send greeting message
      await supabase.from("messages").insert({
        sender_id: currentUserId,
        conversation_id: convData.id,
        message: `👋 I accepted your request for "${requestItem}"! I'm ready to help you.`
      });

      // 4. Send background push notification to requester
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "request-accepted",
          targetUserId: String(request.requester_id || ""),
          conversationId: convData.id,
          item: requestItem
        })
      }).catch((err) => console.error("Failed to dispatch push accepts:", err));

      toast.success("Connected! Opening anonymous private chat room...");
      router.push(`/chat/${convData.id}`);
    } catch {
      toast.error("Failed to accept request.");
    }
  }, [currentUserId, router]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user || !isEmailAllowed(userData.user.email)) {
      if (userData.user) {
        await supabase.auth.signOut();
      }
      router.replace("/login?error=domain_restricted");
      return;
    }

    const myId = userData.user.id;
    setCurrentUserId(myId);

    // Sync presence & notifications
    await setupPushNotifications(myId).catch(() => {});
    await setUserOnline(myId);

    // Load unread chats count for bottom nav badge
    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("id")
      .neq("sender_id", myId)
      .eq("seen", false);
    setUnreadChatsCount(unreadMessages?.length || 0);

    // Fetch user profile using unified safe utility
    const { data: profileData } = await fetchProfileSafely(myId);

    if (profileData && profileData.is_banned) {
      await setUserOffline(myId);
      clearCachedProfile();
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    const complete = isProfileComplete(profileData);

    if (!complete || !profileData || !profileData.hall) {
      toast.error("Please complete your profile setup first!");
      router.replace("/auth/setup");
      return;
    }

    setProfile(profileData as Profile);

    // 1. Fetch available requests and sort by requester(karma) DESC, then created_at DESC
    const { data: availData, error: availError } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
      .eq("status", "open")
      .eq("hall", profileData.hall)
      .neq("requester_id", myId);

    console.log("[Help Hub Fetch Debug - Available Help]: count =", availData?.length, "error =", availError);

    const sortedAvail = (availData || []).sort((a, b) => {
      const karmaA = a.requester?.karma ?? 0;
      const karmaB = b.requester?.karma ?? 0;
      if (karmaB !== karmaA) {
        return karmaB - karmaA; // Higher karma first
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newest first
    });

    setAvailableRequests(sortedAvail);

    // 2. Fetch requests created by the user
    const { data: myReqData, error: myReqError } = await supabase
      .from("help_requests")
      .select("*, helper:profiles!helper_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
      .eq("requester_id", myId)
      .order("created_at", { ascending: false });

    console.log("[Help Hub Fetch Debug - My Requests]: count =", myReqData?.length, "error =", myReqError);

    setMyRequests(myReqData || []);

    // 3. Fetch requests accepted by the user as a helper
    const { data: myHelpData, error: myHelpError } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
      .eq("helper_id", myId)
      .order("created_at", { ascending: false });

    console.log("[Help Hub Fetch Debug - My Helping]: count =", myHelpData?.length, "error =", myHelpError);

    setMyHelpins(myHelpData || []);

    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    let userId = "";
    let interval: NodeJS.Timeout;

    const setupPresence = async () => {
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

      userId = user.id;
      setCurrentUserId(user.id);

      await setUserOnline(user.id);
      await loadData();

      // Refresh every 30 seconds
      interval = setInterval(async () => {
        await setUserOnline(user.id);
        await loadData(true);
      }, 30000);
    };

    const handleVisibilityChange = async () => {
      if (!userId) return;

      if (document.hidden) {
        await setUserOffline(userId);
      } else {
        await setUserOnline(userId);
        await loadData(true);
      }
    };

    setupPresence();

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (userId) {
        setUserOffline(userId);
      }
    };
  }, [loadData, router]);

  // Realtime subscription for same-hall requests alert toast notifications & dashboard updates
  useEffect(() => {
    if (!profile?.hall || !currentUserId) return;

    console.log("[Help Hub Realtime Listener Debug]: Initializing subscription for hall =", profile.hall);

    const alertChannel = supabase
      .channel("same-hall-alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_requests",
        },
        async (payload) => {
          console.log("[Help Hub Realtime Listener Debug]: Received event payload =", payload);
          await loadData(true);
          console.log("[Help Hub Realtime Listener Debug]: State auto-refreshed successfully.");

          if (payload.eventType === "INSERT") {
            const newReq = payload.new as Record<string, any>;
            if (
              newReq &&
              newReq.hall === profile.hall &&
              newReq.requester_id !== currentUserId &&
              newReq.status === "open"
            ) {
              const { data: reqProfile } = await supabase
                .from("profiles")
                .select("anonymous_username")
                .eq("id", String(newReq.requester_id || ""))
                .single();

              const name = reqProfile?.anonymous_username || "Someone";
              toast.info(`🔔 New request: "${newReq.title}" from @${name} in ${newReq.hall}!`, {
                duration: 10000,
                action: {
                  label: "Accept",
                  onClick: () => {
                    handleHelpNow(newReq);
                  }
                }
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[Help Hub Realtime Listener Debug]: Subscription status =", status);
      });

    return () => {
      console.log("[Help Hub Realtime Listener Debug]: Cleaning up and unsubscribing same-hall-alerts");
      supabase.removeChannel(alertChannel);
    };
  }, [profile?.hall, currentUserId, loadData, handleHelpNow]);

  const handleRefresh = async () => {
    await loadData();
    toast.success("Help Hub synced in realtime!");
  };

  const handleCreateRequest = async () => {
    if (!selectedItem) {
      toast.error("Please select an item.");
      return;
    }

    if (!profile || !profile.hall) {
      console.error("[Help Hub Create Request Error]: Profile or profile.hall is null.", profile);
      toast.error("Please complete your profile to verify your residence hall first.");
      return;
    }

    try {
      setSubmitting(true);

      const { data: authUserResult, error: authUserError } = await supabase.auth.getUser();
      const authenticatedUserId = authUserResult?.user?.id;

      if (authUserError || !authenticatedUserId) {
        console.error("[Help Hub Create Request Error]: Authenticated user ID not verified.", authUserError);
        toast.error("Failed to verify user session. Please log in again.");
        return;
      }

      const payload = [
        {
          requester_id: authenticatedUserId,
          hall: profile.hall,
          title: selectedItem,
          description: `A verified student in ${profile.hall} needs a ${selectedItem.toLowerCase()}.`,
          status: "open"
        }
      ];

      console.log("INSERT PAYLOAD", payload);

      const { data, error } = await supabase
        .from("help_requests")
        .insert(payload);

      console.log("INSERT RESULT", data);
      console.log("INSERT ERROR", error);

      if (error) {
        console.error("[Help Hub] Supabase insert error:", error);
        toast.error("Failed to submit request: " + (error.message || "Unknown Supabase database error"));
        return;
      }

      toast.success("Help request broadcasted to your hall!");
      setShowCreateModal(false);
      setSelectedItem("");

      // Immediately refetch: Available Help, My Requests after successful insert
      const { data: myReqData } = await supabase
        .from("help_requests")
        .select("*, helper:profiles!helper_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
        .eq("requester_id", authenticatedUserId)
        .order("created_at", { ascending: false });

      if (myReqData) {
        setMyRequests(myReqData);
      }

      const { data: availData } = await supabase
        .from("help_requests")
        .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
        .eq("status", "open")
        .eq("hall", profile.hall)
        .neq("requester_id", authenticatedUserId);

      if (availData) {
        const sortedAvail = (availData || []).sort((a, b) => {
          const karmaA = a.requester?.karma ?? 0;
          const karmaB = b.requester?.karma ?? 0;
          if (karmaB !== karmaA) {
            return karmaB - karmaA;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setAvailableRequests(sortedAvail);
      }

      // Broadcast background push notification to same-hall students
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "same-hall-request",
          hall: profile.hall,
          itemId: selectedItem,
          requesterId: authenticatedUserId
        })
      }).catch((err) => console.error("Failed to dispatch push:", err));

      await loadData(true);
    } catch (err) {
      console.error("[Help Hub] Unexpected catch error:", err);
      toast.error("Failed to create help request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    const confirmCancel = window.confirm("Are you sure you want to cancel this request?");
    if (!confirmCancel) return;

    try {
      const { error } = await supabase
        .from("help_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Request cancelled.");
      await loadData();
    } catch {
      toast.error("Operation failed.");
    }
  };

  const handleMarkSolved = async (requestId: string) => {
    try {
      const req = myRequests.find((r) => r.id === requestId);

      const { error } = await supabase
        .from("help_requests")
        .update({ status: "solved" })
        .eq("id", requestId);

      if (error) {
        toast.error(error.message);
        return;
      }

      if (req?.helper_id) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "karma-completed",
            targetUserId: req.helper_id,
            item: req.title
          })
        }).catch((err) => console.error("Failed to dispatch push solves:", err));
      }

      toast.success("Request marked as solved! Helper awarded +1 Karma.");
      await loadData();
    } catch {
      toast.error("Operation failed.");
    }
  };

  const openReportModal = (targetId: string, targetName: string, requestId: string) => {
    setReportTargetId(targetId);
    setReportTargetName(targetName);
    setReportRequestId(requestId);
    setReportReason("");
    setReportDetails("");
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason) {
      toast.error("Please select a reason for reporting.");
      return;
    }

    try {
      setSubmittingReport(true);

      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_id: reportTargetId,
        reason: reportReason,
        details: reportDetails || null,
        request_id: reportRequestId || null,
        status: "pending"
      });

      if (error) {
        toast.error("Report failed to submit: " + error.message);
        return;
      }

      toast.success(`Report submitted! Admin will audit @${reportTargetName} shortly.`);
      setShowReportModal(false);
      await loadData();
    } catch {
      toast.error("An error occurred while submitting the report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Floating Bottom Navigation Data
  const bottomNavItems = [
    { label: "Home", icon: "🏠", onClick: () => router.push("/"), isActive: false },
    { label: "Help Hub", icon: "🤝", onClick: () => setActiveTab("available"), isActive: true },
    { label: "Chats", icon: "💬", onClick: () => router.push("/chat"), isActive: false, badge: unreadChatsCount },
    { label: "Sanctuary", icon: "🦉", onClick: () => router.push("/night-owl"), isActive: false },
    { label: "Profile", icon: "👤", onClick: () => router.push("/profile"), isActive: false },
  ];

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#111111] text-white px-5 pt-safe">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="h-32 rounded-3xl w-full" variant="card" />
          <p className="text-center text-sm text-brand-text-secondary font-medium animate-pulse">
            Syncing Daffgle Networks...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#111111] text-brand-text-primary pt-safe">
      
      {/* Desktop Left Sidebar Panel */}
      <aside className="hidden w-full flex-col bg-[#1A1A1A] md:flex md:w-96 md:border-r md:border-white/5 relative">
        <div className="absolute top-0 left-0 right-0 h-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C9D7F2]/5 via-transparent to-transparent pointer-events-none" />

        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1A1A1A]/95 px-6 py-5 backdrop-blur-md">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white/95">
                  Daffgle Help Hub
                </h1>
                <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mt-1 select-none">
                  Campus Assistance Feed
                </p>
              </div>

              <PremiumButton
                onClick={handleRefresh}
                disabled={refreshing}
                variant="accent"
                className="py-1.5 px-3 rounded-xl text-xs shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              </PremiumButton>
            </div>

            {/* Profile Brief */}
            {profile && (
              <div className="rounded-[20px] border border-white/5 bg-brand-surface p-4 shadow-lg shadow-black/10 select-none">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-elevated border border-white/5 text-lg font-black text-[#C9D7F2] relative">
                    {profile.anonymous_username.charAt(0).toUpperCase()}
                    {profile.warning_badge && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white animate-pulse">
                        ⚠️
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-bold text-white/90">
                        {profile.anonymous_username}
                      </p>
                      {profile.warning_badge && (
                        <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[8px] font-bold text-red-400 uppercase tracking-wide shrink-0">
                          ⚠️ Suspect
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-brand-text-secondary">
                      {profile.department} • {profile.hall} • <span className="text-[#C9D7F2] font-black">{profile.karma} Karma</span>
                    </p>
                  </div>

                  <div className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[9px] font-bold text-green-400 shrink-0 select-none">
                    ● Online
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <PremiumButton
                onClick={() => setActiveTab("available")}
                variant={activeTab === "available" ? "primary" : "secondary"}
                className="py-2.5 text-xs font-bold rounded-xl"
              >
                Help Hub
              </PremiumButton>

              <PremiumButton
                onClick={() => router.push("/chat")}
                variant="secondary"
                className="py-2.5 text-xs font-bold rounded-xl"
              >
                My Chats
              </PremiumButton>
            </div>

            <PremiumButton
              onClick={() => router.push("/night-owl")}
              variant="accent"
              className="py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              🦉 Night Owl sanctuary
            </PremiumButton>
          </div>
        </header>

        {/* Sidebar Left available Requests list */}
        <section className="flex-1 overflow-y-auto px-5 pt-4 pb-24">
          <div className="mb-4 flex items-center justify-between select-none">
            <div>
              <h2 className="text-sm font-bold text-white/90">Open Requests Feed</h2>
              <p className="text-[10px] text-brand-text-secondary font-medium mt-0.5">
                Students needing help in {profile?.hall}
              </p>
            </div>

            <span className="rounded-full bg-[#111111] px-2.5 py-0.5 text-[10px] font-black text-brand-accent border border-white/5 shadow-inner">
              {availableRequests.length} active
            </span>
          </div>

          <div className="space-y-3">
            {availableRequests.length > 0 ? (
              availableRequests.map((req) => (
                <PremiumCard
                  key={req.id}
                  hoverable
                  className="p-4 space-y-3 border-white/5 bg-brand-surface shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-elevated border border-white/5 text-lg font-black text-white relative">
                      📦
                      {req.requester?.warning_badge && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white animate-pulse">
                          ⚠️
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 select-none">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="text-[10px] font-bold text-brand-accent uppercase tracking-wider truncate">
                            @{req.requester?.anonymous_username}
                          </p>
                        </div>
                        <span className="text-[9px] font-medium text-brand-text-secondary shrink-0">
                          {formatTimeAgo(req.created_at)}
                        </span>
                      </div>

                      <h3 className="mt-1 font-bold text-white text-sm truncate">
                        {req.title}
                      </h3>

                      <p className="mt-0.5 text-[10px] font-medium text-brand-text-secondary select-none">
                        Karma rating: <span className="text-[#C9D7F2] font-black">{req.requester?.karma ?? 0}</span>
                      </p>

                      <div className="mt-3.5 flex gap-2">
                        <PremiumButton
                          onClick={() => handleHelpNow(req)}
                          variant="primary"
                          className="flex-1 py-1.5 px-3 rounded-xl text-[10px] font-bold"
                        >
                          Help Now
                        </PremiumButton>
                        
                        <PremiumButton
                          onClick={() => openReportModal(req.requester_id, req.requester?.anonymous_username || "User", req.id)}
                          variant="danger"
                          className="py-1.5 px-2.5 rounded-xl text-[10px]"
                        >
                          Report
                        </PremiumButton>
                      </div>
                    </div>
                  </div>
                </PremiumCard>
              ))
            ) : (
              <div className="mt-8">
                <EmptyState
                  icon="🙌"
                  title="Feed is clear"
                  description={`All student requests inside ${profile?.hall || "your hall"} have been solved successfully!`}
                />
              </div>
            )}
          </div>
        </section>
      </aside>

      {/* Main Right panel containing Feeds & Tabs */}
      <section className="flex flex-1 flex-col bg-[#111111] overflow-x-hidden w-full pb-safe">
        <div className="absolute top-0 left-0 right-0 h-44 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C9D7F2]/5 via-transparent to-transparent pointer-events-none" />

        {/* Dynamic header navbar tabs */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-[#111111]/90 backdrop-blur-md px-4 md:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            
            {/* Filter pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth p-1 bg-brand-surface rounded-2xl border border-white/5 max-w-fit shadow-inner">
              <button
                onClick={() => setActiveTab("available")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer select-none ${
                  activeTab === "available" ? "bg-brand-accent text-brand-primary font-black shadow-md shadow-brand-accent/15" : "text-brand-text-secondary hover:text-white"
                }`}
              >
                Available Help
              </button>

              <button
                onClick={() => setActiveTab("my_requests")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer select-none ${
                  activeTab === "my_requests" ? "bg-brand-accent text-brand-primary font-black shadow-md shadow-brand-accent/15" : "text-brand-text-secondary hover:text-white"
                }`}
              >
                My Requests ({myRequests.length})
              </button>

              <button
                onClick={() => setActiveTab("my_helpins")}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer select-none ${
                  activeTab === "my_helpins" ? "bg-brand-accent text-brand-primary font-black shadow-md shadow-brand-accent/15" : "text-brand-text-secondary hover:text-white"
                }`}
              >
                My Helpins ({myHelpins.length})
              </button>
            </div>

            <PremiumButton
              onClick={() => setShowCreateModal(true)}
              variant="accent"
              className="py-3 px-4 text-xs font-bold rounded-2xl self-start sm:self-auto shadow-md"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Help Request
            </PremiumButton>
          </div>
        </header>

        {/* Scrollable feed panels */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
          <div className="mx-auto max-w-3xl">
            <AnimatePresence mode="wait">
              
              {/* Tab: Available Help Feed */}
              {activeTab === "available" && (
                <motion.div
                  key="avail-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="space-y-6"
                >
                  <div className="select-none">
                    <h2 className="text-2xl font-black text-white/95 flex items-center gap-2">
                      Help Requests in {profile?.hall} <Flame className="h-5 w-5 text-brand-accent" />
                    </h2>
                    <p className="mt-1.5 text-brand-text-secondary text-xs leading-relaxed">
                      Encrypted peer-to-peer assistance feed. Restricted to verified residents in <span className="text-white font-semibold">{profile?.hall}</span> at database level. Sorted automatically byhelper Karma.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {availableRequests.length > 0 ? (
                      availableRequests.map((req) => (
                        <PremiumCard
                          key={req.id}
                          className="flex flex-col justify-between p-6 border-white/5 bg-brand-surface shadow-xl"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center justify-between select-none">
                              <span className="rounded-full bg-[#111111] border border-white/5 px-2.5 py-0.5 text-[9px] font-black text-brand-accent tracking-widest uppercase">
                                I Need help
                              </span>
                              <span className="text-[10px] font-medium text-brand-text-secondary">{formatTimeAgo(req.created_at)}</span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 select-none">
                                <p className="text-[11px] font-bold text-brand-text-secondary truncate">
                                  Broadcasted by @{req.requester?.anonymous_username}
                                </p>
                                {req.requester?.warning_badge && (
                                  <span className="rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.2 text-[7px] font-black text-red-400 uppercase tracking-wider shrink-0 animate-pulse">
                                    ⚠️ Suspect
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-3 select-none text-[10px] text-brand-text-secondary font-medium">
                                <span>Karma rating: <span className="text-brand-accent font-bold">{req.requester?.karma ?? 0}</span></span>
                                <span>Dept: <span className="text-white font-semibold">{req.requester?.department}</span></span>
                              </div>
                            </div>

                            <h3 className="text-lg font-bold text-white">{req.title}</h3>
                            <p className="text-xs text-brand-text-secondary leading-relaxed">
                              A verified DIU student residing in <span className="text-white/80 font-medium">{req.hall}</span> requires a {req.title.toLowerCase()} inside campus grounds.
                            </p>
                          </div>

                          <div className="flex gap-2 pt-5">
                            <PremiumButton
                              onClick={() => handleHelpNow(req)}
                              variant="primary"
                              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold"
                            >
                              Help Now
                            </PremiumButton>
                            
                            <PremiumButton
                              onClick={() => openReportModal(req.requester_id, req.requester?.anonymous_username || "User", req.id)}
                              variant="danger"
                              className="py-2.5 px-3 rounded-xl text-xs font-bold"
                            >
                              Report
                            </PremiumButton>
                          </div>
                        </PremiumCard>
                      ))
                    ) : (
                      <div className="col-span-2 mt-4">
                        <EmptyState
                          icon="🕊️"
                          title="No active requests"
                          description={`All help requests inside ${profile?.hall} have been solved successfully. Check back shortly or share a request.`}
                          actionLabel="Broadcast request"
                          onActionClick={() => setShowCreateModal(true)}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Tab: My Requests Feed */}
              {activeTab === "my_requests" && (
                <motion.div
                  key="my-req-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="space-y-6"
                >
                  <div className="select-none">
                    <h2 className="text-2xl font-black text-white/95">My Help Requests</h2>
                    <p className="mt-1.5 text-brand-text-secondary text-xs">
                      Manage help requests created by you. Cancel open requests if no longer needed, or mark accepted items as solved to reward your helper.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {myRequests.length > 0 ? (
                      myRequests.map((req) => (
                        <PremiumCard
                          key={req.id}
                          className="p-6 border-white/5 bg-brand-surface shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold text-white">{req.title}</h3>
                              <span className={`rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider select-none ${
                                req.status === "open" ? "bg-green-500/10 text-green-400 border border-green-500/15" :
                                req.status === "accepted" ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/15 animate-pulse" :
                                req.status === "solved" ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" :
                                "bg-gray-500/10 text-gray-400 border border-white/5"
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            
                            <p className="text-[10px] font-semibold text-brand-text-secondary uppercase select-none">
                              Created: {new Date(req.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>

                            {req.status === "accepted" && req.helper && (
                              <div className="flex items-center gap-1.5 select-none text-[11px] text-green-400 font-bold bg-green-500/5 border border-green-500/10 rounded-lg px-2.5 py-1 max-w-fit">
                                🤝 Helper @{req.helper.anonymous_username} ({req.helper.department})
                                {req.helper.warning_badge && (
                                  <span className="rounded-full bg-red-500/15 border border-red-500/20 px-1 py-0.2 text-[8px] font-bold text-red-400 uppercase">
                                    ⚠️ Suspect
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 shrink-0 self-start sm:self-auto">
                            {req.status === "open" && (
                              <PremiumButton
                                onClick={() => handleCancelRequest(req.id)}
                                variant="danger"
                                className="py-2 px-3 text-xs rounded-xl"
                              >
                                Cancel Request
                              </PremiumButton>
                            )}

                            {req.status === "accepted" && (
                              <>
                                <PremiumButton
                                  onClick={() => router.push(`/chat/${req.conversation_id}`)}
                                  variant="primary"
                                  className="py-2 px-3 text-xs rounded-xl font-bold"
                                >
                                  Open Chat
                                </PremiumButton>
                                <PremiumButton
                                  onClick={() => handleMarkSolved(req.id)}
                                  variant="accent"
                                  className="py-2 px-3 text-xs rounded-xl font-bold"
                                >
                                  Solved
                                </PremiumButton>
                              </>
                            )}
                            
                            {(req.status === "solved" || req.status === "cancelled") && (
                              <span className="text-[11px] text-brand-text-secondary italic font-semibold px-3 py-1.5 bg-[#111111] rounded-xl border border-white/5 select-none uppercase tracking-widest shadow-inner">
                                Archived
                              </span>
                            )}
                          </div>
                        </PremiumCard>
                      ))
                    ) : (
                      <EmptyState
                        icon="📝"
                        title="No requests created"
                        description="You have not requested assistance yet. Need a classroom charger or calculator? Broadcast a request."
                        actionLabel="Create Request"
                        onActionClick={() => setShowCreateModal(true)}
                      />
                    )}
                  </div>
                </motion.div>
              )}

              {/* Tab: My Helpin's Feed */}
              {activeTab === "my_helpins" && (
                <motion.div
                  key="my-help-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="space-y-6"
                >
                  <div className="select-none">
                    <h2 className="text-2xl font-black text-white/95">My Helping Actions</h2>
                    <p className="mt-1.5 text-brand-text-secondary text-xs">
                      Track campus help requests accepted by you. Keep chats open, friendly, and respectful to guide your classmates safely.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {myHelpins.length > 0 ? (
                      myHelpins.map((req) => (
                        <PremiumCard
                          key={req.id}
                          className="p-6 border-white/5 bg-brand-surface shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <h3 className="text-lg font-bold text-white">{req.title}</h3>
                            
                            <div className="flex flex-wrap items-center gap-1.5 select-none text-xs text-brand-text-secondary font-medium">
                              <span>Requested by: @{req.requester?.anonymous_username} ({req.requester?.department})</span>
                              {req.requester?.warning_badge && (
                                <span className="rounded-full bg-red-500/15 border border-red-500/20 px-1 py-0.2 text-[8px] font-bold text-red-400 uppercase">
                                  ⚠️ Suspect
                                </span>
                              )}
                            </div>
                            
                            <p className="text-[10px] font-bold text-brand-text-secondary uppercase select-none">
                              Status: <span className="text-white font-black">{req.status}</span>
                            </p>
                          </div>

                          <div className="flex gap-2 shrink-0 self-start sm:self-auto">
                            {req.status === "accepted" && (
                              <PremiumButton
                                 onClick={() => router.push(`/chat/${req.conversation_id}`)}
                                 variant="primary"
                                 className="py-2 px-3 text-xs rounded-xl font-bold"
                              >
                                Open Chat
                              </PremiumButton>
                            )}
                            
                            {req.status === "solved" && (
                              <span className="text-[10px] text-green-400 font-bold px-3 py-1.5 flex items-center gap-1 bg-green-500/5 border border-green-500/10 rounded-xl select-none uppercase tracking-wider">
                                ✓ Solved successfully
                              </span>
                            )}
                            
                            {req.status === "cancelled" && (
                              <span className="text-[10px] text-brand-text-secondary italic px-3 py-1.5 bg-[#111111] rounded-xl border border-white/5 select-none uppercase tracking-wider">
                                Cancelled by requester
                              </span>
                            )}
                          </div>
                        </PremiumCard>
                      ))
                    ) : (
                      <EmptyState
                        icon="🤝"
                        title="No active commitments"
                        description="You haven't accepted any open student requests in your hall yet. Browse the Help Feed and connect with classmates."
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Floating Bottom Navigation Bar (Mobile only) */}
      <FloatingBottomNav items={bottomNavItems} />

      {/* Premium Create Request modal */}
      <PremiumDialog
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedItem("");
        }}
        title="Broadcast Help Request"
        description={`File an anonymous, location-bounded help request visible exclusively to verified students inside ${profile?.hall}.`}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-brand-surface p-4 border border-white/5 select-none">
            <span className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest block mb-1">
              Required Request Action
            </span>
            <span className="text-base font-black text-white flex items-center gap-1.5">
              📦 Student Needs Item Assistance
            </span>
          </div>

          <PremiumSelect
            label="Select Needed Item"
            value={selectedItem}
            onChange={setSelectedItem}
            options={PREDEFINED_ITEMS}
            placeholder="Select a campus item..."
          />

          {selectedItem && profile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-brand-accent/20 bg-brand-accent/5 p-4 space-y-1 select-none"
            >
              <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">
                Request Preview Broadcast
              </p>
              <p className="text-xs font-semibold text-white/90 italic leading-relaxed">
                &quot;A student residing in {profile.hall} needs a {selectedItem.toLowerCase()} inside campus grounds.&quot;
              </p>
            </motion.div>
          )}

          <div className="flex gap-3 pt-2">
            <PremiumButton
              onClick={() => {
                setShowCreateModal(false);
                setSelectedItem("");
              }}
              variant="secondary"
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </PremiumButton>

            <PremiumButton
              onClick={handleCreateRequest}
              disabled={submitting || !selectedItem}
              variant="primary"
              className="flex-1 font-bold"
            >
              {submitting ? "Broadcasting..." : "Publish Broadcast"}
            </PremiumButton>
          </div>
        </div>
      </PremiumDialog>

      {/* Premium Report User dialog */}
      <PremiumDialog
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTargetId("");
          setReportTargetName("");
          setReportRequestId("");
        }}
        title="Report Student"
        description={`Submit a secure moderation audit on student @${reportTargetName} regarding spam, harassment, or suspicious activities.`}
      >
        <div className="space-y-4">
          <PremiumSelect
            label="Reason for Audit"
            value={reportReason}
            onChange={setReportReason}
            options={REPORT_REASONS}
            placeholder="Choose a violation category..."
          />

          <div className="space-y-1.5 flex flex-col">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest ml-1 select-none font-sans">
              Provide Context & Audit details
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Provide chat contexts, malicious helper actions, or general details regarding the incident..."
              rows={4}
              className="w-full rounded-2xl border border-white/5 bg-[#111111] px-4 py-3 text-white outline-none focus:border-red-400 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <PremiumButton
              onClick={() => {
                setShowReportModal(false);
                setReportTargetId("");
                setReportTargetName("");
                setReportRequestId("");
              }}
              variant="secondary"
              className="flex-1"
              disabled={submittingReport}
            >
              Cancel
            </PremiumButton>

            <PremiumButton
              onClick={handleSubmitReport}
              disabled={submittingReport || !reportReason}
              variant="danger"
              className="flex-1"
            >
              {submittingReport ? "Submitting..." : "Submit Report"}
            </PremiumButton>
          </div>
        </div>
      </PremiumDialog>
    </main>
  );
}