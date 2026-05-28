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
import { 
  PremiumCard, 
  PremiumButton, 
  FloatingBottomNav 
} from "@/components/ui/PremiumUI";
import { LogOut, Compass, MessageSquare, Moon, Award, Users } from "lucide-react";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  hall?: string;
  karma: number;
  warning_badge?: string | null;
};

export default function NightOwlPageRoute() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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

        setProfile(profileData as Profile);
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

  // Background Chats Unread Counter
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id")
        .neq("sender_id", currentUser.id)
        .eq("seen", false);
      setUnreadChatsCount(data?.length || 0);
    };
    fetchUnread();
  }, [currentUser]);

  // Floating Bottom Navigation Data
  const bottomNavItems = [
    { label: "Home", icon: "🏠", onClick: () => router.push("/"), isActive: false },
    { label: "Help Hub", icon: "🤝", onClick: () => router.push("/dashboard"), isActive: false },
    { label: "Chats", icon: "💬", onClick: () => router.push("/chat"), isActive: false, badge: unreadChatsCount },
    { label: "Sanctuary", icon: "🦉", onClick: () => router.push("/night-owl"), isActive: true },
    { label: "Profile", icon: "👤", onClick: () => router.push("/profile"), isActive: false },
  ];

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-brand-primary text-white px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-border border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">Syncing Daffgle Sanctuary...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-brand-primary text-brand-text-primary pt-safe">
      
      {/* Desktop Left Sidebar Panel (Matches verified landing homepage perfectly) */}
      <aside className="hidden w-full flex-col bg-brand-secondary md:flex md:w-96 md:border-r md:border-brand-border relative shrink-0">
        <div className="absolute top-0 left-0 right-0 h-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-accent/8 via-transparent to-transparent pointer-events-none" />

        <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-secondary/95 px-6 py-5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white/95">
                Daffgle
              </h1>
              <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mt-1 select-none">
                DIU verified network
              </p>
            </div>

            <PremiumButton
              onClick={handleLogout}
              variant="danger"
              className="py-1.5 px-3 rounded-xl text-xs font-bold"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Logout
            </PremiumButton>
          </div>

          {/* User Profile Card */}
          {profile && (
            <div className="mt-5 rounded-3xl border border-brand-border bg-brand-surface p-4 shadow-xl select-none">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-elevated border border-brand-border text-lg font-black text-brand-accent">
                  {profile.anonymous_username.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-bold text-white/90">
                      {profile.anonymous_username}
                    </p>
                    {profile.warning_badge && (
                      <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[8px] font-bold text-red-400 uppercase shrink-0 animate-pulse">
                        ⚠️ Suspect
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-brand-text-secondary">
                    {profile.department} • {profile.hall} • <span className="text-brand-accent font-bold">{profile.karma} Karma</span>
                  </p>
                </div>

                <div className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[9px] font-bold text-green-400 shrink-0">
                  ● Online
                </div>
              </div>
            </div>
          )}

          {/* Navigation options shortcuts */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <PremiumButton
              onClick={() => router.push("/dashboard")}
              variant="secondary"
              className="py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              <Compass className="h-3.5 w-3.5 opacity-70" />
              Help Hub
            </PremiumButton>

            <PremiumButton
              onClick={() => router.push("/chat")}
              variant="secondary"
              className="py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5 opacity-70" />
              My Chats
            </PremiumButton>
          </div>

          <PremiumButton
            onClick={() => router.push("/night-owl")}
            variant="accent"
            className="w-full mt-2.5 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 relative overflow-hidden"
          >
            <Moon className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            Night Owl Mode
            {isLive && (
              <span className="absolute right-3 rounded-full bg-brand-accent px-1.5 py-0.2 text-[8px] font-black text-brand-primary uppercase tracking-wide animate-pulse">
                Live
              </span>
            )}
          </PremiumButton>
        </header>

        {/* Sidebar Left guides info scroll area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
          <PremiumCard className="p-5 border-brand-border bg-brand-surface shadow-md space-y-2 select-none">
            <h3 className="font-bold text-white/95 text-xs flex items-center gap-1.5">
              <Award className="h-4 w-4 text-brand-accent" />
              Late Night Sanctuary
            </h3>
            <p className="leading-relaxed text-[11px] text-brand-text-secondary leading-normal">
              Night Owl Mode runs strictly between **3:00 AM and 6:00 AM Bangladesh Time (BDT)**. All requests and secure private sessions are automatically closed and archived at 6:00 AM.
            </p>
          </PremiumCard>

          <PremiumCard className="p-5 border-brand-border bg-brand-surface shadow-md space-y-2 select-none">
            <h3 className="font-bold text-white/95 text-xs flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-accent" />
              Absolute Anonymity
            </h3>
            <p className="leading-relaxed text-[11px] text-brand-text-secondary leading-normal">
              To ensure students stay safe during sensitive late hours, profiles are completely masked inside Night Owl chat rooms and listings. You will appear exclusively as **"Anonymous Owl"**.
            </p>
          </PremiumCard>
        </div>

        {/* Sidebar Desktop static Footer */}
        <nav className="border-t border-brand-border bg-brand-secondary/95 p-4 select-none">
          <div className="grid grid-cols-3 gap-2">
            <PremiumButton
              onClick={() => router.push("/")}
              variant="secondary"
              className="py-2.5 text-xs font-bold rounded-xl"
            >
              Home
            </PremiumButton>

            <PremiumButton
              onClick={() => router.push("/dashboard")}
              variant="secondary"
              className="py-2.5 text-xs font-bold rounded-xl"
            >
              Hub
            </PremiumButton>

            <PremiumButton
              onClick={() => router.push("/profile")}
              variant="secondary"
              className="py-2.5 text-xs font-bold rounded-xl"
            >
              Profile
            </PremiumButton>
          </div>
        </nav>
      </aside>

      {/* Main Panel */}
      <section className="flex flex-1 flex-col bg-brand-primary overflow-hidden w-full pb-safe">
        <NightOwlPanel />
      </section>

      {/* Floating Bottom Navigation Bar (Mobile only) - Unified Premium UI widget */}
      <FloatingBottomNav items={bottomNavItems} />
    </main>
  );
}
