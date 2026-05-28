"use client";
 
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { isEmailAllowed } from "@/lib/validations/auth";
import { toast } from "sonner";
import { 
  PremiumCard, 
  PremiumButton, 
  PremiumInput, 
  PremiumSelect, 
  PremiumDialog, 
  Skeleton, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, Search, Users, AlertTriangle, ShieldAlert, FileText, 
  Activity, Radio, ToggleLeft, Power, Plus, Trash2, ShieldX,
  VolumeX, Volume2, UserCheck, UserX, Database, RefreshCw, LogOut, CheckCircle, Lock
} from "lucide-react";
import { FeatureToggles, GlobalNotice } from "@/components/providers/AppSettingsProvider";
 
type UserRow = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  hall?: string;
  is_online: boolean;
  is_admin: boolean;
  is_banned: boolean;
  is_muted: boolean;
  is_shadow_banned: boolean;
  real_email?: string | null;
  last_seen: string;
  created_at: string;
  karma: number;
  profile_edit_count: number;
  warning_badge?: string | null;
};
 
type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  conversation_id?: string | null;
  request_id?: string | null;
};
 
type AdminLog = {
  id: string;
  admin_email: string;
  action: string;
  details: string | null;
  created_at: string;
};
 
type AdminHelpRequest = {
  id: string;
  title: string;
  requester_id: string;
  hall: string;
  status: string;
  created_at: string;
};
 
const WARNING_BADGES = [
  { value: "", label: "No Warning Badge" },
  { value: "Under Investigation", label: "Under Investigation" },
  { value: "Reported User", label: "Reported User" },
  { value: "Fake Helper Suspected", label: "Fake Helper Suspected" }
];
 
function isUserActuallyOnline(isOnline: boolean | undefined, lastSeen: string | undefined) {
  if (!isOnline) return false;
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen).getTime();
  const now = Date.now();
  return now - lastSeenDate < 90000;
}

