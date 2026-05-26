"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";
import { setUserOnline, setUserOffline } from "@/lib/presence";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";
import { 
  PremiumCard, 
  PremiumButton, 
  FloatingBottomNav, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { ShieldCheck, LogOut, MessageSquare, Compass, Moon, Award, Users, Settings, ArrowRight } from "lucide-react";


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

  // Background Chats Unread Counter
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id")
        .neq("sender_id", userId)
        .eq("seen", false);
      setUnreadChatsCount(data?.length || 0);
    };
    fetchUnread();
  }, [userId]);

  // Floating Bottom Navigation Data
  const bottomNavItems = [
    { label: "Home", icon: "🏠", onClick: () => router.push("/"), isActive: true },
    { label: "Help Hub", icon: "🤝", onClick: () => router.push("/dashboard"), isActive: false },
    { label: "Chats", icon: "💬", onClick: () => router.push("/chat"), isActive: false, badge: unreadChatsCount },
    { label: "Sanctuary", icon: "🦉", onClick: () => router.push("/night-owl"), isActive: false },
    { label: "Profile", icon: "👤", onClick: () => router.push("/profile"), isActive: false },
  ];

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#111111] text-white px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">Entering Daffgle...</p>
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
            <div className="mt-5 rounded-3xl border border-white/5 bg-brand-surface p-4 shadow-xl select-none">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-elevated border border-white/5 text-lg font-black text-[#C9D7F2]">
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
                    {profile.department} • {profile.hall}
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
            className="w-full mt-2.5 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
          >
            <Moon className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            Night Owl Mode
          </PremiumButton>
        </header>

        {/* Sidebar Left guides info scroll area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
          <PremiumCard className="p-5 border-white/5 bg-brand-surface shadow-md space-y-2 select-none">
            <h3 className="font-bold text-white/95 text-xs flex items-center gap-1.5">
              <Award className="h-4 w-4 text-brand-accent" />
              Trust Karma System
            </h3>
            <p className="leading-relaxed text-[11px] text-brand-text-secondary">
              Every solved help request awards the helper <span className="text-[#C9D7F2] font-black">+1 Karma</span>. Students with higher Karma earn priority visibility in campus feeds.
            </p>
          </PremiumCard>

          <PremiumCard className="p-5 border-white/5 bg-brand-surface shadow-md space-y-2 select-none">
            <h3 className="font-bold text-white/95 text-xs flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-accent" />
              Hall Safeguards
            </h3>
            <p className="leading-relaxed text-[11px] text-brand-text-secondary">
              Campus request feeds are location-bounded to your specific residence hall. Male/female halls are strictly quarantined at database level for maximum safety.
            </p>
          </PremiumCard>
        </div>

        {/* Sidebar Desktop static Footer */}
        <nav className="border-t border-white/5 bg-[#1A1A1A]/95 p-4 select-none">
          <div className="grid grid-cols-3 gap-2">
            <PremiumButton
              onClick={() => router.push("/")}
              variant="primary"
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

      {/* Main Right Student Portal entry showcase */}
      <section className="flex-1 flex flex-col bg-[#111111] overflow-y-auto">
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 pb-32 md:pb-12 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-accent/5 via-transparent to-transparent pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={premiumSpring}
            className="w-full max-w-lg z-10"
          >
            <PremiumCard className="p-8 md:p-10 border-white/5 bg-brand-surface shadow-2xl text-center space-y-8">
              
              {/* Branding Header badge */}
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-accent/5 border border-brand-accent/15 relative shadow-inner">
                <span className="text-4xl select-none">🕊️</span>
                <span className="absolute -right-2 -bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent text-[10px] font-black text-brand-primary shadow-lg select-none">
                  DIU
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-3xl font-black tracking-tight text-[#C9D7F2]">Daffgle</h2>
                
                <div className="flex items-center justify-center gap-1.5 select-none">
                  <span className="text-[9px] font-bold bg-brand-accent/10 text-brand-accent rounded-full px-3.5 py-0.5 tracking-widest uppercase border border-brand-accent/20 flex items-center gap-1">
                    🛡️ Student Verified
                  </span>
                  {profile?.warning_badge && (
                    <span className="text-[9px] font-bold bg-red-500/10 text-red-400 rounded-full px-3.5 py-0.5 tracking-widest uppercase border border-red-500/20 animate-pulse">
                      ⚠️ {profile.warning_badge}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-brand-text-secondary leading-relaxed font-medium px-4">
                &quot;Built to assist DIU students in campus residence halls, establishing secure private channels to coordinate borrowing and lending in real-time.&quot;
              </p>

              {/* In-app notification toggle Setting card */}
              {profile && (
                <div className="rounded-2xl border border-white/5 bg-brand-secondary p-5 flex items-center justify-between shadow-inner select-none text-left">
                  <div className="min-w-0 pr-4 space-y-0.5">
                    <p className="font-bold text-xs text-white">In-app Realtime alerts</p>
                    <p className="text-[11px] text-brand-text-secondary truncate">
                      {profile.notification_enabled 
                        ? "Receiving same-hall help broadcasts" 
                        : "Campus notifications muted"}
                    </p>
                  </div>

                  <button
                    onClick={handleToggleNotification}
                    disabled={updatingNotification}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      profile.notification_enabled ? "bg-brand-accent" : "bg-[#232323]"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        profile.notification_enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Mobile CTA entrance button */}
              <div className="pt-2 md:hidden">
                <PremiumButton
                  onClick={() => router.push("/dashboard")}
                  variant="primary"
                  className="w-full font-bold py-3.5 shadow-lg flex items-center justify-center gap-1.5"
                >
                  Enter Help Hub
                  <ArrowRight className="h-4 w-4 text-brand-primary" />
                </PremiumButton>
              </div>

            </PremiumCard>
          </motion.div>
        </div>
      </section>

      {/* Floating Bottom Navigation Bar (Mobile only) */}
      <FloatingBottomNav items={bottomNavItems} />
    </main>
  );
}