"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { isEmailAllowed } from "@/lib/validations/auth";
import { toast } from "sonner";

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

function formatDate(date?: string | null) {
  if (!date) return "Unknown";
  return new Date(date).toLocaleString();
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
      console.log("[Admin Page Debug] Access token retrieved:", token ? "YES (Length: " + token.length + ")" : "NO");
      
      if (token) {
        const res = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log("[Admin Page Debug] API response status:", res.status);
        const apiData = await res.json();
        console.log("[Admin Page Debug] API response body:", apiData);
        
        if (apiData.success && apiData.emails) {
          emailLookup = apiData.emails;
          console.log("[Admin Page Debug] Real emails loaded successfully! Count:", Object.keys(emailLookup).length);
        } else {
          console.error("[Admin Page Debug] API returned error or invalid format:", apiData);
        }
      } else {
        console.error("[Admin Page Debug] Access token is missing, cannot call admin API.");
      }
    } catch (err) {
      console.error("[Admin Page Debug] Failed to load real emails from API:", err);
    }

    const mergedUsers =
      profileData?.map((profile: Record<string, unknown>) => {
        const profileId = String(profile.id || "").trim().toLowerCase();
        const realEmail = emailLookup[profileId] || "Not stored";
        console.log(`[Admin Page Debug] Profile ID: ${profileId} -> Resolved Email: ${realEmail}`);
        
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Admin actions: warning badge setting
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

  // Admin actions: karma deduction
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
      <main className="min-h-dvh bg-[#0E1621] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-10 w-10 rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE] animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Entering Daffgle Admin Panel...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#0E1621] text-white">
      <header className="border-b border-[#22303D] bg-[#17212B] p-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#2AABEE]">
              Daffgle Admin
            </h1>
            <p className="text-sm text-gray-400">
              Safety, moderation, and user identity control center
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-[#0F1A24] px-4 py-2.5 text-sm hover:bg-[#182533] cursor-pointer"
            >
              User App
            </button>

            <button
              onClick={loadAdmin}
              className="rounded-xl bg-[#2B5278] px-4 py-2.5 text-sm font-semibold hover:opacity-90 cursor-pointer"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="rounded-xl bg-red-900/50 px-4 py-2.5 text-sm text-red-200 hover:bg-red-900 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div className="bg-[#2B5278] px-4 py-2 text-center text-sm font-bold animate-pulse">
          {message}
        </div>
      )}

      <section className="mx-auto max-w-7xl p-5">
        {/* Stat Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-[#17212B] p-5 border border-[#22303D]/60">
            <p className="text-3xl font-extrabold text-[#2AABEE]">{users.length}</p>
            <p className="text-sm text-gray-400">Total Users</p>
          </div>

          <div className="rounded-2xl bg-[#17212B] p-5 border border-[#22303D]/60">
            <p className="text-3xl font-extrabold text-green-400">
              {users.filter((user) => isUserActuallyOnline(user.is_online, user.last_seen)).length}
            </p>
            <p className="text-sm text-gray-400">Online now</p>
          </div>

          <div className="rounded-2xl bg-[#17212B] p-5 border border-[#22303D]/60">
            <p className="text-3xl font-extrabold text-yellow-400">
              {pendingReports.length}
            </p>
            <p className="text-sm text-gray-400">Pending reports</p>
          </div>

          <div className="rounded-2xl bg-[#17212B] p-5 border border-[#22303D]/60">
            <p className="text-3xl font-extrabold text-red-400">
              {users.filter((user) => user.is_banned).length}
            </p>
            <p className="text-sm text-gray-400">Banned accounts</p>
          </div>
        </div>

        {/* Tab selection */}
        <div className="mb-6 grid grid-cols-4 gap-2 rounded-2xl bg-[#17212B] p-2 border border-[#22303D]/50">
          {["overview", "users", "reports", "logs"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item as typeof tab)}
              className={`rounded-xl py-3 text-sm font-semibold capitalize cursor-pointer transition ${
                tab === item ? "bg-[#2AABEE] text-white" : "bg-[#0F1A24] text-gray-400"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === "overview" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-[#17212B] p-6 border border-[#22303D]/60">
              <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
                Recent Reports
              </h2>

              <div className="space-y-3">
                {reports.slice(0, 5).map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl bg-[#0F1A24] p-4 text-sm border border-[#22303D]/30"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{report.reason}</p>
                      <p className="text-gray-400">{report.status}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                ))}

                {reports.length === 0 && (
                  <p className="text-sm text-gray-400">No reports yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-[#17212B] p-6 border border-[#22303D]/60">
              <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
                Recent Moderation Logs
              </h2>

              <div className="space-y-3">
                {logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl bg-[#0F1A24] p-4 text-sm border border-[#22303D]/30"
                  >
                    <p className="font-semibold">{log.action}</p>
                    <p className="text-gray-400">{log.details}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                ))}

                {logs.length === 0 && (
                  <p className="text-sm text-gray-400">No logs yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Users Identity Map */}
        {tab === "users" && (
          <div className="rounded-2xl bg-[#17212B] p-6 border border-[#22303D]/60">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-bold text-[#2AABEE]">
                User Identity Map
              </h2>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username, email, department, hall..."
                className="w-full rounded-2xl bg-[#0F1A24] px-4 py-3 text-sm outline-none placeholder:text-gray-500 border border-[#22303D] md:w-96"
              />
            </div>

            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="rounded-2xl bg-[#0F1A24] p-5 border border-[#22303D]/40">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold">
                          @{user.anonymous_username || "Not set"}
                        </p>

                        {user.warning_badge && (
                          <span className="rounded-full bg-red-650/15 border border-red-500/30 px-2.5 py-0.5 text-[9px] font-bold text-red-400 animate-pulse">
                            ⚠️ {user.warning_badge}
                          </span>
                        )}

                        <span className="rounded-full bg-[#2AABEE]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#2AABEE]">
                          {user.karma} Karma
                        </span>

                        {user.is_admin && (
                          <span className="rounded-full bg-[#2AABEE] px-2 py-0.5 text-[10px] font-bold">
                            Admin
                          </span>
                        )}

                        {user.is_banned && (
                          <span className="rounded-full bg-red-950/40 border border-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-300">
                            Banned
                          </span>
                        )}

                        {user.is_muted && (
                          <span className="rounded-full bg-yellow-950/40 border border-yellow-900/40 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                            Muted
                          </span>
                        )}

                        {isUserActuallyOnline(user.is_online, user.last_seen) && (
                          <span className="rounded-full bg-green-950/40 border border-green-900/40 px-2 py-0.5 text-[10px] font-bold text-green-300">
                            Online
                          </span>
                        )}
                      </div>

                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-xs text-gray-400">
                        <p>Real Email: <span className="text-white font-medium">{user.real_email || "Not stored"}</span></p>
                        <p>Dept/Gender: <span className="text-white font-medium">{user.department} • {user.gender}</span></p>
                        <p>Hall: <span className="text-white font-medium">{user.hall || "Not set"}</span></p>
                        <p>Edits count: <span className="text-white font-medium">{user.profile_edit_count} used</span></p>
                        <p className="sm:col-span-2 text-gray-500">Joined: {formatDate(user.created_at)} | Last seen: {formatDate(user.last_seen)}</p>
                      </div>
                    </div>

                    {/* Moderation Controls */}
                    <div className="flex flex-wrap gap-2 lg:self-center shrink-0">
                      {/* Badge selectors */}
                      <select
                        value={user.warning_badge || ""}
                        onChange={(e) => setWarningBadge(user, e.target.value ? e.target.value as "Under Investigation" | "Reported User" | "Fake Helper Suspected" : null)}
                        disabled={user.is_admin}
                        className="rounded-xl border border-[#22303D] bg-[#17212B] px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-[#2AABEE] cursor-pointer"
                      >
                        <option value="">-- No Warning Badge --</option>
                        <option value="Under Investigation">Under Investigation</option>
                        <option value="Reported User">Reported User</option>
                        <option value="Fake Helper Suspected">Fake Helper Suspected</option>
                      </select>

                      {/* Karma control */}
                      <button
                        onClick={() => adjustKarma(user, -5)}
                        disabled={user.is_admin}
                        className="rounded-xl bg-red-950/20 border border-red-900/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-950/45 cursor-pointer disabled:opacity-40"
                      >
                        -5 Karma
                      </button>

                      <button
                        onClick={() => adjustKarma(user, 1)}
                        disabled={user.is_admin}
                        className="rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/25 px-3 py-1.5 text-xs font-bold text-[#2AABEE] hover:bg-[#2AABEE]/20 cursor-pointer disabled:opacity-40"
                      >
                        +1 Karma
                      </button>

                      {/* Mute Control */}
                      <button
                        onClick={() => toggleMute(user)}
                        disabled={user.is_admin}
                        className="rounded-xl bg-yellow-950/20 border border-yellow-900/30 px-3 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-950/45 cursor-pointer disabled:opacity-40"
                      >
                        {user.is_muted ? "Unmute" : "Mute"}
                      </button>

                      {/* Ban Controls */}
                      {user.is_banned ? (
                        <button
                          onClick={() => toggleBan(user, "unban")}
                          disabled={user.is_admin}
                          className="rounded-xl bg-green-950/20 border border-green-900/30 px-3 py-1.5 text-xs font-bold text-green-300 hover:bg-green-950/45 cursor-pointer"
                        >
                          Unban
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => toggleBan(user, "temp")}
                            disabled={user.is_admin}
                            className="rounded-xl bg-orange-950/20 border border-orange-900/30 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-950/45 cursor-pointer disabled:opacity-40"
                          >
                            Temp Ban
                          </button>
                          <button
                            onClick={() => toggleBan(user, "perm")}
                            disabled={user.is_admin}
                            className="rounded-xl bg-red-950/30 border border-red-900/40 px-3 py-1.5 text-xs font-black text-red-400 hover:bg-red-950/60 cursor-pointer disabled:opacity-40"
                          >
                            Perm Ban
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-12">
                  No registered student matches your query.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab: Reports list */}
        {tab === "reports" && (
          <div className="rounded-2xl bg-[#17212B] p-6 border border-[#22303D]/60">
            <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
              Reports
            </h2>

            <div className="space-y-4">
              {reports.map((report) => {
                const reporter = users.find((u) => u.id === report.reporter_id);
                const reported = users.find((u) => u.id === report.reported_id);

                // View total reports on this accused user to see history
                const accusedReportCount = reports.filter((r) => r.reported_id === report.reported_id).length;

                return (
                  <div key={report.id} className="rounded-2xl bg-[#0F1A24] p-5 border border-[#22303D]/40">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-red-300 text-base">
                            {report.reason}
                          </p>
                          <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${
                            report.status === "pending" ? "bg-yellow-950/20 text-yellow-300 border border-yellow-900/35" :
                            report.status === "resolved" ? "bg-green-950/20 text-green-300 border border-green-900/35" :
                            "bg-blue-950/20 text-blue-300 border border-blue-900/35"
                          }`}>
                            {report.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-gray-400 leading-normal">
                          <p>
                            Reporter: <span className="text-white font-medium">@{reporter?.anonymous_username || "Unknown"}</span> ({reporter?.real_email || "Email hidden"})
                          </p>
                          <p>
                            Accused User: <span className="text-red-300 font-extrabold">@{reported?.anonymous_username || "Unknown"}</span> ({reported?.real_email || "Email hidden"}) • <span className="text-white font-semibold">{reported?.karma ?? 0} Karma</span>
                          </p>
                          <p className="text-red-400/90 font-bold bg-red-950/10 px-2 py-1 rounded border border-red-900/10 max-w-sm">
                            ⚠️ Accused history: {accusedReportCount} total reports filed on this user.
                          </p>
                        </div>

                        {report.details && (
                          <div className="rounded-xl bg-[#17212B] p-3 border border-[#22303D]/50">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Reporter context details</span>
                            <p className="text-xs text-gray-300 italic">&quot;{report.details}&quot;</p>
                          </div>
                        )}

                        {/* Audit Links (Chats and Help requests) */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {report.conversation_id ? (
                            <button
                              onClick={() => {
                                toast.info("Opening secure chat audit log...");
                                router.push(`/chat/${report.conversation_id}`);
                              }}
                              className="rounded-lg bg-[#2B5278] border border-[#2AABEE]/20 px-3 py-1.5 text-[11px] font-bold text-white hover:scale-[1.01] transition cursor-pointer"
                            >
                              💬 Audit Linked Chat Log
                            </button>
                          ) : (
                            <span className="rounded-lg bg-[#17212B] border border-[#22303D]/40 px-3 py-1.5 text-[11px] text-gray-500 italic">
                              No chat log linked
                            </span>
                          )}

                          {report.request_id ? (
                            <span className="rounded-lg bg-[#17212B] border border-[#22303D]/40 px-3 py-1.5 text-[11px] text-gray-400 font-semibold">
                              📦 Linked Request ID: {report.request_id}
                            </span>
                          ) : (
                            <span className="rounded-lg bg-[#17212B] border border-[#22303D]/40 px-3 py-1.5 text-[11px] text-gray-500 italic">
                              No request linked
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-500">
                          Filed: {formatDate(report.created_at)}
                        </p>
                      </div>

                      {/* Report status toggles */}
                      <div className="flex gap-2 shrink-0 md:self-center">
                        <button
                          onClick={() => updateReportStatus(report, "reviewed")}
                          className="rounded-xl bg-[#2B5278] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                        >
                          Reviewed
                        </button>

                        <button
                          onClick={() => updateReportStatus(report, "resolved")}
                          className="rounded-xl bg-green-950/40 border border-green-900/40 px-4 py-2 text-xs font-bold text-green-300 hover:bg-green-950/60 cursor-pointer"
                        >
                          Resolve Case
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {reports.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-12">
                  No reports yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab: Moderation Logs */}
        {tab === "logs" && (
          <div className="rounded-2xl bg-[#17212B] p-6 border border-[#22303D]/60">
            <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
              Moderation Logs
            </h2>

            <div className="space-y-3">
              {logs.map((log) => {
                const target = users.find((u) => u.id === log.target_user_id);

                return (
                  <div key={log.id} className="rounded-2xl bg-[#0F1A24] p-4 border border-[#22303D]/20">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{log.action}</p>
                      <span className="text-[10px] text-gray-500">{formatDate(log.created_at)}</span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      Target: <span className="text-white font-medium">@{target?.anonymous_username || log.target_user_id}</span>
                    </p>

                    <p className="text-xs text-gray-300 mt-1 italic">
                      &quot;{log.details}&quot;
                    </p>
                  </div>
                );
              })}

              {logs.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-12">
                  No moderation logs yet.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}