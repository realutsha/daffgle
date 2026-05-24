"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  is_online: boolean;
  is_admin: boolean;
  is_banned: boolean;
  is_muted: boolean;
  real_email?: string | null;
  last_seen: string;
  last_login_at?: string | null;
  created_at: string;
};

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
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
  const [tab, setTab] = useState<"overview" | "users" | "reports" | "logs">(
    "overview"
  );
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();

    return users.filter((user) => {
      return (
        user.anonymous_username?.toLowerCase().includes(q) ||
        user.department?.toLowerCase().includes(q) ||
        user.real_email?.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const pendingReports = reports.filter((report) => report.status === "pending");

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
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
      router.push("/dashboard");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profileError) {
      setMessage("Failed to load users.");
      setLoading(false);
      return;
    }

    const mergedUsers =
      profileData?.map((profile: UserRow) => ({
        ...profile,
        real_email: profile.real_email || "Not stored",
      })) || [];

    setUsers(mergedUsers);

    const { data: reportData } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    setReports(reportData || []);

    const { data: logData } = await supabase
      .from("moderation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

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

  const toggleBan = async (user: UserRow) => {
    const nextValue = !user.is_banned;

    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: nextValue })
      .eq("id", user.id);

    if (error) {
      setMessage("Failed to update ban status.");
      return;
    }

    await writeLog(
      user.id,
      nextValue ? "BAN_USER" : "UNBAN_USER",
      `${user.anonymous_username} was ${nextValue ? "banned" : "unbanned"}`
    );

    setMessage(nextValue ? "User banned." : "User unbanned.");
    loadAdmin();
  };

  const toggleMute = async (user: UserRow) => {
    const nextValue = !user.is_muted;

    const { error } = await supabase
      .from("profiles")
      .update({ is_muted: nextValue })
      .eq("id", user.id);

    if (error) {
      setMessage("Failed to update mute status.");
      return;
    }

    await writeLog(
      user.id,
      nextValue ? "MUTE_USER" : "UNMUTE_USER",
      `${user.anonymous_username} was ${nextValue ? "muted" : "unmuted"}`
    );

    setMessage(nextValue ? "User muted." : "User unmuted.");
    loadAdmin();
  };

  const updateReportStatus = async (report: Report, status: string) => {
    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", report.id);

    if (error) {
      setMessage("Failed to update report.");
      return;
    }

    await writeLog(
      report.reported_id,
      `REPORT_${status.toUpperCase()}`,
      `Report ${report.id} marked as ${status}`
    );

    setMessage(`Report marked as ${status}.`);
    loadAdmin();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#0E1621] text-white">
        {/* Header Skeleton */}
        <header className="border-b border-[#22303D] bg-[#17212B] p-5">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 animate-pulse rounded bg-[#2AABEE]/20" />
              <div className="h-4 w-72 animate-pulse rounded bg-gray-600/30" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-24 animate-pulse rounded-xl bg-[#0F1A24] border border-[#22303D]/30" />
              <div className="h-10 w-20 animate-pulse rounded-xl bg-[#2B5278]/25" />
              <div className="h-10 w-20 animate-pulse rounded-xl bg-red-900/20" />
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl p-5 space-y-6">
          {/* Stat Grid Skeletons */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-[#17212B] p-5 border border-[#22303D]/10 space-y-3">
                <div className="h-9 w-12 animate-pulse rounded bg-[#2AABEE]/20" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-600/30" />
              </div>
            ))}
          </div>

          {/* Navigation Bar Skeleton */}
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#17212B] p-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-[#0F1A24]/60" />
            ))}
          </div>

          {/* Content Lists Skeleton */}
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2].map((panel) => (
              <div key={panel} className="rounded-2xl bg-[#17212B] p-5 space-y-4">
                <div className="h-6 w-36 animate-pulse rounded bg-[#2AABEE]/20 mb-2" />
                {[1, 2, 3].map((row) => (
                  <div key={row} className="rounded-xl bg-[#0F1A24] p-4 space-y-2 border border-[#22303D]/10">
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-500/25" />
                    <div className="h-3 w-[70%] animate-pulse rounded bg-gray-500/15" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-gray-600/20" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
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
              className="rounded-xl bg-[#0F1A24] px-4 py-2 text-sm hover:bg-[#182533]"
            >
              User App
            </button>

            <button
              onClick={loadAdmin}
              className="rounded-xl bg-[#2B5278] px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="rounded-xl bg-red-900/50 px-4 py-2 text-sm text-red-200 hover:bg-red-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div className="bg-[#2B5278] px-4 py-2 text-center text-sm">
          {message}
        </div>
      )}

      <section className="mx-auto max-w-7xl p-5">
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-[#17212B] p-5">
            <p className="text-3xl font-bold text-[#2AABEE]">{users.length}</p>
            <p className="text-sm text-gray-400">Total users</p>
          </div>

          <div className="rounded-2xl bg-[#17212B] p-5">
            <p className="text-3xl font-bold text-green-400">
              {users.filter((user) => isUserActuallyOnline(user.is_online, user.last_seen)).length}
            </p>
            <p className="text-sm text-gray-400">Online</p>
          </div>

          <div className="rounded-2xl bg-[#17212B] p-5">
            <p className="text-3xl font-bold text-yellow-400">
              {pendingReports.length}
            </p>
            <p className="text-sm text-gray-400">Pending reports</p>
          </div>

          <div className="rounded-2xl bg-[#17212B] p-5">
            <p className="text-3xl font-bold text-red-400">
              {users.filter((user) => user.is_banned).length}
            </p>
            <p className="text-sm text-gray-400">Banned</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-2 rounded-2xl bg-[#17212B] p-2">
          {["overview", "users", "reports", "logs"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item as typeof tab)}
              className={`rounded-xl py-3 text-sm font-semibold capitalize ${
                tab === item ? "bg-[#2AABEE]" : "bg-[#0F1A24]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-[#17212B] p-5">
              <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
                Recent Reports
              </h2>

              <div className="space-y-3">
                {reports.slice(0, 5).map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl bg-[#0F1A24] p-4 text-sm"
                  >
                    <p className="font-semibold">{report.reason}</p>
                    <p className="text-gray-400">{report.status}</p>
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

            <div className="rounded-2xl bg-[#17212B] p-5">
              <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
                Recent Moderation Logs
              </h2>

              <div className="space-y-3">
                {logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl bg-[#0F1A24] p-4 text-sm"
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

        {tab === "users" && (
          <div className="rounded-2xl bg-[#17212B] p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-bold text-[#2AABEE]">
                User Identity Map
              </h2>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username, email, department..."
                className="w-full rounded-2xl bg-[#0F1A24] px-4 py-3 text-sm outline-none placeholder:text-gray-500 md:w-96"
              />
            </div>

            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="rounded-2xl bg-[#0F1A24] p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold">
                          {user.anonymous_username}
                        </p>

                        {user.is_admin && (
                          <span className="rounded-full bg-[#2AABEE] px-2 py-1 text-xs">
                            Admin
                          </span>
                        )}

                        {user.is_banned && (
                          <span className="rounded-full bg-red-900 px-2 py-1 text-xs text-red-200">
                            Banned
                          </span>
                        )}

                        {user.is_muted && (
                          <span className="rounded-full bg-yellow-900 px-2 py-1 text-xs text-yellow-200">
                            Muted
                          </span>
                        )}

                         {isUserActuallyOnline(user.is_online, user.last_seen) && (
                           <span className="rounded-full bg-green-900 px-2 py-1 text-xs text-green-200">
                             Online
                           </span>
                         )}
                      </div>

                      <p className="mt-1 text-sm text-gray-400">
                        Real email:{" "}
                        <span className="text-white">
                          {user.real_email || "Not stored"}
                        </span>
                      </p>

                      <p className="text-sm text-gray-400">
                        Department: {user.department} | Gender: {user.gender}
                      </p>

                      <p className="text-xs text-gray-500">
                        Last login: {formatDate(user.last_login_at)}
                      </p>

                      <p className="text-xs text-gray-500">
                        Last seen: {formatDate(user.last_seen)}
                      </p>

                      <p className="text-xs text-gray-500">
                        Joined: {formatDate(user.created_at)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleMute(user)}
                        disabled={user.is_admin}
                        className="rounded-xl bg-yellow-900/60 px-4 py-2 text-sm text-yellow-100 disabled:opacity-40"
                      >
                        {user.is_muted ? "Unmute" : "Mute"}
                      </button>

                      <button
                        onClick={() => toggleBan(user)}
                        disabled={user.is_admin}
                        className="rounded-xl bg-red-900/60 px-4 py-2 text-sm text-red-100 disabled:opacity-40"
                      >
                        {user.is_banned ? "Unban" : "Ban"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <p className="text-center text-sm text-gray-400">
                  No users found.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="rounded-2xl bg-[#17212B] p-5">
            <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">Reports</h2>

            <div className="space-y-3">
              {reports.map((report) => {
                const reporter = users.find(
                  (user) => user.id === report.reporter_id
                );
                const reported = users.find(
                  (user) => user.id === report.reported_id
                );

                return (
                  <div key={report.id} className="rounded-2xl bg-[#0F1A24] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-bold text-red-300">
                          {report.reason}
                        </p>

                        <p className="text-sm text-gray-400">
                          Reporter: {reporter?.anonymous_username || "Unknown"} |{" "}
                          {reporter?.real_email || "Not stored"}
                        </p>

                        <p className="text-sm text-gray-400">
                          Reported: {reported?.anonymous_username || "Unknown"} |{" "}
                          {reported?.real_email || "Not stored"}
                        </p>

                        {report.details && (
                          <p className="mt-2 text-sm text-gray-300">
                            {report.details}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-gray-500">
                          Status: {report.status} |{" "}
                          {formatDate(report.created_at)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => updateReportStatus(report, "reviewed")}
                          className="rounded-xl bg-[#2B5278] px-4 py-2 text-sm"
                        >
                          Reviewed
                        </button>

                        <button
                          onClick={() => updateReportStatus(report, "resolved")}
                          className="rounded-xl bg-green-900/60 px-4 py-2 text-sm text-green-100"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {reports.length === 0 && (
                <p className="text-center text-sm text-gray-400">
                  No reports yet.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div className="rounded-2xl bg-[#17212B] p-5">
            <h2 className="mb-4 text-xl font-bold text-[#2AABEE]">
              Moderation Logs
            </h2>

            <div className="space-y-3">
              {logs.map((log) => {
                const target = users.find(
                  (user) => user.id === log.target_user_id
                );

                return (
                  <div key={log.id} className="rounded-2xl bg-[#0F1A24] p-4">
                    <p className="font-bold">{log.action}</p>

                    <p className="text-sm text-gray-400">
                      Target: {target?.anonymous_username || log.target_user_id}
                    </p>

                    <p className="text-sm text-gray-300">{log.details}</p>

                    <p className="text-xs text-gray-500">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                );
              })}

              {logs.length === 0 && (
                <p className="text-center text-sm text-gray-400">
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