"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  hall?: string;
  karma: number;
  notification_enabled: boolean;
  warning_badge?: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [updatingNotification, setUpdatingNotification] = useState(false);

  useEffect(() => {
    const initHome = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user || !isEmailAllowed(userData.user.email)) {
          if (userData.user) {
            await supabase.auth.signOut();
          }
          router.replace("/login?error=domain_restricted");
          return;
        }

        const myId = userData.user.id;
        setUserId(myId);
        await setUserOnline(myId);

        // Fetch profile using unified safe utility
        const { data: profileData } = await fetchProfileSafely(myId);

        const complete = isProfileComplete(profileData);

        if (!complete) {
          toast.error("Please complete your profile setup first!");
          router.replace("/auth/setup");
          return;
        }

        setProfile(profileData as Profile);
      } catch (err) {
        console.error("Home initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initHome();
  }, [router]);

  const handleToggleNotification = async () => {
    if (!profile || updatingNotification) return;

    try {
      setUpdatingNotification(true);
      const nextValue = !profile.notification_enabled;

      const { error } = await supabase
        .from("profiles")
        .update({ notification_enabled: nextValue })
        .eq("id", userId);

      if (error) {
        toast.error("Failed to update notification settings: " + error.message);
        return;
      }

      setProfile({ ...profile, notification_enabled: nextValue });
      toast.success(
        nextValue 
          ? "🔔 In-app real-time alerts enabled!" 
          : "🔕 In-app real-time alerts muted."
      );
    } catch {
      toast.error("An error occurred.");
    } finally {
      setUpdatingNotification(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (userId) {
        await setUserOffline(userId);
      }
      clearCachedProfile(); // Clear profile cache
      await supabase.auth.signOut();
      toast.success("Logged out successfully!");
      router.replace("/login");
    } catch {
      toast.error("Logout failed.");
    }
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">Entering Daffgle...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#0E1621] text-white">
      {/* Desktop Sidebar (matches exact design) */}
      <aside className="hidden w-full flex-col bg-[#17212B] md:flex md:w-107.5 md:border-r md:border-[#22303D]">
        <header className="sticky top-0 z-30 border-b border-[#22303D] bg-[#17212B]/95 px-6 py-5 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-1 py-1">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#2AABEE]">
                Daffgle
              </h1>
              <p className="text-xs text-gray-400">
                DIU Campus Assistance Network
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-2xl bg-red-955/40 border border-red-900/35 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-955/60 cursor-pointer animate-fade-in"
            >
              Logout
            </button>
          </div>

          {/* User Profile Summary */}
          {profile && (
            <div className="mt-4 rounded-3xl border border-[#22303D] bg-[#0F1A24] p-4 shadow-xl shadow-black/10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2B5278] text-lg font-black">
                  {profile.anonymous_username.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-bold">
                      {profile.anonymous_username}
                    </p>
                    {profile.warning_badge && (
                      <span className="rounded-full bg-red-650/15 border border-red-500/30 px-2 py-0.5 text-[9px] font-bold text-red-400 animate-pulse shrink-0">
                        ⚠️ Suspect
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-400">
                    {profile.department} • {profile.hall}
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
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
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

        {/* Sidebar Info Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-gray-400">
          <div className="rounded-3xl bg-[#0F1A24] p-5 border border-[#22303D]/60 space-y-3">
            <h3 className="font-extrabold text-white text-base">Trust Network</h3>
            <p className="leading-relaxed text-xs">
              Every resolved request grants the helper <span className="text-[#2AABEE] font-bold">+1 Karma</span>. Students with higher Karma gain higher visibility and priority on the dashboard, making them more trusted by peers.
            </p>
          </div>

          <div className="rounded-3xl bg-[#0F1A24] p-5 border border-[#22303D]/60 space-y-3">
            <h3 className="font-extrabold text-white text-base">Hall Safeguards</h3>
            <p className="leading-relaxed text-xs">
              Daffgle only shows requests to students in the same hall. Male students are restricted to Male halls (YKSG 1-3) and Female students to Female halls (RASG 1-2) at database level to ensure privacy and safety.
            </p>
          </div>
        </div>

        {/* Sidebar Desktop Nav Footer */}
        <nav className="border-t border-[#22303D] bg-[#17212B]/95 p-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-[#2AABEE] py-3 text-sm font-black text-white shadow-lg shadow-[#2AABEE]/20 cursor-pointer"
            >
              Home
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
            >
              Hub
            </button>

            <button
              onClick={() => router.push("/profile")}
              className="rounded-full bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
            >
              Profile
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Page Area */}
      <section className="flex-1 flex flex-col bg-[#0F1A24] overflow-y-auto">
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 pb-32 md:pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-4xl border border-[#22303D] bg-[#17212B] p-8 md:p-10 shadow-3xl text-center space-y-8"
          >
            {/* Glowing Logo */}
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-[#2B5278]/30 border-2 border-[#2AABEE] shadow-2xl shadow-[#2AABEE]/20 relative">
              <span className="text-5xl select-none">🕊️</span>
              <span className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#2AABEE] text-xs font-black shadow-lg">
                DIU
              </span>
            </div>

            {/* Brand Title */}
            <div>
              <h2 className="text-4xl font-black text-[#2AABEE] tracking-tight">Daffgle</h2>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span className="text-xs font-black bg-[#2AABEE]/10 text-[#2AABEE] rounded-full px-3.5 py-1 tracking-wider uppercase flex items-center gap-1 border border-[#2AABEE]/20 shadow-sm">
                  🛡️ Student Verified
                </span>
                {profile?.warning_badge && (
                  <span className="text-xs font-black bg-red-600/10 text-red-400 rounded-full px-3.5 py-1 tracking-wider uppercase border border-red-500/20 shadow-sm animate-pulse">
                    ⚠️ {profile.warning_badge}
                  </span>
                )}
              </div>
            </div>

            {/* Mission Statement */}
            <p className="text-base text-gray-300 leading-relaxed font-medium px-4">
              &quot;Built to help DIU students connect, assist, and solve real campus needs in realtime.&quot;
            </p>

            {/* In-app real-time Notification Toggle */}
            {profile && (
              <div className="rounded-3xl border border-[#22303D] bg-[#0E1621] p-5 flex items-center justify-between shadow-inner">
                <div className="text-left min-w-0 pr-4">
                  <p className="font-extrabold text-sm text-white">Realtime alerts</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {profile.notification_enabled 
                      ? "Receiving same-hall request notifications" 
                      : "Notifications currently muted"}
                  </p>
                </div>

                <button
                  onClick={handleToggleNotification}
                  disabled={updatingNotification}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    profile.notification_enabled ? "bg-[#2AABEE]" : "bg-gray-700"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      profile.notification_enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Primary Action Button (Mobile Hub access) */}
            <div className="pt-2 md:hidden">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full rounded-2xl bg-[#2AABEE] py-4 text-sm font-black text-white hover:scale-[1.01] transition shadow-lg shadow-[#2AABEE]/25 cursor-pointer"
              >
                Go to Help Hub
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Floating Bottom Navigation Bar (Mobile only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur md:hidden pb-safe">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
          <button
            onClick={() => router.push("/")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl bg-[#2B5278]/20 text-[#2AABEE] transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🏠</span>
            <span className="text-[10px] font-black tracking-wide uppercase">Home</span>
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🤝</span>
            <span className="text-[10px] font-bold tracking-wide uppercase">Help Hub</span>
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
    </main>
  );
}