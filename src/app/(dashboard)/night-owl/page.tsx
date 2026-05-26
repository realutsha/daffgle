"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { toast } from "sonner";
import NightOwlPanel from "@/components/night-owl/NightOwlPanel";
import { isNightOwlActive } from "@/lib/night-owl/time";

export default function NightOwlPageRoute() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLive, setIsLive] = useState(isNightOwlActive());

  // Check live status on load
  useEffect(() => {
    setIsLive(isNightOwlActive());
    const interval = setInterval(() => {
      setIsLive(isNightOwlActive());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let userId = "";

    const checkSessionAndProfile = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user || !isEmailAllowed(userData.user.email)) {
          if (userData.user) {
            await supabase.auth.signOut();
          }
          router.replace("/login?error=domain_restricted");
          return;
        }

        userId = userData.user.id;
        setCurrentUser(userData.user);
        await setUserOnline(userId);

        // Fetch user profile using safe utility
        const { data: profileData } = await fetchProfileSafely(userId);

        if (profileData && profileData.is_banned) {
          await setUserOffline(userId);
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

        setProfile(profileData);
      } catch (err) {
        console.error("Night Owl page initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSessionAndProfile();

    const handleVisibility = async () => {
      if (!userId) return;
      if (document.hidden) {
        await setUserOffline(userId);
      } else {
        await setUserOnline(userId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (userId) {
        setUserOffline(userId);
      }
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      if (currentUser?.id) {
        await setUserOffline(currentUser.id);
      }
      clearCachedProfile();
      await supabase.auth.signOut();
      toast.success("Logged out successfully!");
      router.replace("/login");
    } catch {
      toast.error("Logout failed.");
    }
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">Syncing Daffgle Sanctuary...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#0E1621] text-white">
      {/* Desktop Sidebar (Matching Daffgle layout) */}
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
              className="rounded-2xl bg-red-955/40 border border-red-900/35 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-955/60 cursor-pointer"
            >
              Logout
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

          {/* Night Owl Entry */}
          <button
            onClick={() => router.push("/night-owl")}
            className="w-full mt-2 rounded-2xl bg-[#2AABEE] border border-[#2AABEE]/25 py-3 text-sm font-black text-white transition hover:opacity-90 shadow-lg shadow-[#2AABEE]/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>🦉</span> Night Owl Mode
            {isLive && (
              <span className="rounded-full bg-white px-2 py-0.2 text-[8px] font-black text-[#2AABEE] uppercase tracking-wide animate-pulse">
                Live
              </span>
            )}
          </button>
        </header>

        {/* Sidebar Safe Info Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-gray-400">
          <div className="rounded-3xl bg-[#0F1A24] p-5 border border-[#22303D]/60 space-y-3">
            <h3 className="font-extrabold text-white text-base">Late Night Sanctuary</h3>
            <p className="leading-relaxed text-xs">
              Night Owl Mode runs strictly between **3:00 AM and 6:00 AM Bangladesh Time (BDT)**. All requests, mood broadcasts, and secure private sessions are automatically closed and archived at 6:00 AM.
            </p>
          </div>

          <div className="rounded-3xl bg-[#0F1A24] p-5 border border-[#22303D]/60 space-y-3">
            <h3 className="font-extrabold text-white text-base">Absolute Anonymity</h3>
            <p className="leading-relaxed text-xs">
              To ensure students stay safe during sensitive late hours, profiles are completely masked inside Night Owl chat rooms and listings. You will appear exclusively as **"Anonymous Owl"**.
            </p>
          </div>
        </div>

        {/* Sidebar Desktop Nav Footer */}
        <nav className="border-t border-[#22303D] bg-[#17212B]/95 p-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => router.push("/")}
              className="rounded-full bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
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

      {/* Main Panel */}
      <section className="flex flex-1 flex-col bg-[#0F1A24] overflow-hidden w-full pb-safe">
        <NightOwlPanel />
      </section>

      {/* Floating Mobile Bottom Navigation Bar (5 tabs now to integrate Night Owl) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#22303D] bg-[#17212B]/95 px-2 py-3 backdrop-blur md:hidden pb-safe">
        <div className="mx-auto grid grid-cols-5 gap-1 max-w-md">
          <button
            onClick={() => router.push("/")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🏠</span>
            <span className="text-[9px] font-bold tracking-wide uppercase">Home</span>
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🤝</span>
            <span className="text-[9px] font-bold tracking-wide uppercase">Help Hub</span>
          </button>

          <button
            onClick={() => router.push("/chat")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">💬</span>
            <span className="text-[9px] font-bold tracking-wide uppercase">Chats</span>
          </button>

          <button
            onClick={() => router.push("/night-owl")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl bg-[#2B5278]/20 text-[#2AABEE] transition duration-200 cursor-pointer"
          >
            <span className="text-lg">🦉</span>
            <span className="text-[9px] font-black tracking-wide uppercase">Sanctuary</span>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
          >
            <span className="text-lg">👤</span>
            <span className="text-[9px] font-bold tracking-wide uppercase">Profile</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
