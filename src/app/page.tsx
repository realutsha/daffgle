"use client";
 
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/validations/auth";
import { setUserOnline } from "@/lib/presence";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete } from "@/utils/profile";
import { premiumSpring } from "@/components/ui/PremiumUI";
 
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
        await setUserOnline(myId);
 
        // Fetch profile using unified safe utility
        const { data: profileData } = await fetchProfileSafely(myId);
        const complete = isProfileComplete(profileData);
 
        if (!complete) {
          toast.error("Please complete your profile setup first!");
          router.replace("/auth/setup");
          return;
        }
      } catch (err) {
        console.error("Home initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };
 
    initHome();
  }, [router]);
 
  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0B0E14] text-white px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">Entering Daffgle...</p>
        </div>
      </main>
    );
  }
 
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh bg-[#0B0E14] text-white px-6 relative overflow-hidden select-none">
      
      {/* Futuristic Gemini ambient background glow */}
      <div className="absolute top-[35%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-[380px] md:w-[600px] h-[380px] md:h-[600px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-[#80F3B4]/5 to-transparent blur-[80px] pointer-events-none" />
      <div className="absolute top-[45%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/5 via-[#80F3B4]/3 to-transparent blur-[60px] pointer-events-none" />
 
      {/* Floating high-tech lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_90%)] pointer-events-none opacity-50" />
 
      {/* Centered Futuristic Landing UI */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={premiumSpring}
        className="text-center space-y-6 z-10 max-w-lg"
      >
        {/* Subtle holographic brand badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#C9D7F2] shadow-[0_0_15px_rgba(255,255,255,0.02)] backdrop-blur-md"
        >
          <span>🛡️ DIU SECURE NETWORK</span>
        </motion.div>
 
        {/* Futuristic App Title */}
        <div className="space-y-3">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-[#F5F8FC] to-[#8AB4F8]/80 drop-shadow-[0_0_40px_rgba(255,255,255,0.05)]">
            Daffgle
          </h1>
          
          <p className="text-[10px] md:text-xs font-bold text-brand-text-secondary/70 uppercase tracking-[0.3em]">
            Anonymous • Realtime • Helpdesk
          </p>
        </div>
 
        {/* Center spacing */}
        <div className="h-6" />
 
        {/* Enter Daffgle Main CTA Button with Gemini Fluid Gradient Light and Liquid Glass Surface */}
        <div className="relative group inline-block">
          
          {/* Rotating and Pulsing Gemini gradient border light behind */}
          <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-[#8AB4F8] via-[#80F3B4] to-[#C9D7F2] opacity-35 blur-[3px] group-hover:opacity-75 group-hover:blur-[6px] transition duration-500 group-hover:duration-200 animate-pulse" />
          
          {/* Liquid Glass Translucent button surface */}
          <button
            onClick={() => router.push("/dashboard")}
            className="relative px-9 py-4.5 rounded-[15px] font-black text-xs uppercase tracking-[0.2em] text-[#C9D7F2] bg-[#0B0E14]/90 hover:bg-[#0B0E14]/75 border border-[#8AB4F8]/10 backdrop-blur-2xl transition duration-300 group-hover:text-white group-hover:border-[#8AB4F8]/30 hover:scale-[1.015] active:scale-[0.985] cursor-pointer shadow-[0_0_30px_rgba(138,180,248,0.05)] flex items-center justify-center gap-2.5 mx-auto"
          >
            <span>Enter Daffgle</span>
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="text-base text-[#80F3B4]"
            >
              →
            </motion.span>
          </button>
        </div>
      </motion.div>
    </main>
  );
}