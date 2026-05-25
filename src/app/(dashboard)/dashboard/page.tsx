"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { setupPushNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { isEmailAllowed } from "@/lib/validations/auth";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";

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
  item: string;
  action: string;
  status: 'open' | 'accepted' | 'solved' | 'cancelled';
  helper_id: string | null;
  requester_hall: string;
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
  "Calculator",
  "Charger",
  "Pen",
  "Notebook",
  "Water Bottle",
  "Umbrella",
  "Power Bank",
  "Extension Cable"
];

const REPORT_REASONS = [
  "Fake helper",
  "Did not help",
  "Abusive behavior",
  "Harassment",
  "Spam",
  "Suspicious activity"
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
  const handleHelpNow = useCallback(async (request: HelpRequest | Record<string, unknown>) => {
    const requestItem = String(request.item || "");
    const requestId = String(request.id || "");

    const confirmHelp = window.confirm(`Accept request for "${requestItem}"? This will open a private, secure, and anonymous 1-on-1 chat.`);
    if (!confirmHelp) return;

    try {
      // 1. Insert conversation
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .insert({})
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

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch available requests and sort by requester(karma) DESC, then created_at DESC
    const { data: availData } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
      .eq("status", "open")
      .eq("requester_hall", profileData.hall)
      .neq("requester_id", myId)
      .gt("created_at", yesterday);

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
    const { data: myReqData } = await supabase
      .from("help_requests")
      .select("*, helper:profiles!helper_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
      .eq("requester_id", myId)
      .order("created_at", { ascending: false });

    setMyRequests(myReqData || []);

    // 3. Fetch requests accepted by the user as a helper
    const { data: myHelpData } = await supabase
      .from("help_requests")
      .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
      .eq("helper_id", myId)
      .order("created_at", { ascending: false });

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

  // Realtime subscription for same-hall requests alert toast notifications
  useEffect(() => {
    if (!profile?.hall || !currentUserId) return;

    const alertChannel = supabase
      .channel("same-hall-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "help_requests",
        },
        async (payload) => {
          const newReq = payload.new as Record<string, unknown>;
          if (
            newReq &&
            newReq.requester_hall === profile.hall &&
            newReq.requester_id !== currentUserId &&
            newReq.status === "open"
          ) {
            // Fetch requester username for toast info
            const { data: reqProfile } = await supabase
              .from("profiles")
              .select("anonymous_username")
              .eq("id", String(newReq.requester_id || ""))
              .single();

            const name = reqProfile?.anonymous_username || "Someone";
            toast.info(`🔔 New request: "${newReq.item}" from @${name} in ${newReq.requester_hall}!`, {
              duration: 10000,
              action: {
                label: "Accept",
                onClick: () => {
                  handleHelpNow(newReq);
                }
              }
            });

            await loadData(true);
          }
        }
      )
      .subscribe();

    return () => {
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

    if (!profile || !profile.hall) return;

    try {
      setSubmitting(true);

      const { error } = await supabase.from("help_requests").insert({
        requester_id: currentUserId,
        item: selectedItem,
        action: "I Need",
        requester_hall: profile.hall,
        status: "open"
      });

      if (error) {
        if (error.message.includes("cooldown")) {
          toast.error("Hourly limit exceeded: Max 3 open help requests per hour.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Broadcast background push notification to same-hall students
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "same-hall-request",
          hall: profile.hall,
          itemId: selectedItem,
          requesterId: currentUserId
        })
      }).catch((err) => console.error("Failed to dispatch push:", err));

      toast.success("Help request broadcasted to your hall!");
      setShowCreateModal(false);
      setSelectedItem("");
      await loadData();
    } catch {
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
            item: req.item
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

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#0E1621] text-white">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5">
          <div className="rounded-4xl border border-[#22303D] bg-[#17212B]/95 p-6 shadow-xl shadow-black/20 animate-pulse">
            <div className="flex items-center justify-between gap-4">
              <div className="h-10 w-28 rounded-full bg-[#2AABEE]/20" />
              <div className="h-10 w-24 rounded-full bg-[#2AABEE]/10" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-4 w-3/4 rounded-full bg-[#2AABEE]/10" />
              <div className="h-4 rounded-full bg-[#2AABEE]/08" />
            </div>
          </div>
          <p className="text-center text-sm text-gray-400 font-medium">Syncing Daffgle Network...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#0E1621] text-white">
      {/* Desktop Sidebar Panel */}
      <aside className="hidden w-full flex-col bg-[#17212B] md:flex md:w-107.5 md:border-r md:border-[#22303D]">
        <header className="sticky top-0 z-30 border-b border-[#22303D] bg-[#17212B]/95 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-4 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#2AABEE]">
                Daffgle Help Hub
              </h1>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
                Campus Assistance
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-2xl bg-[#2B5278] px-4 py-2 text-xs font-bold transition hover:scale-[1.02] hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {refreshing ? "Syncing..." : "Sync"}
            </button>
          </div>

          {/* User Profile Summary */}
          {profile && (
            <div className="mt-4 rounded-3xl border border-[#22303D] bg-[#0F1A24] p-4 shadow-xl shadow-black/10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2B5278] text-lg font-black relative">
                  {profile.anonymous_username.charAt(0).toUpperCase()}
                  {profile.warning_badge && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-655 text-[9px] font-black text-white animate-pulse">
                      ⚠️
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-bold">
                      {profile.anonymous_username}
                    </p>
                    {profile.warning_badge && (
                      <span className="rounded-full bg-red-600/10 border border-red-500/20 px-2.5 py-0.5 text-[8px] font-bold text-red-400 tracking-wide uppercase shrink-0 animate-pulse">
                        ⚠️ Suspect
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-400">
                    {profile.department} • {profile.hall} • <span className="text-[#2AABEE] font-bold">{profile.karma} Karma</span>
                  </p>
                </div>

                <div className="rounded-full bg-green-500/10 px-3 py-1 text-[11px] font-bold text-green-400 shrink-0">
                  ● Online
                </div>
              </div>
            </div>
          )}

          {/* Navigation Options */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("available")}
              className={`rounded-2xl py-3 text-sm font-black transition cursor-pointer ${
                activeTab === "available" ? "bg-[#2AABEE] text-white shadow-lg shadow-[#2AABEE]/25" : "bg-[#0F1A24] text-gray-300 hover:bg-[#182533]"
              }`}
            >
              Help Hub
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
            >
              My Chats
            </button>
          </div>
        </header>

        {/* Available Open Help Requests List */}
        <section className="flex-1 overflow-y-auto px-5 pb-36 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Open Requests</h2>
              <p className="text-xs text-gray-400">
                Help someone from {profile?.hall || "your hall"}
              </p>
            </div>

            <span className="rounded-full bg-[#0F1A24] px-3 py-1 text-xs font-bold text-[#2AABEE]">
              {availableRequests.length} active
            </span>
          </div>

          <div className="space-y-3">
            {availableRequests.length > 0 ? (
              availableRequests.map((req, index) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="w-full rounded-3xl border border-[#22303D] bg-[#0F1A24] p-5 shadow-lg shadow-black/20 space-y-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2B5278] text-2xl font-black relative">
                      📦
                      {req.requester?.warning_badge && (
                        <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-655 text-[10px] font-black text-white animate-pulse">
                          ⚠️
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="text-xs font-bold text-[#2AABEE] uppercase tracking-wide truncate">
                            @{req.requester?.anonymous_username}
                          </p>
                          {req.requester?.warning_badge && (
                            <span className="text-[7px] font-black bg-red-655/15 border border-red-500/20 px-1 py-0.2 rounded-full text-red-400 uppercase tracking-widest shrink-0 animate-pulse">
                              ⚠️ Badged
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 shrink-0">
                          {formatTimeAgo(req.created_at)}
                        </span>
                      </div>

                      <h3 className="mt-1 font-black text-white text-base">
                        {req.item}
                      </h3>

                      <p className="mt-1 text-xs text-gray-400">
                        Karma rating: <span className="text-[#2AABEE] font-bold">{req.requester?.karma ?? 0}</span>
                      </p>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleHelpNow(req)}
                          className="flex-1 rounded-xl bg-[#2AABEE] py-2 text-xs font-black text-white hover:scale-[1.01] transition cursor-pointer text-center"
                        >
                          Help Now
                        </button>
                        <button
                          onClick={() => openReportModal(req.requester_id, req.requester?.anonymous_username || "User", req.id)}
                          className="rounded-xl bg-red-950/20 border border-red-900/30 px-3 py-2 text-xs font-extrabold text-red-400 hover:bg-red-950/50 transition cursor-pointer shrink-0"
                        >
                          Report
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="mt-12 rounded-3xl border border-[#22303D] bg-[#0F1A24] p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#17212B] text-3xl">
                  🙌
                </div>
                <h3 className="text-base font-black">No open requests</h3>
                <p className="mt-2 text-xs text-gray-400 leading-normal">
                  All requests in {profile?.hall || "your hall"} are solved! Check back later.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar Nav Footer */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-4 backdrop-blur md:absolute md:right-auto md:w-107.5">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533] cursor-pointer"
            >
              Home
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full bg-[#2AABEE] py-3 text-sm font-black text-white shadow-lg shadow-[#2AABEE]/20 transition duration-200 hover:scale-[1.02] cursor-pointer"
            >
              Help Hub
            </button>

            <button
              onClick={() => router.push("/profile")}
              className="rounded-full bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533] cursor-pointer"
            >
              Profile
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Panel / Right Panel */}
      <section className="flex flex-1 flex-col bg-[#0F1A24] overflow-x-hidden w-full pb-safe">
        {/* Navigation Tabs Header */}
        <header className="sticky top-0 z-30 border-b border-[#22303D] bg-[#17212B] px-4 md:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                onClick={() => setActiveTab("available")}
                className={`rounded-2xl px-5 py-2.5 text-xs md:text-sm font-bold transition cursor-pointer shrink-0 ${
                  activeTab === "available" ? "bg-[#2AABEE] text-white shadow-md shadow-[#2AABEE]/15" : "bg-[#0E1621] text-gray-400 hover:bg-[#182533]"
                }`}
              >
                Available Help
              </button>

              <button
                onClick={() => setActiveTab("my_requests")}
                className={`rounded-2xl px-5 py-2.5 text-xs md:text-sm font-bold transition cursor-pointer shrink-0 ${
                  activeTab === "my_requests" ? "bg-[#2AABEE] text-white shadow-md shadow-[#2AABEE]/15" : "bg-[#0E1621] text-gray-400 hover:bg-[#182533]"
                }`}
              >
                My Requests ({myRequests.length})
              </button>

              <button
                onClick={() => setActiveTab("my_helpins")}
                className={`rounded-2xl px-5 py-2.5 text-xs md:text-sm font-bold transition cursor-pointer shrink-0 ${
                  activeTab === "my_helpins" ? "bg-[#2AABEE] text-white shadow-md shadow-[#2AABEE]/15" : "bg-[#0E1621] text-gray-400 hover:bg-[#182533]"
                }`}
              >
                My Helpin&apos;s ({myHelpins.length})
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-2xl bg-[#2AABEE] px-5 py-3 text-xs md:text-sm font-black text-white hover:scale-[1.02] transition cursor-pointer shadow-lg shadow-[#2AABEE]/20 shrink-0 self-start sm:self-auto"
            >
              + Create Help Request
            </button>
          </div>
        </header>

        {/* Tab Contents Panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
          <div className="mx-auto max-w-4xl">
            {activeTab === "available" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black">Help Requests in {profile?.hall}</h2>
                  <p className="mt-1.5 text-gray-400 text-xs md:text-sm leading-relaxed">
                    Only students belonging to <span className="text-white font-medium">{profile?.hall}</span> can view and accept these. Request feed is sorted automatically by <span className="text-[#2AABEE] font-bold">Helper Karma</span> prioritizing our most helpful students!
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {availableRequests.length > 0 ? (
                    availableRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-[#2AABEE]/10 px-3 py-1 text-[10px] font-black text-[#2AABEE] uppercase">
                              {req.action}
                            </span>
                            <span className="text-xs text-gray-500">{formatTimeAgo(req.created_at)}</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-gray-400 font-bold">
                                Broadcasted by @{req.requester?.anonymous_username}
                              </p>
                              {req.requester?.warning_badge && (
                                <span className="rounded-full bg-red-655/15 border border-red-500/20 px-1.5 py-0.2 text-[8px] font-black text-red-400 uppercase tracking-wide shrink-0 animate-pulse">
                                  ⚠️ Suspect
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3">
                              <span className="text-xs text-gray-500">
                                Karma: <span className="text-[#2AABEE] font-extrabold">{req.requester?.karma ?? 0}</span>
                              </span>
                              <span className="text-xs text-gray-500">
                                Dept: <span className="text-white font-semibold">{req.requester?.department}</span>
                              </span>
                            </div>
                          </div>

                          <h3 className="text-xl font-black text-white">{req.item}</h3>
                          <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                            A verified student in <span className="text-white font-semibold">{req.requester_hall}</span> needs a {req.item.toLowerCase()}.
                          </p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleHelpNow(req)}
                            className="flex-1 rounded-2xl bg-[#2AABEE] py-3 text-xs md:text-sm font-black text-white hover:opacity-90 transition cursor-pointer text-center"
                          >
                            Help Now
                          </button>
                          <button
                            onClick={() => openReportModal(req.requester_id, req.requester?.anonymous_username || "User", req.id)}
                            className="rounded-2xl bg-red-950/20 border border-red-900/35 px-4 py-3 text-xs md:text-sm font-bold text-red-400 hover:bg-red-950/40 transition cursor-pointer shrink-0"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-16 text-center border border-dashed border-[#22303D] rounded-3xl bg-[#17212B]/40">
                      <p className="text-4xl">🕊️</p>
                      <h3 className="mt-4 text-lg md:text-xl font-bold">No active requests</h3>
                      <p className="mt-2 text-xs md:text-sm text-gray-400 max-w-sm mx-auto leading-relaxed px-4">
                        There are no active, open help requests in your hall right now. Check back later or create a request.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "my_requests" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black">My Help Requests</h2>
                  <p className="mt-1.5 text-gray-400 text-xs md:text-sm">
                    Manage requests you have created. You can cancel active requests or mark them as solved when you receive assistance.
                  </p>
                </div>

                <div className="space-y-3">
                  {myRequests.length > 0 ? (
                    myRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg md:text-xl font-black text-white">{req.item}</h3>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                              req.status === "open" ? "bg-green-500/10 text-green-400" :
                              req.status === "accepted" ? "bg-[#2AABEE]/10 text-[#2AABEE]" :
                              req.status === "solved" ? "bg-amber-500/10 text-amber-400" :
                              "bg-gray-500/10 text-gray-400"
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(req.created_at).toLocaleString()}
                          </p>

                          {req.status === "accepted" && req.helper && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <p className="text-xs text-green-400 font-extrabold">
                                🤝 Helper @{req.helper.anonymous_username} ({req.helper.department})
                              </p>
                              {req.helper.warning_badge && (
                                <span className="rounded-full bg-red-655/15 border border-red-500/20 px-1.5 py-0.2 text-[8px] font-bold text-red-400 uppercase animate-pulse">
                                  ⚠️ Suspect
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {req.status === "open" && (
                            <button
                              onClick={() => handleCancelRequest(req.id)}
                              className="rounded-xl bg-red-600/20 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-600/30 transition cursor-pointer"
                            >
                              Cancel Request
                            </button>
                          )}

                          {req.status === "accepted" && (
                            <>
                              <button
                                onClick={() => router.push(`/chat/${req.conversation_id}`)}
                                className="rounded-xl bg-[#2AABEE] px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 transition cursor-pointer"
                              >
                                Open Chat
                              </button>
                              <button
                                onClick={() => handleMarkSolved(req.id)}
                                className="rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-green-700 transition cursor-pointer"
                              >
                                Solved
                              </button>
                            </>
                          )}
                          
                          {(req.status === "solved" || req.status === "cancelled") && (
                            <span className="text-xs text-gray-500 italic font-medium px-4 py-2 bg-[#0E1621] rounded-xl">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center border border-dashed border-[#22303D] rounded-3xl bg-[#17212B]/40">
                      <p className="text-4xl">📝</p>
                      <h3 className="mt-4 text-xl font-bold">No requests created</h3>
                      <p className="mt-2 text-xs md:text-sm text-gray-400 max-w-sm mx-auto leading-relaxed px-4">
                        You have not created any help requests yet. Need something? Click the create button.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "my_helpins" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black">My Helpin&apos;s</h2>
                  <p className="mt-1.5 text-gray-400 text-xs md:text-sm">
                    Track campus help requests you accepted. Keep communication friendly and open to help your fellow students.
                  </p>
                </div>

                <div className="space-y-3">
                  {myHelpins.length > 0 ? (
                    myHelpins.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h3 className="text-lg md:text-xl font-black text-white">{req.item}</h3>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs text-gray-400">
                              Requested by: @{req.requester?.anonymous_username} ({req.requester?.department})
                            </p>
                            {req.requester?.warning_badge && (
                              <span className="rounded-full bg-red-655/15 border border-red-500/20 px-1.5 py-0.2 text-[8px] font-bold text-red-400 uppercase animate-pulse">
                                  ⚠️ Suspect
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Status: <span className="capitalize font-semibold text-white">{req.status}</span>
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {req.status === "accepted" && (
                            <button
                               onClick={() => router.push(`/chat/${req.conversation_id}`)}
                              className="rounded-xl bg-[#2AABEE] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 transition cursor-pointer"
                            >
                              Open Chat
                            </button>
                          )}
                          {req.status === "solved" && (
                            <span className="text-xs text-green-400 font-bold px-4 py-2 flex items-center gap-1 bg-green-950/20 rounded-xl">
                              ✓ Solved successfully
                            </span>
                          )}
                          {req.status === "cancelled" && (
                            <span className="text-xs text-gray-500 italic px-4 py-2 bg-[#0E1621] rounded-xl">
                              Cancelled by requester
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center border border-dashed border-[#22303D] rounded-3xl bg-[#17212B]/40">
                      <p className="text-4xl">🤝</p>
                      <h3 className="mt-4 text-xl font-bold">No accepted help requests</h3>
                      <p className="mt-2 text-xs md:text-sm text-gray-400 max-w-sm mx-auto leading-relaxed px-4">
                        You haven&apos;t offered help on any requests yet. View active requests in your hall and click &quot;Help Now&quot; to connect.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Floating Mobile Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur md:hidden pb-safe">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
          <button
            onClick={() => router.push("/")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🏠</span>
            <span className="text-[10px] font-bold tracking-wide uppercase">Home</span>
          </button>

          <button
            onClick={() => setActiveTab("available")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl bg-[#2B5278]/20 text-[#2AABEE] transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🤝</span>
            <span className="text-[10px] font-black tracking-wide uppercase">Help Hub</span>
          </button>

          <button
            onClick={() => router.push("/chat")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">💬</span>
            <span className="text-[10px] font-bold tracking-wide uppercase">Chats</span>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">👤</span>
            <span className="text-[10px] font-bold tracking-wide uppercase">Profile</span>
          </button>
        </div>
      </nav>

      {/* Modal to Create New Help Request */}
      <AnimatePresence>
        {showCreateModal && (
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
                <h3 className="text-2xl font-black text-[#2AABEE] tracking-tight">Create Help Request</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Anonymous hall-based request visible only to same-hall students.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-[#0F1A24] p-4 border border-[#22303D]/80">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">
                    Request Action
                  </label>
                  <span className="text-base font-extrabold text-white">I Need</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block ml-1">
                    Select Needed Item
                  </label>
                  <select
                    value={selectedItem}
                    onChange={(e) => setSelectedItem(e.target.value)}
                    className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition"
                  >
                    <option value="">-- Choose item --</option>
                    {PREDEFINED_ITEMS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItem && profile && (
                  <div className="rounded-2xl border border-[#2AABEE]/20 bg-[#2AABEE]/5 p-4 space-y-1">
                    <p className="text-[10px] font-bold text-[#2AABEE] uppercase tracking-wider">
                      Request Preview
                    </p>
                    <p className="text-sm font-semibold text-white italic">
                      &quot;Someone from {profile.hall} needs a {selectedItem.toLowerCase()}.&quot;
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedItem("");
                  }}
                  className="flex-1 rounded-2xl bg-[#0F1A24] border border-[#22303D] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreateRequest}
                  disabled={submitting}
                  className="flex-1 rounded-2xl bg-[#2AABEE] py-3 text-sm font-black text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#2AABEE]/20"
                >
                  {submitting ? "Publishing..." : "Publish Request"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal to Report a User */}
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
                <h3 className="text-2xl font-black text-red-400 tracking-tight">Report User</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Report student @<span className="text-white font-bold">{reportTargetName}</span> to Daffgle admin for investigation.
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
                    placeholder="Enter context, chat comments, or details..."
                    rows={4}
                    className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white outline-none focus:border-red-400 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportTargetId("");
                    setReportTargetName("");
                    setReportRequestId("");
                  }}
                  className="flex-1 rounded-2xl bg-[#0F1A24] border border-[#22303D] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSubmitReport}
                  disabled={submittingReport}
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