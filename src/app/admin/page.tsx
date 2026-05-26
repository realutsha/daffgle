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
  Skeleton, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Search, Users, AlertTriangle, ShieldAlert, FileText, ChevronRight, Activity, ArrowRightLeft } from "lucide-react";

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
  real_email?: string | null;
  realEmail?: string | null;
  email?: string | null;
  auth_email?: string | null;
  user_email?: string | null;
  last_seen: string;
  last_login_at?: string | null;
  created_at: string;
  karma: number;
  profile_edit_count: number;
  last_profile_edit_at?: string | null;
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

type Log = {
  id: string;
  admin_id: string;
  target_user_id: string;
  action: string;
  details: string | null;
  created_at: string;
};

const WARNING_BADGES = [
  { value: "", label: "No Warning Badge" },
  { value: "Under Investigation", label: "Under Investigation" },
  { value: "Reported User", label: "Reported User" },
  { value: "Fake Helper Suspected", label: "Fake Helper Suspected" }
];

function formatDate(date?: string | null) {
  if (!date) return "Unknown";
  return new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "users" | "reports" | "logs">("overview");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((user) => {
      return (
        user.anonymous_username?.toLowerCase().includes(q) ||
        user.department?.toLowerCase().includes(q) ||
        user.real_email?.toLowerCase().includes(q) ||
        user.hall?.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const pendingReports = reports.filter((report) => report.status === "pending");

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setMessage("");

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

    // Fetch profiles
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profileError) {
      setMessage("Failed to load users.");
      setLoading(false);
      return;
    }

    // Securely fetch real emails from our server admin endpoint
    let emailLookup: Record<string, string> = {};
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (token) {
        const res = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const apiData = await res.json();
        
        if (apiData.success && apiData.emails) {
          emailLookup = apiData.emails;
        }
      }
    } catch (err) {
      console.error("[Admin Page] Failed to load real emails from API:", err);
    }

    const mergedUsers =
      profileData?.map((profile: Record<string, any>) => {
        const profileId = String(profile.id || "").trim().toLowerCase();
        const realEmail = emailLookup[profileId] || "Not stored";
        
        return {
          ...profile,
          id: profileId,
          anonymous_username: String(profile.anonymous_username || ""),
          department: String(profile.department || ""),
          gender: String(profile.gender || ""),
          hall: profile.hall ? String(profile.hall) : undefined,
          is_online: Boolean(profile.is_online),
          is_admin: Boolean(profile.is_admin),
          is_banned: Boolean(profile.is_banned),
          is_muted: Boolean(profile.is_muted),
          real_email: realEmail,
          realEmail: realEmail,
          email: realEmail,
          auth_email: realEmail,
          user_email: realEmail,
          last_seen: String(profile.last_seen || ""),
          last_login_at: profile.last_login_at ? String(profile.last_login_at) : null,
          created_at: String(profile.created_at || ""),
          karma: Number(profile.karma || 0),
          profile_edit_count: Number(profile.profile_edit_count || 0),
          last_profile_edit_at: profile.last_profile_edit_at ? String(profile.last_profile_edit_at) : null,
          warning_badge: profile.warning_badge ? String(profile.warning_badge) : null,
        };
      }) as UserRow[] || [];

    setUsers(mergedUsers);

    // Fetch reports
    const { data: reportData } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    setReports(reportData || []);

    // Fetch logs
    const { data: logData } = await supabase
      .from("moderation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    setLogs(logData || []);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const writeLog = async (
    targetUserId: string,
    action: string,
    details?: string
  ) => {
    await supabase.from("moderation_logs").insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action,
      details: details || null,
    });
  };

  const toggleBan = async (user: UserRow, banType: "temp" | "perm" | "unban") => {
    let nextValue = false;
    let actionLabel = "";
    let logMsg = "";

    if (banType === "temp") {
      nextValue = true;
      actionLabel = "TEMP_BAN_USER";
      logMsg = `${user.anonymous_username} was temporarily banned (7 days)`;
    } else if (banType === "perm") {
      nextValue = true;
      actionLabel = "PERM_BAN_USER";
      logMsg = `${user.anonymous_username} was permanently banned`;
    } else {
      nextValue = false;
      actionLabel = "UNBAN_USER";
      logMsg = `${user.anonymous_username} was unbanned`;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: nextValue })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update ban status: " + error.message);
      return;
    }

    await writeLog(user.id, actionLabel, logMsg);
    toast.success(`User ban status updated: ${banType}`);
    loadAdmin();
  };

  const toggleMute = async (user: UserRow) => {
    const nextValue = !user.is_muted;

    const { error } = await supabase
      .from("profiles")
      .update({ is_muted: nextValue })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update mute status: " + error.message);
      return;
    }

    await writeLog(
      user.id,
      nextValue ? "MUTE_USER" : "UNMUTE_USER",
      `${user.anonymous_username} was ${nextValue ? "muted" : "unmuted"}`
    );

    toast.success(nextValue ? "User muted." : "User unmuted.");
    loadAdmin();
  };

  const setWarningBadge = async (user: UserRow, badge: "Under Investigation" | "Reported User" | "Fake Helper Suspected" | null) => {
    const { error } = await supabase
      .from("profiles")
      .update({ warning_badge: badge })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to set warning badge: " + error.message);
      return;
    }

    await writeLog(
      user.id,
      badge ? "WARN_USER_BADGE" : "CLEAR_USER_BADGE",
      `${user.anonymous_username} warning badge updated to: ${badge || "CLEARED"}`
    );

    if (badge) {
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin-warning",
          targetUserId: user.id
        })
      }).catch((err) => console.error("Failed to dispatch push warning:", err));
    }

    toast.success(badge ? `Warning badge set: "${badge}"` : "Warning badge cleared!");
    loadAdmin();
  };

  const adjustKarma = async (user: UserRow, amount: number) => {
    const nextKarma = Math.max(0, user.karma + amount);

    const { error } = await supabase
      .from("profiles")
      .update({ karma: nextKarma })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to adjust karma: " + error.message);
      return;
    }

    await writeLog(
      user.id,
      amount < 0 ? "DEDUCT_KARMA" : "ADD_KARMA",
      `${user.anonymous_username} karma adjusted by ${amount} (New value: ${nextKarma})`
    );

    toast.success(`Karma adjusted by ${amount}.`);
    loadAdmin();
  };

  const updateReportStatus = async (report: Report, status: string) => {
    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", report.id);

    if (error) {
      toast.error("Failed to update report status: " + error.message);
      return;
    }

    await writeLog(
      report.reported_id,
      `REPORT_${status.toUpperCase()}`,
      `Report ${report.id} marked as ${status}`
    );

    fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "report-update",
        targetUserId: report.reporter_id,
        status: status
      })
    }).catch((err) => console.error("Failed to dispatch push report update:", err));

    toast.success(`Report status marked as ${status}.`);
    loadAdmin();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#111111] text-white flex items-center justify-center pt-safe">
        <div className="flex flex-col items-center gap-3 animate-pulse select-none">
          <div className="h-10 w-10 rounded-full border-4 border-white/5 border-t-brand-accent animate-spin" />
          <p className="text-sm text-brand-text-secondary font-medium">Entering Daffgle Admin Panel...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#111111] text-brand-text-primary pt-safe pb-24">
      
      {/* Header */}
      <header className="border-b border-white/5 bg-[#1A1A1A] p-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2 select-none">
              Daffgle Admin <ShieldCheck className="h-6 w-6 text-brand-accent" />
            </h1>
            <p className="text-xs text-brand-text-secondary mt-0.5 select-none uppercase tracking-wider font-semibold">
              Safety, moderation, and user identity control center
            </p>
          </div>

          <div className="flex gap-2">
            <PremiumButton
              onClick={() => router.push("/dashboard")}
              variant="secondary"
              className="py-2 px-4 text-xs font-bold rounded-xl"
            >
              User App
            </PremiumButton>

            <PremiumButton
              onClick={logout}
              variant="danger"
              className="py-2 px-4 text-xs font-bold rounded-xl"
            >
              Logout
            </PremiumButton>
          </div>
        </div>
      </header>

      {message && (
        <div className="bg-[#2B5278]/25 border-b border-brand-accent/15 px-4 py-2 text-center text-xs font-bold text-[#C9D7F2] animate-pulse">
          {message}
        </div>
      )}

      <section className="mx-auto max-w-7xl p-5 space-y-6">
        
        {/* Stat Cards Overview */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 select-none">
          <PremiumCard className="p-5 border-white/5 bg-brand-surface shadow-md">
            <p className="text-3xl font-black text-brand-accent">{users.length}</p>
            <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mt-1">Total Users</p>
          </PremiumCard>

          <PremiumCard className="p-5 border-white/5 bg-brand-surface shadow-md">
            <p className="text-3xl font-black text-green-400">
              {users.filter((user) => isUserActuallyOnline(user.is_online, user.last_seen)).length}
            </p>
            <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mt-1">Online Now</p>
          </PremiumCard>

          <PremiumCard className="p-5 border-white/5 bg-brand-surface shadow-md animate-pulse-glow border-yellow-500/10">
            <p className="text-3xl font-black text-yellow-400">
              {pendingReports.length}
            </p>
            <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mt-1">Pending Reports</p>
          </PremiumCard>

          <PremiumCard className="p-5 border-white/5 bg-brand-surface shadow-md">
            <p className="text-3xl font-black text-red-400">
              {users.filter((user) => user.is_banned).length}
            </p>
            <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mt-1">Banned Accounts</p>
          </PremiumCard>
        </div>

        {/* Tab selection pills */}
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-brand-surface p-1.5 border border-white/5 shadow-inner select-none max-w-lg">
          {["overview", "users", "reports", "logs"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item as typeof tab)}
              className={`rounded-xl py-2.5 text-xs font-bold capitalize cursor-pointer transition select-none ${
                tab === item ? "bg-brand-accent text-brand-primary font-black shadow-md shadow-brand-accent/15" : "text-brand-text-secondary hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          
          {/* Tab: Overview Panel */}
          {tab === "overview" && (
            <motion.div
              key="overview-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <PremiumCard className="p-6 border-white/5 bg-brand-surface shadow-xl space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-1.5 select-none">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  Recent Pending Reports
                </h2>

                <div className="space-y-3">
                  {reports.slice(0, 5).map((report) => (
                    <div
                      key={report.id}
                      className="rounded-2xl bg-brand-secondary p-4 text-xs border border-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between select-none">
                        <p className="font-bold text-red-400">{report.reason}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary">{report.status}</p>
                      </div>
                      <p className="text-[10px] text-brand-text-secondary">
                        Filed: {formatDate(report.created_at)}
                      </p>
                    </div>
                  ))}

                  {reports.length === 0 && (
                    <p className="text-xs text-brand-text-secondary italic">No reports filed yet.</p>
                  )}
                </div>
              </PremiumCard>

              <PremiumCard className="p-6 border-white/5 bg-brand-surface shadow-xl space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-1.5 select-none">
                  <Activity className="h-5 w-5 text-brand-accent" />
                  Recent Moderation Logs
                </h2>

                <div className="space-y-3">
                  {logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl bg-brand-secondary p-4 text-xs border border-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between select-none">
                        <p className="font-bold text-white/95">{log.action}</p>
                        <span className="text-[9px] text-brand-text-secondary">{formatDate(log.created_at)}</span>
                      </div>
                      <p className="text-xs text-brand-text-secondary leading-normal">{log.details}</p>
                    </div>
                  ))}

                  {logs.length === 0 && (
                    <p className="text-xs text-brand-text-secondary italic">No log entries recorded yet.</p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}

          {/* Tab: Users Identity Map */}
          {tab === "users" && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-white/5 bg-brand-surface shadow-xl space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Registered Identity Map
                    </h2>
                    <p className="text-xs text-brand-text-secondary mt-1 select-none">
                      Map anonymous profiles to verified university emails.
                    </p>
                  </div>

                  <PremiumInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search username, email, department, hall..."
                    leftIcon={<Search className="h-4 w-4 opacity-50" />}
                    containerClassName="w-full md:w-96"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="rounded-2xl bg-brand-secondary p-5 border border-white/5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 select-none">
                          <p className="text-base font-bold text-white">
                            @{user.anonymous_username || "Not set"}
                          </p>

                          {user.warning_badge && (
                            <span className="rounded-full bg-red-500/10 border border-red-500/15 px-2.5 py-0.5 text-[8px] font-bold text-red-400 animate-pulse uppercase">
                              ⚠️ {user.warning_badge}
                            </span>
                          )}

                          <span className="rounded-full bg-brand-accent/15 px-2.5 py-0.5 text-[9px] font-bold text-[#C9D7F2]">
                            {user.karma} Karma
                          </span>

                          {user.is_admin && (
                            <span className="rounded-full bg-brand-accent px-2.5 py-0.5 text-[9px] font-black text-brand-primary">
                              Admin
                            </span>
                          )}

                          {user.is_banned && (
                            <span className="rounded-full bg-red-500/15 border border-red-500/20 px-2.5 py-0.5 text-[9px] font-bold text-red-300">
                              Banned
                            </span>
                          )}

                          {user.is_muted && (
                            <span className="rounded-full bg-yellow-500/10 border border-yellow-500/15 px-2.5 py-0.5 text-[9px] font-bold text-yellow-300">
                              Muted
                            </span>
                          )}

                          {isUserActuallyOnline(user.is_online, user.last_seen) && (
                            <span className="rounded-full bg-green-500/10 border border-green-500/15 px-2.5 py-0.5 text-[9px] font-bold text-green-300">
                              Online
                            </span>
                          )}
                        </div>

                        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-xs text-brand-text-secondary leading-normal">
                          <p>Verified Student Email: <span className="text-white font-medium">{user.real_email || "Not stored"}</span></p>
                          <p>Department / Gender: <span className="text-white font-medium">{user.department} • {user.gender}</span></p>
                          <p>Residence Hall: <span className="text-white font-medium">{user.hall || "Not set"}</span></p>
                          <p>Profile Edit logs: <span className="text-white font-medium">{user.profile_edit_count} edits used</span></p>
                          <p className="sm:col-span-2 text-brand-text-secondary/60 text-[10px] select-none uppercase tracking-wider font-semibold">Joined: {formatDate(user.created_at)} | Last seen: {formatDate(user.last_seen)}</p>
                        </div>
                      </div>

                      {/* Moderation Controls actions */}
                      <div className="flex flex-wrap gap-2 lg:self-center shrink-0">
                        
                        {/* Warning badge selectors */}
                        <PremiumSelect
                          value={user.warning_badge || ""}
                          onChange={(val) => setWarningBadge(user, val ? val as any : null)}
                          options={WARNING_BADGES}
                          disabled={user.is_admin}
                          containerClassName="min-w-44"
                        />

                        {/* Karma deductions */}
                        <PremiumButton
                          onClick={() => adjustKarma(user, -5)}
                          disabled={user.is_admin}
                          variant="danger"
                          className="py-1.5 px-3 rounded-xl text-xs"
                        >
                          -5 Karma
                        </PremiumButton>

                        <PremiumButton
                          onClick={() => adjustKarma(user, 1)}
                          disabled={user.is_admin}
                          variant="accent"
                          className="py-1.5 px-3 rounded-xl text-xs"
                        >
                          +1 Karma
                        </PremiumButton>

                        {/* Muting */}
                        <PremiumButton
                          onClick={() => toggleMute(user)}
                          disabled={user.is_admin}
                          variant="secondary"
                          className="py-1.5 px-3 rounded-xl text-xs font-semibold"
                        >
                          {user.is_muted ? "Unmute" : "Mute"}
                        </PremiumButton>

                        {/* Bans */}
                        {user.is_banned ? (
                          <PremiumButton
                            onClick={() => toggleBan(user, "unban")}
                            disabled={user.is_admin}
                            variant="primary"
                            className="py-1.5 px-3 rounded-xl text-xs font-bold"
                          >
                            Unban
                          </PremiumButton>
                        ) : (
                          <>
                            <PremiumButton
                              onClick={() => toggleBan(user, "temp")}
                              disabled={user.is_admin}
                              variant="secondary"
                              className="py-1.5 px-3 rounded-xl text-xs text-orange-400 hover:text-orange-300"
                            >
                              Temp Ban
                            </PremiumButton>
                            
                            <PremiumButton
                              onClick={() => toggleBan(user, "perm")}
                              disabled={user.is_admin}
                              variant="danger"
                              className="py-1.5 px-3 rounded-xl text-xs font-bold"
                            >
                              Perm Ban
                            </PremiumButton>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredUsers.length === 0 && (
                    <p className="text-center text-xs text-brand-text-secondary italic py-12">
                      No registered students match your search criteria.
                    </p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}

          {/* Tab: Active Reports */}
          {tab === "reports" && (
            <motion.div
              key="reports-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-white/5 bg-brand-surface shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white select-none">
                  Safety Violation Reports
                </h2>

                <div className="space-y-4 pt-2">
                  {reports.map((report) => {
                    const reporter = users.find((u) => u.id === report.reporter_id);
                    const reported = users.find((u) => u.id === report.reported_id);
                    const accusedReportCount = reports.filter((r) => r.reported_id === report.reported_id).length;

                    return (
                      <div key={report.id} className="rounded-2xl bg-brand-secondary p-5 border border-white/5 space-y-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-3">
                          
                          <div className="flex flex-wrap items-center gap-2 select-none">
                            <p className="font-bold text-red-400 text-sm">
                              {report.reason}
                            </p>
                            
                            <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                              report.status === "pending" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/15" :
                              report.status === "resolved" ? "bg-green-500/10 text-green-400 border border-green-500/15" :
                              "bg-brand-accent/15 text-brand-accent border border-brand-accent/20"
                            }`}>
                              {report.status}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-brand-text-secondary leading-normal">
                            <p>
                              Reporter: <span className="text-white font-medium">@{reporter?.anonymous_username || "Unknown"}</span> ({reporter?.real_email || "Email hidden"})
                            </p>
                            <p>
                              Accused User: <span className="text-red-400 font-bold">@{reported?.anonymous_username || "Unknown"}</span> ({reported?.real_email || "Email hidden"}) • <span className="text-white font-semibold">{reported?.karma ?? 0} Karma</span>
                            </p>
                            <p className="text-[10px] text-red-400 font-bold bg-red-500/5 px-2 py-1 rounded border border-red-500/10 max-w-xs select-none uppercase tracking-wide">
                              ⚠️ Accused history: {accusedReportCount} total reports filed.
                            </p>
                          </div>

                          {report.details && (
                            <div className="rounded-xl bg-brand-surface p-3.5 border border-white/5 space-y-1 max-w-lg">
                              <span className="text-[9px] font-bold text-brand-text-secondary uppercase select-none tracking-wider">Reporter Audit Statement</span>
                              <p className="text-xs text-brand-text-secondary italic leading-relaxed">&quot;{report.details}&quot;</p>
                            </div>
                          )}

                          {/* Audit logs links */}
                          <div className="flex flex-wrap gap-2 pt-1 select-none">
                            {report.conversation_id ? (
                              <PremiumButton
                                onClick={() => {
                                  toast.info("Redirecting to conversation room audit...");
                                  router.push(`/chat/${report.conversation_id}`);
                                }}
                                variant="accent"
                                className="py-1 px-2.5 rounded-lg text-[10px] font-bold"
                              >
                                💬 Audit Linked Chat Log
                              </PremiumButton>
                            ) : (
                              <span className="rounded-lg bg-brand-surface border border-white/5 px-3 py-1.5 text-[10px] text-brand-text-secondary italic">
                                No chat log linked
                              </span>
                            )}

                            {report.request_id ? (
                              <span className="rounded-lg bg-brand-surface border border-white/5 px-3 py-1.5 text-[10px] text-brand-text-secondary font-semibold">
                                📦 Linked Request: {report.request_id}
                              </span>
                            ) : (
                              <span className="rounded-lg bg-brand-surface border border-white/5 px-3 py-1.5 text-[10px] text-brand-text-secondary italic">
                                No request linked
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] font-semibold text-brand-text-secondary/60 select-none uppercase tracking-wider">
                            Filed: {formatDate(report.created_at)}
                          </p>
                        </div>

                        {/* Status updates */}
                        <div className="flex gap-2 shrink-0 md:self-center">
                          <PremiumButton
                            onClick={() => updateReportStatus(report, "reviewed")}
                            variant="secondary"
                            className="py-1.5 px-3.5 text-xs font-bold rounded-xl"
                          >
                            Reviewed
                          </PremiumButton>

                          <PremiumButton
                            onClick={() => updateReportStatus(report, "resolved")}
                            variant="accent"
                            className="py-1.5 px-3.5 text-xs font-bold rounded-xl"
                          >
                            Resolve Case
                          </PremiumButton>
                        </div>
                      </div>
                    );
                  })}

                  {reports.length === 0 && (
                    <p className="text-center text-xs text-brand-text-secondary italic py-12">
                      No reports filed yet.
                    </p>
                  )}
                </div>
              </PremiumCard>
            </motion.div>
          )}

          {/* Tab: Activity Logs */}
          {tab === "logs" && (
            <motion.div
              key="logs-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-6"
            >
              <PremiumCard className="p-6 border-white/5 bg-brand-surface shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white select-none">
                  Moderation Activity Logs
                </h2>

                <div className="space-y-3 pt-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl bg-brand-secondary p-4 text-xs border border-white/5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between select-none">
                        <p className="font-bold text-[#C9D7F2]">{log.action}</p>
                        <span className="text-[9px] text-brand-text-secondary">{formatDate(log.created_at)}</span>
                      </div>
                      <p className="text-xs text-brand-text-secondary leading-normal">{log.details}</p>
                    </div>
                  ))}

                  {logs.length === 0 && (
                    <p className="text-center text-xs text-brand-text-secondary italic py-12">
                      No log entries recorded yet.
                    </p>
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