export default function AdminPage() {
  const router = useRouter();
 
  const [adminId, setAdminId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [helpRequests, setHelpRequests] = useState<AdminHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"overview" | "command" | "users" | "requests" | "notices" | "reports" | "logs">("overview");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
 
  // lock & toggles states
  const [isLocked, setIsLocked] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState("System Maintenance");
  const [maintenanceMsg, setMaintenanceMsg] = useState("Daffgle is currently undergoing scheduled systems upgrade.");
  const [reopenTime, setReopenTime] = useState("");
  const [toggles, setToggles] = useState<FeatureToggles>({
    chats: true,
    help_hub: true,
    sanctuary: true,
    registrations: true,
    profile_editing: true,
    notifications: true
  });
 
  // notices states
  const [notices, setNotices] = useState<GlobalNotice[]>([]);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeType, setNoticeType] = useState<"info" | "warning" | "emergency">("info");
 
  // emergency broadcast states
  const [alertActive, setAlertActive] = useState(false);
  const [alertTitle, setAlertTitle] = useState("EMERGENCY ALERT");
  const [alertMsg, setAlertMsg] = useState("A system security incident has been flagged. Please stay alert.");
  const [alertType, setAlertType] = useState<"warning" | "danger" | "info">("danger");
 
  // Platform Health Metrics
  const [supabaseRealtimeStatus, setSupabaseRealtimeStatus] = useState<"healthy" | "warning" | "red">("healthy");
  const [authStatus, setAuthStatus] = useState<"healthy" | "warning" | "red">("healthy");
  const [dbStatus, setDbStatus] = useState<"healthy" | "warning" | "red">("healthy");
  const [apiStatus, setApiStatus] = useState<"healthy" | "warning" | "red">("healthy");
 
  // Dismiss/Bypass check
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((user) => {
      return (
        user.anonymous_username?.toLowerCase().includes(q) ||
        user.department?.toLowerCase().includes(q) ||
        user.real_email?.toLowerCase().includes(q) ||
        user.hall?.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);
 
  const pendingReports = reports.filter((report) => report.status === "pending");
 
  // Diagnostic pingers
  const checkPlatformHealth = async () => {
    // 1. Supabase RT check
    try {
      const channel = supabase.channel("ping-health-rt");
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSupabaseRealtimeStatus("healthy");
        } else {
          setSupabaseRealtimeStatus("warning");
        }
        supabase.removeChannel(channel);
      });
    } catch {
      setSupabaseRealtimeStatus("red");
    }
 
    // 2. Database & API ping
    const startTime = Date.now();
    try {
      const { data } = await supabase.from("app_settings").select("id").eq("id", 1).single();
      const latency = Date.now() - startTime;
      if (data) {
        setDbStatus(latency < 400 ? "healthy" : "warning");
      } else {
        setDbStatus("red");
      }
    } catch {
      setDbStatus("red");
    }
 
    try {
      const res = await fetch("/api/admin/users", { method: "HEAD" });
      setApiStatus(res.status !== 500 ? "healthy" : "red");
    } catch {
      setApiStatus("red");
    }
 
    try {
      const { data } = await supabase.auth.getSession();
      setAuthStatus(data.session ? "healthy" : "warning");
    } catch {
      setAuthStatus("red");
    }
  };
 
  const writeAdminLog = async (action: string, details?: string) => {
    await supabase.from("admin_logs").insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      details: details || null
    });
  };
 
  const loadAdminData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
 
    const { data: userData } = await supabase.auth.getUser();
 
    if (!userData.user || !isEmailAllowed(userData.user.email)) {
      if (userData.user) {
        await supabase.auth.signOut();
      }
      router.push("/login?error=domain_restricted");
      return;
    }
 
    const myId = userData.user.id;
    setAdminId(myId);
    setAdminEmail(userData.user.email || "");
 
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", myId)
      .single();
 
    if (!adminProfile?.is_admin) {
      toast.error("Unauthorized entry: Admin eyes only!");
      router.push("/dashboard");
      return;
    }
 
    // 1. Fetch singleton app settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
 
    if (settings) {
      setIsLocked(settings.is_locked || false);
      setMaintenanceTitle(settings.maintenance_title || "System Maintenance");
      setMaintenanceMsg(settings.maintenance_message || "");
      setReopenTime(settings.estimated_reopen_time || "");
      setToggles(settings.feature_toggles || toggles);
      if (settings.emergency_alert) {
        setAlertActive(settings.emergency_alert.active);
        setAlertTitle(settings.emergency_alert.title);
        setAlertMsg(settings.emergency_alert.message);
        setAlertType(settings.emergency_alert.type);
      } else {
        setAlertActive(false);
      }
    }
 
    // 2. Fetch User profiles mapping
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
 
    // Securely lookup real email mapping
    let emailLookup: Record<string, string> = {};
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const apiData = await res.json();
        if (apiData.success && apiData.emails) {
          emailLookup = apiData.emails;
        }
      }
    } catch (err) {
      console.error("[Admin Command] Email mapping load failed:", err);
    }
 
    const mergedUsers = (profiles || []).map((p: any) => {
      const realEmail = emailLookup[p.id] || "Encrypted Profile";
      return {
        ...p,
        real_email: realEmail
      };
    }) as UserRow[];
 
    setUsers(mergedUsers);
 
    // 3. Fetch Notices list
    const { data: noticeList } = await supabase
      .from("global_notices")
      .select("*")
      .order("created_at", { ascending: false });
    setNotices(noticeList || []);
 
    // 4. Fetch Active Reports
    const { data: reportData } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    setReports(reportData || []);
 
    // 5. Fetch Help requests (to delete spam)
    const { data: reqs } = await supabase
      .from("help_requests")
      .select("id, title, requester_id, hall, status, created_at")
      .order("created_at", { ascending: false });
    setHelpRequests(reqs || []);
 
    // 6. Fetch Admin logs
    const { data: logsData } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setAdminLogs(logsData || []);
 
    await checkPlatformHealth();
    setLoading(false);
    setRefreshing(false);
  }, [router]);
 
  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);
 
  // REAL-TIME AUTO REFRESH SUB
  useEffect(() => {
    if (!adminId) return;
 
    const channel = supabase
      .channel("admin-realtime-panel-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => loadAdminData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "global_notices" }, () => loadAdminData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => loadAdminData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_logs" }, () => loadAdminData(true))
      .subscribe();
 
    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId, loadAdminData]);
 
  const handleRefresh = async () => {
    await loadAdminData(true);
    toast.success("Command Feed Refreshed Realtime.");
  };
 
  // FEATURE 1: LOCK CONTROL SYSTEM
  const handleToggleLock = async () => {
    const nextLock = !isLocked;
    const { error } = await supabase
      .from("app_settings")
      .update({
        is_locked: nextLock,
        maintenance_title: maintenanceTitle,
        maintenance_message: maintenanceMsg,
        estimated_reopen_time: reopenTime ? new Date(reopenTime).toISOString() : null
      })
      .eq("id", 1);
 
    if (error) {
      toast.error("Failed to update Lock: " + error.message);
      return;
    }
 
    setIsLocked(nextLock);
    await writeAdminLog(
      nextLock ? "PLATFORM_LOCKED" : "PLATFORM_UNLOCKED",
      `Platform system-wide lock toggled ${nextLock ? "ON" : "OFF"}. Message: "${maintenanceMsg}"`
    );
    toast.success(nextLock ? "Platform locked successfully!" : "Platform unlocked successfully!");
  };
 
  // FEATURE 3: FEATURE TOGGLES
  const handleToggleFeature = async (key: keyof FeatureToggles) => {
    const nextToggles = { ...toggles, [key]: !toggles[key] };
    const { error } = await supabase
      .from("app_settings")
      .update({ feature_toggles: nextToggles })
      .eq("id", 1);
 
    if (error) {
      toast.error("Failed to update feature toggles: " + error.message);
      return;
    }
 
    setToggles(nextToggles);
    await writeAdminLog("FEATURE_TOGGLED", `Feature "${key}" set to ${nextToggles[key] ? "ENABLED" : "DISABLED"}`);
    toast.success(`Feature "${key}" updated.`);
  };
 
  // FEATURE 2: GLOBAL NOTICES
  const handleCreateNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error("Announcement title and contents are required.");
      return;
    }
 
    const { error } = await supabase
      .from("global_notices")
      .insert({
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        type: noticeType,
        is_active: true
      });
 
    if (error) {
      toast.error("Failed to post notice: " + error.message);
      return;
    }
 
    await writeAdminLog("NOTICE_PUBLISHED", `Notice "${noticeTitle}" published as type: ${noticeType}`);
    toast.success("Holographic announcement broadcasted!");
    setShowNoticeModal(false);
    setNoticeTitle("");
    setNoticeContent("");
    loadAdminData(true);
  };
 
  const handleDeleteNotice = async (id: string, title: string) => {
    const { error } = await supabase
      .from("global_notices")
      .delete()
      .eq("id", id);
 
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
 
    await writeAdminLog("NOTICE_DELETED", `Announcement "${title}" removed.`);
    toast.success("Announcement deleted.");
    loadAdminData(true);
  };
 
  // FEATURE 5: EMERGENCY BROADCAST alerts
  const handleToggleEmergencyAlert = async () => {
    const nextAlert = alertActive ? null : {
      title: alertTitle.trim(),
      message: alertMsg.trim(),
      type: alertType,
      active: true
    };
 
    const { error } = await supabase
      .from("app_settings")
      .update({ emergency_alert: nextAlert })
      .eq("id", 1);
 
    if (error) {
      toast.error("Broadcast failed: " + error.message);
      return;
    }
 
    setAlertActive(!alertActive);
    await writeAdminLog(
      alertActive ? "EMERGENCY_BROADCAST_CLEARED" : "EMERGENCY_BROADCAST_TRIGGERED",
      alertActive ? "Fullscreen alert cleared." : `Fullscreen alert trigger: "${alertTitle}"`
    );
    toast.success(alertActive ? "Broadcast cleared." : "Fullscreen Emergency Alert Broadcasted!");
  };
 
  // FEATURE 4: MODERATION actions
  const handleToggleBan = async (user: UserRow, status: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: status })
      .eq("id", user.id);
 
    if (error) {
      toast.error("Operation failed: " + error.message);
      return;
    }
 
    await writeAdminLog(status ? "BAN_USER" : "UNBAN_USER", `User @${user.anonymous_username} was ${status ? "banned" : "unbanned"}`);
    toast.success(`User @${user.anonymous_username} ban toggled.`);
    loadAdminData(true);
  };
 
  const handleToggleShadowBan = async (user: UserRow, status: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_shadow_banned: status })
      .eq("id", user.id);
 
    if (error) {
      toast.error("Operation failed: " + error.message);
      return;
    }
 
    await writeAdminLog(
      status ? "SHADOW_BAN_USER" : "UNSHADOW_BAN_USER",
      `User @${user.anonymous_username} was ${status ? "shadow-banned" : "un-shadow-banned"}`
    );
    toast.success(`User @${user.anonymous_username} shadow-ban status updated.`);
    loadAdminData(true);
  };
 
  const handleToggleMute = async (user: UserRow, status: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_muted: status })
      .eq("id", user.id);
 
    if (error) {
      toast.error("Operation failed: " + error.message);
      return;
    }
 
    await writeAdminLog(status ? "MUTE_USER" : "UNMUTE_USER", `User @${user.anonymous_username} mute set to ${status}`);
    toast.success(`User @${user.anonymous_username} mute status updated.`);
    loadAdminData(true);
  };
 
  const handleForceLogout = async (user: UserRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ force_logout: true })
      .eq("id", user.id);
 
    if (error) {
      toast.error("Operation failed: " + error.message);
      return;
    }
 
    await writeAdminLog("FORCE_LOGOUT_USER", `User @${user.anonymous_username} active session terminated remotely.`);
    toast.success(`Session termination signals sent for @${user.anonymous_username}!`);
    loadAdminData(true);
  };
 
  const handleDeleteRequest = async (id: string, title: string) => {
    const confirmDelete = window.confirm(`Permanently delete spam help request: "${title}"?`);
    if (!confirmDelete) return;
 
    const { error } = await supabase
      .from("help_requests")
      .delete()
      .eq("id", id);
 
    if (error) {
      toast.error("Deletion failed: " + error.message);
      return;
    }
 
    await writeAdminLog("REQUEST_DELETED", `Spam request deleted: "${title}"`);
    toast.success("Help request deleted.");
    loadAdminData(true);
  };
 
  const handleResolveReport = async (report: Report, nextStatus: string) => {
    const { error } = await supabase
      .from("reports")
      .update({ status: nextStatus })
      .eq("id", report.id);
 
    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }
 
    await writeAdminLog("REPORT_RESOLVED", `Report ${report.id} status set to ${nextStatus}`);
    toast.success(`Report status marked as ${nextStatus}.`);
    loadAdminData(true);
  };
 
  // Suspicious user filter
  const suspiciousUsers = useMemo(() => {
    return users.filter(u => u.profile_edit_count >= 2 || u.warning_badge || u.karma > 150);
  }, [users]);
 
  const activeChatsCount = useMemo(() => {
    return helpRequests.filter(r => r.status === "accepted").length;
  }, [helpRequests]);
 
  if (loading) {
    return (
      <main className="min-h-screen bg-brand-primary text-white flex items-center justify-center pt-safe relative select-none">
        <div className="cyber-scanline" />
        <div className="cyber-grid" />
        <div className="flex flex-col items-center gap-3 animate-pulse z-10">
          <div className="h-10 w-10 rounded-full border-4 border-white/5 border-t-brand-accent animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-brand-text-secondary">Syncing Cyber Command Center...</p>
        </div>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen bg-brand-primary text-brand-text-primary pt-safe pb-24 relative overflow-hidden select-none">
      
      {/* Visual cyber elements */}
      <div className="cyber-scanline" />
      <div className="cyber-grid" />
      <div className="ambient-orb top-0 left-1/4" />
 
      {/* Holographic Header Panel */}
      <header className="sticky top-0 z-30 border-b border-brand-accent/25 bg-[#0B120B]/90 backdrop-blur-md px-6 py-5">
        <div className="mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-widest text-white uppercase flex items-center gap-2 drop-shadow-[0_0_12px_#7CFF6B]">
              <Radio className="h-6 w-6 text-brand-accent animate-pulse" />
              Daffgle Command Center
            </h1>
            <p className="text-[9px] font-black text-brand-text-secondary uppercase tracking-[0.25em] mt-1 select-none">
              Holographic cybersecurity monitoring & operations hub
            </p>
          </div>
 
          <div className="flex flex-wrap gap-2">
            <PremiumButton
              onClick={handleRefresh}
              disabled={refreshing}
              variant="accent"
              className="py-2.5 px-4 text-[10px] rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              Sync Feeds
            </PremiumButton>
 
            <PremiumButton
              onClick={() => router.push("/dashboard")}
              variant="secondary"
              className="py-2.5 px-4 text-[10px] rounded-xl"
            >
              Enter Client UI
            </PremiumButton>
 
            <PremiumButton
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              variant="danger"
              className="py-2.5 px-4 text-[10px] rounded-xl"
            >
              Logout
            </PremiumButton>
          </div>
        </div>
      </header>
 
      <section className="mx-auto max-w-7xl px-6 py-8 space-y-8 z-10 relative">
        
        {/* Real-time Diagnostics (Platform Health Monitor) & Live Analytics */}
        <div className="grid gap-6 md:grid-cols-12">
          
          {/* Diagnostic Monitor */}
          <PremiumCard className="md:col-span-4 p-6 border-brand-accent/20 bg-brand-surface/75 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2 flex items-center gap-1.5 select-none">
              <Database className="h-4 w-4" /> Platform Diagnostics
            </h3>
            
            <div className="space-y-3 pt-1">
              {[
                { name: "Supabase Realtime Connection", status: supabaseRealtimeStatus },
                { name: "Client Authentication Tokens", status: authStatus },
                { name: "Supabase Database Response", status: dbStatus },
                { name: "Secure Moderation API Engine", status: apiStatus },
              ].map(x => (
                <div key={x.name} className="flex items-center justify-between text-xs rounded-xl bg-brand-secondary/60 p-3 border border-brand-border">
                  <span className="text-brand-text-secondary font-semibold">{x.name}</span>
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px]">
                    <span className={`h-2 w-2 rounded-full ${
                      x.status === "healthy" ? "bg-[#39FF88] shadow-[0_0_8px_#39FF88] animate-pulse" :
                      x.status === "warning" ? "bg-yellow-400 shadow-[0_0_8px_#facc15]" :
                      "bg-brand-danger shadow-[0_0_8px_#FF4D4D] animate-ping"
                    }`} />
                    <span className={
                      x.status === "healthy" ? "text-brand-accent-secondary" :
                      x.status === "warning" ? "text-yellow-400" : "text-brand-danger"
                    }>{x.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
 
          {/* Live Analytics Dashboard */}
          <div className="md:col-span-8 grid gap-4 grid-cols-2 sm:grid-cols-3">
            {[
              { label: "Online Students", value: users.filter(u => isUserActuallyOnline(u.is_online, u.last_seen)).length, color: "text-brand-accent-secondary" },
              { label: "Active Helper Matches", value: activeChatsCount, color: "text-brand-accent" },
              { label: "Open Help Requests", value: helpRequests.filter(r => r.status === "open").length, color: "text-white" },
              { label: "Total Registrations", value: users.length, color: "text-brand-accent" },
              { label: "Open Safety Reports", value: pendingReports.length, color: "text-yellow-400" },
              { label: "Banned Identities", value: users.filter(u => u.is_banned).length, color: "text-brand-danger" },
            ].map(card => (
              <PremiumCard key={card.label} className="p-5 border-brand-border bg-brand-surface/65 shadow-md flex flex-col justify-between h-28 relative overflow-hidden">
                <span className="text-2xl font-black tracking-wider block z-10 font-mono" style={{ color: "var(--brand-accent)" }}>
                  <span className={card.color}>{card.value}</span>
                </span>
                <span className="text-[9px] font-black text-brand-text-secondary uppercase tracking-widest block z-10 leading-normal">
                  {card.label}
                </span>
                <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-brand-accent/5 blur-lg pointer-events-none" />
              </PremiumCard>
            ))}
          </div>
 
        </div>
 
        {/* Holographic Operations Navigation Tabs */}
        <div className="flex flex-wrap gap-2 rounded-2xl bg-[#0B120B] p-2 border border-brand-accent/25 max-w-fit shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
          {[
            { id: "overview", label: "Command Deck", icon: <Radio className="h-3.5 w-3.5" /> },
            { id: "command", label: "System Locks", icon: <ToggleLeft className="h-3.5 w-3.5" /> },
            { id: "users", label: "User Accounts", icon: <Users className="h-3.5 w-3.5" /> },
            { id: "requests", label: "Help Requests", icon: <Trash2 className="h-3.5 w-3.5" /> },
            { id: "notices", label: "Announcements", icon: <Plus className="h-3.5 w-3.5" /> },
            { id: "reports", label: `Reports (${pendingReports.length})`, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
            { id: "logs", label: "Logs", icon: <FileText className="h-3.5 w-3.5" /> },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setTab(opt.id as any)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer transition select-none ${
                tab === opt.id 
                  ? "bg-brand-accent text-black font-black shadow-[0_0_15px_rgba(124,255,107,0.3)]" 
                  : "text-brand-text-secondary hover:text-white"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
 
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Command Deck (Overview Alerts & Suspicious sessions) */}
          {tab === "overview" && (
            <motion.div
              key="overview-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="grid gap-6 md:grid-cols-2"
            >
              {/* Suspicious sessions / accounts */}
              <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Suspicious Student Identities
                </h2>
                
                <div className="space-y-3 pt-1">
                  {suspiciousUsers.slice(0, 4).map(u => (
                    <div key={u.id} className="rounded-xl bg-brand-secondary/60 p-4 border border-brand-border flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">@{u.anonymous_username}</span>
                          <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.2 text-[8px] font-bold text-red-400">
                            {u.profile_edit_count} Edits
                          </span>
                        </div>
                        <p className="text-[10px] text-brand-text-secondary mt-1">
                          Karma: {u.karma} | Hall: {u.hall || "None"} | Email: {u.real_email}
                        </p>
                      </div>
                      <PremiumButton
                        onClick={() => handleForceLogout(u)}
                        variant="secondary"
                        className="py-1 px-3 rounded-lg text-[9px]"
                      >
                        Force Out
                      </PremiumButton>
                    </div>
                  ))}
                  {suspiciousUsers.length === 0 && (
                    <p className="text-xs text-brand-text-secondary italic">No suspicious anomalies detected.</p>
                  )}
                </div>
              </PremiumCard>
 
              {/* Recent System Activity Logs */}
              <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2 flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Recent Operations Log
                </h2>
                
                <div className="space-y-3 pt-1">
                  {adminLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="rounded-xl bg-brand-secondary/60 p-3 border border-brand-border text-[11px] leading-relaxed">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase text-brand-text-secondary">
                        <span className="text-brand-accent">{log.action}</span>
                        <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-white mt-1 font-semibold">{log.details}</p>
                      <p className="text-[8px] text-brand-text-secondary/60 mt-0.5">Admin: {log.admin_email}</p>
                    </div>
                  ))}
                  {adminLogs.length === 0 && (
                    <p className="text-xs text-brand-text-secondary italic">No operations logged.</p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}
 
          {/* TAB 2: System Locks (Locks, Broadcast, Toggles) */}
          {tab === "command" && (
            <motion.div
              key="command-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="grid gap-6 md:grid-cols-12"
            >
              {/* System Lock & Emergency Broadcast alerts */}
              <div className="md:col-span-7 space-y-6">
                
                {/* Platform Lock control panel */}
                <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-5">
                  <div className="flex items-center justify-between border-b border-brand-border pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-accent flex items-center gap-1.5">
                      <Lock className="h-4 w-4" /> System Lock controls
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${isLocked ? "bg-brand-danger animate-pulse" : "bg-[#39FF88]"}`} />
                      <span className="text-[10px] font-black uppercase tracking-wider">{isLocked ? "PLATFORM LOCKED" : "ONLINE"}</span>
                    </div>
                  </div>
 
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PremiumInput
                        label="Lock Portal Title"
                        value={maintenanceTitle}
                        onChange={(e) => setMaintenanceTitle(e.target.value)}
                        placeholder="Maintenance title..."
                      />
                      <PremiumInput
                        label="Estimated Reopen time"
                        type="datetime-local"
                        value={reopenTime ? reopenTime.slice(0, 16) : ""}
                        onChange={(e) => setReopenTime(e.target.value)}
                      />
                    </div>
                    
                    <PremiumInput
                      label="Lock Portal message"
                      value={maintenanceMsg}
                      onChange={(e) => setMaintenanceMsg(e.target.value)}
                      placeholder="Write maintenance details..."
                    />
 
                    <PremiumButton
                      onClick={handleToggleLock}
                      variant={isLocked ? "danger" : "primary"}
                      className="w-full font-black py-4 flex items-center justify-center gap-1.5"
                      withNeonGlow
                    >
                      <Power className="h-4 w-4" />
                      {isLocked ? "Open Platform Gates" : "Lock Entire Platform Now"}
                    </PremiumButton>
                  </div>
                </PremiumCard>
 
                {/* emergency fullscreen alerts */}
                <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-brand-danger border-b border-brand-border pb-2 flex items-center gap-1.5">
                    🚨 Emergency Fullscreen alert broadcast
                  </h3>
 
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PremiumInput
                        label="Emergency Title"
                        value={alertTitle}
                        onChange={(e) => setAlertTitle(e.target.value)}
                        placeholder="Emergency alert title..."
                      />
                      <PremiumSelect
                        label="Alert Priority Theme"
                        value={alertType}
                        onChange={(val) => setAlertType(val as any)}
                        options={[
                          { value: "danger", label: "Danger Crimson" },
                          { value: "warning", label: "Warning Yellow" },
                          { value: "info", label: "Operations Info" }
                        ]}
                      />
                    </div>
 
                    <PremiumInput
                      label="Alert Broadcast Contents"
                      value={alertMsg}
                      onChange={(e) => setAlertMsg(e.target.value)}
                      placeholder="Write urgent details for all screens..."
                    />
 
                    <PremiumButton
                      onClick={handleToggleEmergencyAlert}
                      variant="danger"
                      className="w-full font-black py-4 flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(255,77,77,0.15)]"
                      withNeonGlow
                    >
                      <Radio className="h-4 w-4" />
                      {alertActive ? "Terminate Emergency Broadcast" : "Trigger Fullscreen Emergency Alert"}
                    </PremiumButton>
                  </div>
                </PremiumCard>
 
              </div>
 
              {/* Feature Toggles (Feature 3) */}
              <div className="md:col-span-5">
                <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2 flex items-center gap-1.5">
                    ⚙️ Platform Subsystem Toggles
                  </h3>
                  
                  <div className="space-y-3.5 pt-1">
                    {[
                      { key: "chats", label: "Student Private Chats" },
                      { key: "help_hub", label: "Campus Help Hub Feed" },
                      { key: "sanctuary", label: "Night Owl Mode Sanctuary" },
                      { key: "registrations", label: "Onboarding Registrations" },
                      { key: "profile_editing", label: "Identity Profile Editing" },
                      { key: "notifications", label: "Realtime Notification Engine" },
                    ].map(feat => {
                      const enabled = toggles[feat.key as keyof FeatureToggles];
                      return (
                        <div key={feat.key} className="flex items-center justify-between text-xs rounded-xl bg-brand-secondary/60 p-4 border border-brand-border">
                          <div>
                            <p className="font-bold text-white">{feat.label}</p>
                            <p className="text-[9px] text-brand-text-secondary mt-0.5 select-none uppercase tracking-wider font-semibold">
                              {enabled ? "Fully Operational" : "Deactivated"}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => handleToggleFeature(feat.key as keyof FeatureToggles)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              enabled ? "bg-brand-accent" : "bg-brand-elevated/80"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-md ring-0 transition duration-200 ease-in-out ${
                                enabled ? "translate-x-5 bg-black" : "translate-x-0 bg-brand-text-secondary"
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </PremiumCard>
              </div>
            </motion.div>
          )}
 
          {/* TAB 3: User Moderation Center */}
          {tab === "users" && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wider text-white">
                      Registered Student Identities
                    </h2>
                    <p className="text-xs text-brand-text-secondary mt-1 select-none font-semibold">
                      Map anonymous profiles to verified diu.edu.bd emails and govern permissions.
                    </p>
                  </div>
 
                  <PremiumInput
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search username, email, department, hall..."
                    leftIcon={<Search className="h-4 w-4 opacity-50" />}
                    containerClassName="w-full md:w-96"
                  />
                </div>
 
                <div className="space-y-4 pt-2">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="rounded-2xl bg-brand-secondary/60 p-5 border border-brand-border flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 select-none">
                          <p className="text-base font-black text-white">
                            @{u.anonymous_username || "Not set"}
                          </p>
 
                          {u.warning_badge && (
                            <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[8px] font-bold text-red-400 animate-pulse uppercase">
                              ⚠️ {u.warning_badge}
                            </span>
                          )}
 
                          <span className="rounded-full bg-brand-accent/15 px-2.5 py-0.5 text-[9px] font-bold text-brand-accent">
                            {u.karma} Karma Points
                          </span>
 
                          {u.is_shadow_banned && (
                            <span className="rounded-full bg-purple-500/15 border border-purple-500/20 px-2.5 py-0.5 text-[8px] font-black uppercase text-purple-300 animate-pulse">
                              Shadow Banned
                            </span>
                          )}
 
                          {u.is_banned && (
                            <span className="rounded-full bg-red-500/15 border border-red-500/20 px-2.5 py-0.5 text-[8px] font-black uppercase text-red-300">
                              Banned
                            </span>
                          )}
 
                          {u.is_muted && (
                            <span className="rounded-full bg-yellow-500/10 border border-yellow-500/15 px-2.5 py-0.5 text-[8px] font-black uppercase text-yellow-300">
                              Muted
                            </span>
                          )}
 
                          {isUserActuallyOnline(u.is_online, u.last_seen) && (
                            <span className="rounded-full bg-green-500/10 border border-green-500/15 px-2.5 py-0.5 text-[9px] font-bold text-[#39FF88]">
                              Online
                            </span>
                          )}
                        </div>
 
                        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-xs text-brand-text-secondary leading-normal font-semibold">
                          <p>Verified Student Email: <span className="text-white font-bold">{u.real_email}</span></p>
                          <p>Department / Gender: <span className="text-white font-bold">{u.department} • {u.gender}</span></p>
                          <p>Residence Hall: <span className="text-white font-bold">{u.hall || "Not set"}</span></p>
                          <p>Edit counts: <span className="text-white font-bold">{u.profile_edit_count} edits used</span></p>
                          <p className="sm:col-span-2 text-brand-text-secondary/60 text-[10px] select-none uppercase tracking-wider font-bold">
                            Joined: {new Date(u.created_at).toLocaleDateString()} | Active: {new Date(u.last_seen).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
 
                      {/* Moderation actions controls */}
                      <div className="flex flex-wrap gap-2 lg:self-center shrink-0">
                        <PremiumSelect
                          value={u.warning_badge || ""}
                          onChange={(val) => {
                            // Call pre-existing warn logic safely
                            supabase.from("profiles").update({ warning_badge: val ? val : null }).eq("id", u.id).then(() => {
                              toast.success("Warning badge set.");
                              loadAdminData(true);
                            });
                          }}
                          options={WARNING_BADGES}
                          containerClassName="min-w-44"
                        />
 
                        <PremiumButton
                          onClick={() => handleForceLogout(u)}
                          variant="secondary"
                          className="py-2 px-3.5 rounded-xl text-[10px] flex items-center gap-1"
                        >
                          <LogOut className="h-3 w-3" /> Terminate Session
                        </PremiumButton>
 
                        {/* Shadow Ban trigger */}
                        <PremiumButton
                          onClick={() => handleToggleShadowBan(u, !u.is_shadow_banned)}
                          variant="accent"
                          className="py-2 px-3.5 rounded-xl text-[10px]"
                        >
                          {u.is_shadow_banned ? "Un-Shadow Ban" : "Shadow Ban"}
                        </PremiumButton>
 
                        {/* Mute trigger */}
                        <PremiumButton
                          onClick={() => handleToggleMute(u, !u.is_muted)}
                          variant="secondary"
                          className="py-2 px-3.5 rounded-xl text-[10px]"
                        >
                          {u.is_muted ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                        </PremiumButton>
 
                        {/* Ban trigger */}
                        <PremiumButton
                          onClick={() => handleToggleBan(u, !u.is_banned)}
                          variant={u.is_banned ? "primary" : "danger"}
                          className="py-2 px-3.5 rounded-xl text-[10px]"
                        >
                          {u.is_banned ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                        </PremiumButton>
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </motion.div>
          )}
 
          {/* TAB 4: Help Requests Deletion (Feature 4.4) */}
          {tab === "requests" && (
            <motion.div
              key="requests-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2">
                  Active Help Feed moderation
                </h2>
 
                <div className="space-y-3 pt-2">
                  {helpRequests.map((req) => (
                    <div key={req.id} className="rounded-xl bg-brand-secondary/60 p-4 border border-brand-border flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="rounded-full bg-brand-accent/15 px-2.5 py-0.2 text-[8px] font-bold text-brand-accent select-none uppercase tracking-wide">
                          {req.status}
                        </span>
                        <h4 className="font-bold text-white mt-1 text-sm">{req.title}</h4>
                        <p className="text-[10px] text-brand-text-secondary mt-0.5">
                          Hall: {req.hall} | Created: {new Date(req.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
 
                      <PremiumButton
                        onClick={() => handleDeleteRequest(req.id, req.title)}
                        variant="danger"
                        className="py-2 px-3.5 rounded-xl text-[10px] flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="h-3 w-3" /> Delete spam
                      </PremiumButton>
                    </div>
                  ))}
                  {helpRequests.length === 0 && (
                    <p className="text-center text-xs text-brand-text-secondary italic py-12">No requests posted.</p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}
 
          {/* TAB 5: Announcements Management */}
          {tab === "notices" && (
            <motion.div
              key="notices-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="grid gap-6 md:grid-cols-12"
            >
              {/* Active Broadcast notices list */}
              <div className="md:col-span-7">
                <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2">
                    Active Announcements
                  </h3>
                  
                  <div className="space-y-3 pt-1">
                    {notices.map(n => (
                      <div key={n.id} className="rounded-xl bg-brand-secondary/60 p-4 border border-brand-border flex items-start justify-between gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{n.title}</span>
                            <span className={`rounded-full px-2 py-0.2 text-[8px] font-black uppercase ${
                              n.type === "emergency" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              n.type === "warning" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                              "bg-brand-accent/15 text-brand-accent border border-brand-accent/20"
                            }`}>
                              {n.type}
                            </span>
                          </div>
                          <p className="text-brand-text-secondary leading-relaxed font-semibold">{n.content}</p>
                        </div>
                        
                        <PremiumButton
                          onClick={() => handleDeleteNotice(n.id, n.title)}
                          variant="danger"
                          className="py-1.5 px-3 rounded-lg text-[9px] shrink-0"
                        >
                          Delete
                        </PremiumButton>
                      </div>
                    ))}
                    {notices.length === 0 && (
                      <p className="text-xs text-brand-text-secondary italic py-8 text-center">No active announcements broadcasted.</p>
                    )}
                  </div>
                </PremiumCard>
              </div>
 
              {/* Notice Publish controls */}
              <div className="md:col-span-5">
                <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2 flex items-center gap-1.5">
                    📢 Broadcast Announcement
                  </h3>
 
                  <div className="space-y-4">
                    <PremiumInput
                      label="Announcement Title"
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="Title of notification..."
                    />
                    <PremiumInput
                      label="Notification Message"
                      value={noticeContent}
                      onChange={(e) => setNoticeContent(e.target.value)}
                      placeholder="Write message content..."
                    />
                    <PremiumSelect
                      label="Announcement Urgency Type"
                      value={noticeType}
                      onChange={(val) => setNoticeType(val as any)}
                      options={[
                        { value: "info", label: "Information Banner" },
                        { value: "warning", label: "System Warning Indicator" },
                        { value: "emergency", label: "Emergency Red Pulse Alert" }
                      ]}
                    />
 
                    <PremiumButton
                      onClick={handleCreateNotice}
                      variant="primary"
                      className="w-full font-bold py-3.5 rounded-xl shadow-md"
                      withNeonGlow
                    >
                      Publish Announcement
                    </PremiumButton>
                  </div>
                </PremiumCard>
              </div>
            </motion.div>
          )}
 
          {/* TAB 6: Active Safety Reports (Case resolution) */}
          {tab === "reports" && (
            <motion.div
              key="reports-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2">
                  Safety Violation Cases
                </h2>
 
                <div className="space-y-4 pt-2">
                  {reports.map((report) => {
                    const reporter = users.find((u) => u.id === report.reporter_id);
                    const reported = users.find((u) => u.id === report.reported_id);
 
                    return (
                      <div key={report.id} className="rounded-2xl bg-brand-secondary/60 p-5 border border-brand-border space-y-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-3">
                          
                          <div className="flex flex-wrap items-center gap-2 select-none">
                            <p className="font-bold text-brand-danger text-sm">
                              {report.reason}
                            </p>
                            
                            <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                              report.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/15 animate-pulse" :
                              report.status === "resolved" ? "bg-green-500/10 text-[#39FF88] border border-green-500/15" :
                              "bg-brand-accent/15 text-brand-accent border border-brand-accent/20"
                            }`}>
                              {report.status}
                            </span>
                          </div>
 
                          <div className="space-y-1 text-xs text-brand-text-secondary leading-normal font-semibold">
                            <p>
                              Reporter Profile: <span className="text-white">@{reporter?.anonymous_username || "Anonymous User"}</span> ({reporter?.real_email || "Email hidden"})
                            </p>
                            <p>
                              Accused Profile: <span className="text-brand-danger">@{reported?.anonymous_username || "Anonymous User"}</span> ({reported?.real_email || "Email hidden"})
                            </p>
                          </div>
 
                          {report.details && (
                            <div className="rounded-xl bg-brand-surface p-3.5 border border-brand-border max-w-lg shadow-inner">
                              <span className="text-[8px] font-black text-brand-text-secondary uppercase select-none tracking-wider">Reporter Statement</span>
                              <p className="text-xs text-brand-text-secondary italic leading-relaxed mt-1 font-semibold">&quot;{report.details}&quot;</p>
                            </div>
                          )}
 
                          <p className="text-[9px] font-black text-brand-text-secondary/60 select-none uppercase tracking-wider">
                            Filed: {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
 
                        {/* Status updates buttons */}
                        <div className="flex gap-2 shrink-0 md:self-center">
                          <PremiumButton
                            onClick={() => handleResolveReport(report, "reviewed")}
                            variant="secondary"
                            className="py-1.5 px-3.5 text-[10px] rounded-xl"
                          >
                            Mark Reviewed
                          </PremiumButton>
 
                          <PremiumButton
                            onClick={() => handleResolveReport(report, "resolved")}
                            variant="accent"
                            className="py-1.5 px-3.5 text-[10px] rounded-xl"
                          >
                            Resolve Case
                          </PremiumButton>
                        </div>
                      </div>
                    );
                  })}
                  {reports.length === 0 && (
                    <p className="text-center text-xs text-brand-text-secondary italic py-12">No reports filed.</p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}
 
          {/* TAB 7: Activity Logs */}
          {tab === "logs" && (
            <motion.div
              key="logs-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-brand-border bg-brand-surface/75 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-brand-accent border-b border-brand-border pb-2">
                  System Administrative audit trail
                </h2>
 
                <div className="space-y-3 pt-2">
                  {adminLogs.map((log) => (
                    <div key={log.id} className="rounded-xl bg-brand-secondary/60 p-4 border border-brand-border text-xs space-y-1.5">
                      <div className="flex items-center justify-between select-none">
                        <p className="font-bold text-brand-accent tracking-wide uppercase text-[10px]">{log.action}</p>
                        <span className="text-[9px] text-brand-text-secondary font-semibold">
                          {new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-white font-semibold leading-relaxed">{log.details}</p>
                      <p className="text-[9px] text-brand-text-secondary/60 uppercase font-black tracking-wider">
                        Issued Admin Email: {log.admin_email}
                      </p>
                    </div>
                  ))}
                  {adminLogs.length === 0 && (
                    <p className="text-center text-xs text-brand-text-secondary italic py-12">No operations logged.</p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}
 
        </AnimatePresence>
 
      </section>
    </main>
  );
}