"use client";
 
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Clock, Moon, Lock, Info, X } from "lucide-react";
import { PremiumButton, PremiumCard, premiumSpring } from "@/components/ui/PremiumUI";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
 
export type FeatureToggles = {
  chats: boolean;
  help_hub: boolean;
  sanctuary: boolean;
  registrations: boolean;
  profile_editing: boolean;
  notifications: boolean;
};
 
export type GlobalNotice = {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "emergency";
  is_active: boolean;
  updated_at: string;
};
 
export type EmergencyAlert = {
  title: string;
  message: string;
  active: boolean;
  type: "warning" | "danger" | "info";
} | null;
 
type AppSettingsContextType = {
  isLocked: boolean;
  featureToggles: FeatureToggles;
  activeNotices: GlobalNotice[];
  emergencyAlert: EmergencyAlert;
  isAdmin: boolean;
  loading: boolean;
  currentProfile: any;
  refetchSettings: () => Promise<void>;
};
 
const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);
 
export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
 
  const [loading, setLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [maintenanceSettings, setMaintenanceSettings] = useState({
    title: "Scheduled Maintenance",
    message: "Daffgle is undergoing routine systems optimization.",
    reopenTime: null as string | null
  });
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({
    chats: true,
    help_hub: true,
    sanctuary: true,
    registrations: true,
    profile_editing: true,
    notifications: true
  });
  const [emergencyAlert, setEmergencyAlert] = useState<EmergencyAlert>(null);
  const [activeNotices, setActiveNotices] = useState<GlobalNotice[]>([]);
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>([]);
 
  // Fetch settings & notices
  const loadSettingsAndNotices = async (userId?: string) => {
    try {
      // 1. Fetch app singleton settings
      const { data: settings, error: settingsError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
 
      if (settings) {
        setFeatureToggles(settings.featureToggles || settings.feature_toggles || featureToggles);
        setEmergencyAlert(settings.emergencyAlert || settings.emergency_alert || null);
        
        // Calculate Lock
        const lockedState = settings.is_locked || settings.isLocked || false;
        setMaintenanceSettings({
          title: settings.maintenance_title || "System Maintenance",
          message: settings.maintenance_message || "We will be back shortly.",
          reopenTime: settings.estimated_reopen_time || null
        });
 
        // 2. Fetch User Profile for Admin Check
        let adminBypass = false;
        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
 
          if (profile) {
            setCurrentProfile(profile);
            const adminStatus = !!profile.is_admin;
            setIsAdmin(adminStatus);
            adminBypass = adminStatus;
 
            // Realtime Kick Out if Banned or Force Logged Out
            if (profile.is_banned || profile.force_logout) {
              toast.error("Your session has been terminated by an administrator.");
              if (profile.force_logout) {
                // Reset force_logout flag
                await supabase.from("profiles").update({ force_logout: false }).eq("id", userId);
              }
              await supabase.auth.signOut();
              setCurrentProfile(null);
              setIsAdmin(false);
              router.replace("/login");
              return;
            }
          }
        }
 
        setIsLocked(lockedState && !adminBypass);
      }
 
      // 3. Fetch Active Global Notices
      const { data: notices } = await supabase
        .from("global_notices")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
 
      setActiveNotices(notices || []);
    } catch (err) {
      console.error("[Settings Provider] Load Error:", err);
    } finally {
      setLoading(false);
    }
  };
 
  // Initial check & load
  useEffect(() => {
    let authListener: any;
    let currentUserId = "";
 
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      currentUserId = session?.user?.id || "";
      await loadSettingsAndNotices(currentUserId);
 
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const nextUserId = session?.user?.id || "";
        if (nextUserId !== currentUserId) {
          currentUserId = nextUserId;
          await loadSettingsAndNotices(currentUserId);
        }
      });
      authListener = subscription;
    };
 
    init();
 
    return () => {
      if (authListener) authListener.unsubscribe();
    };
  }, [router]);
 
  // Realtime Supabase Listeners
  useEffect(() => {
    // 1. Subscribe to app_settings singleton updates
    const settingsChannel = supabase
      .channel("app-settings-global-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_settings", filter: "id=eq.1" },
        (payload) => {
          const next = payload.new as any;
          setFeatureToggles(next.feature_toggles || featureToggles);
          setEmergencyAlert(next.emergency_alert || null);
          
          setMaintenanceSettings({
            title: next.maintenance_title || "System Maintenance",
            message: next.maintenance_message || "We will be back shortly.",
            reopenTime: next.estimated_reopen_time || null
          });
 
          // Re-evaluate lock status using the latest profile admin role
          const lockedState = next.is_locked || false;
          setIsLocked(lockedState && !isAdmin);
          
          if (lockedState && !isAdmin && pathname !== "/login") {
            toast.warning("Platform entered system maintenance mode.");
          }
        }
      )
      .subscribe();
 
    // 2. Subscribe to active global_notices changes
    const noticesChannel = supabase
      .channel("global-notices-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_notices" },
        async () => {
          const { data: notices } = await supabase
            .from("global_notices")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false });
          setActiveNotices(notices || []);
        }
      )
      .subscribe();
 
    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(noticesChannel);
    };
  }, [isAdmin, pathname]);
 
  // Realtime profile ban/logout monitor
  useEffect(() => {
    if (!currentProfile?.id) return;
 
    const profileChannel = supabase
      .channel(`profile-kick-monitor-${currentProfile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${currentProfile.id}` },
        async (payload) => {
          const nextProfile = payload.new as any;
          
          // Instantly kick user out in real-time
          if (nextProfile.is_banned || nextProfile.force_logout) {
            toast.error("Your session has been terminated by an administrator.");
            if (nextProfile.force_logout) {
              await supabase.from("profiles").update({ force_logout: false }).eq("id", currentProfile.id);
            }
            await supabase.auth.signOut();
            setCurrentProfile(null);
            setIsAdmin(false);
            setIsLocked(false);
            router.replace("/login");
          } else {
            setCurrentProfile(nextProfile);
            setIsAdmin(!!nextProfile.is_admin);
            // Re-evaluate lock
            setIsLocked(isLocked && !nextProfile.is_admin);
          }
        }
      )
      .subscribe();
 
    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [currentProfile, isLocked, router]);
 
  // Load dismissed notices from localStorage
  useEffect(() => {
    const list: string[] = [];
    activeNotices.forEach(n => {
      const dismissedKey = `dismissed_notice_${n.id}`;
      const dismissedTime = localStorage.getItem(dismissedKey);
      if (dismissedTime && new Date(dismissedTime).getTime() >= new Date(n.updated_at).getTime()) {
        list.push(n.id);
      }
    });
    setDismissedNoticeIds(list);
  }, [activeNotices]);
 
  const handleDismissNotice = (noticeId: string) => {
    const notice = activeNotices.find(n => n.id === noticeId);
    if (notice) {
      localStorage.setItem(`dismissed_notice_${noticeId}`, new Date().toISOString());
      setDismissedNoticeIds(prev => [...prev, noticeId]);
    }
  };
 
  const visibleNotices = activeNotices.filter(n => !dismissedNoticeIds.includes(n.id));
 
  // Custom estimated timer countdown
  const [timeLeftFormatted, setTimeLeftFormatted] = useState("");
  useEffect(() => {
    if (!maintenanceSettings.reopenTime) {
      setTimeLeftFormatted("");
      return;
    }
 
    const updateTimer = () => {
      const total = Date.parse(maintenanceSettings.reopenTime!) - Date.now();
      if (total <= 0) {
        setTimeLeftFormatted("Immediate Reopening");
        return;
      }
      const seconds = Math.floor((total / 1000) % 60);
      const minutes = Math.floor((total / 1000 / 60) % 60);
      const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
      setTimeLeftFormatted(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };
 
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [maintenanceSettings.reopenTime]);
 
  return (
    <AppSettingsContext.Provider
      value={{
        isLocked,
        featureToggles,
        activeNotices: visibleNotices,
        emergencyAlert,
        isAdmin,
        loading,
        currentProfile,
        refetchSettings: () => loadSettingsAndNotices(currentProfile?.id)
      }}
    >
      {/* 1. Fullscreen Global app maintenance lock screen overlay */}
      <AnimatePresence>
        {isLocked && pathname !== "/login" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#050805] text-white p-6 select-none"
          >
            <div className="cyber-scanline" />
            <div className="cyber-grid" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/8 via-transparent to-transparent blur-[100px] pointer-events-none" />
 
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={premiumSpring}
              className="w-full max-w-md text-center"
            >
              <PremiumCard className="p-8 border-brand-accent/25 bg-brand-surface/85 shadow-[0_0_50px_rgba(124,255,107,0.18)] space-y-6">
                
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-brand-accent/30 bg-[#0B120B] shadow-[0_0_20px_rgba(124,255,107,0.2)] animate-pulse-glow">
                  <Lock className="h-9 w-9 text-brand-accent" />
                </div>
 
                <div className="space-y-2">
                  <h1 className="text-2xl font-black uppercase tracking-wider text-white">
                    {maintenanceSettings.title}
                  </h1>
                  <p className="text-[10px] font-black text-brand-accent uppercase tracking-[0.25em]">
                    Platform Temporarily Restricted
                  </p>
                </div>
 
                <p className="text-xs text-brand-text-secondary leading-relaxed font-semibold">
                  {maintenanceSettings.message}
                </p>
 
                {maintenanceSettings.reopenTime && (
                  <div className="rounded-2xl border border-brand-border bg-brand-secondary p-4 shadow-inner space-y-1 animate-pulse">
                    <p className="text-[9px] font-bold text-brand-text-secondary uppercase tracking-widest">
                      Estimated Reopening In
                    </p>
                    <p className="text-3xl font-black text-white font-mono tracking-widest">
                      {timeLeftFormatted || "--:--:--"}
                    </p>
                  </div>
                )}
 
                <div className="text-[9px] text-brand-text-secondary font-black uppercase tracking-widest border-t border-brand-border pt-4">
                  🛡️ Daffgle Secured Network
                </div>
              </PremiumCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* 2. Fullscreen Emergency Broadcast Overlay (Feature 5) */}
      <AnimatePresence>
        {emergencyAlert?.active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 select-none"
          >
            <div className="cyber-scanline" />
            
            {/* Deep red cinematic breathing glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent blur-[120px] pointer-events-none" />
 
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={premiumSpring}
              className="w-full max-w-lg text-center"
            >
              <PremiumCard className="p-8 border-red-500/40 bg-[#1A0A0A]/95 shadow-[0_0_50px_rgba(255,77,77,0.3)] space-y-6 text-center">
                
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-red-500/40 bg-red-500/10 text-3xl shadow-[0_0_20px_rgba(255,77,77,0.3)] animate-ping" style={{ animationDuration: '2s' }}>
                  🚨
                </div>
 
                <div className="space-y-2">
                  <h2 className="text-3xl font-black uppercase tracking-widest text-red-500 drop-shadow-[0_0_10px_rgba(255,77,77,0.5)]">
                    {emergencyAlert.title}
                  </h2>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em]">
                    System Emergency Broadcast Alert
                  </p>
                </div>
 
                <p className="text-sm text-red-100/90 leading-relaxed font-bold bg-red-500/5 p-4 rounded-2xl border border-red-500/10 max-h-60 overflow-y-auto">
                  {emergencyAlert.message}
                </p>
 
                {isAdmin ? (
                  <PremiumButton
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from("app_settings")
                          .update({ emergency_alert: null })
                          .eq("id", 1);
                        if (error) throw error;
                        setEmergencyAlert(null);
                        toast.success("Emergency Alert cleared by Admin.");
                      } catch {
                        toast.error("Failed to dismiss alert.");
                      }
                    }}
                    variant="danger"
                    className="w-full font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(255,77,77,0.3)]"
                  >
                    Admin Bypass & Terminate Broadcast
                  </PremiumButton>
                ) : (
                  <div className="text-[9px] text-red-400/60 font-black uppercase tracking-[0.25em] pt-2">
                    ⚠️ Locked by Operations Center
                  </div>
                )}
              </PremiumCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* 3. Global Notices Banners container (Feature 2) */}
      <div className="fixed top-0 left-0 right-0 z-40 space-y-2 pointer-events-none p-4 pt-safe max-w-2xl mx-auto flex flex-col items-center">
        <AnimatePresence>
          {visibleNotices.map((notice) => {
            const isEmergency = notice.type === "emergency";
            const isWarning = notice.type === "warning";
            
            return (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={premiumSpring}
                className="w-full pointer-events-auto"
              >
                <div
                  className={cn(
                    "flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 relative overflow-hidden",
                    isEmergency && "bg-[#1A0A0A]/95 border-red-500/40 text-red-200 shadow-[0_0_20px_rgba(255,77,77,0.2)] animate-pulse border-t-red-500 border-t-2",
                    isWarning && "bg-[#1A1A05]/95 border-yellow-500/30 text-yellow-100 shadow-[0_0_15px_rgba(234,179,8,0.1)]",
                    !isEmergency && !isWarning && "bg-brand-surface/95 border-brand-accent/25 text-brand-text-primary"
                  )}
                >
                  <div className="flex gap-2.5 min-w-0">
                    <span className="text-base shrink-0 mt-0.5 select-none">
                      {isEmergency ? "🚨" : isWarning ? "⚠️" : "📢"}
                    </span>
                    <div className="min-w-0">
                      <h4 className={cn("text-xs font-black uppercase tracking-wider", isEmergency ? "text-red-400" : isWarning ? "text-yellow-400" : "text-brand-accent")}>
                        {notice.title}
                      </h4>
                      <p className="text-[11px] leading-relaxed mt-1 font-semibold opacity-95">
                        {notice.content}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDismissNotice(notice.id)}
                    className="shrink-0 rounded-lg p-1 text-white/40 hover:text-white hover:bg-white/5 cursor-pointer outline-none focus:outline-none transition duration-150"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
 
      {children}
    </AppSettingsContext.Provider>
  );
}
 
export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
}
