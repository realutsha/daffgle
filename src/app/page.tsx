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
 
export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isGlowing, setIsGlowing] = useState(false);
 
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
      <main className="flex h-screen items-center justify-center bg-brand-primary text-white px-4 relative">
        <div className="cyber-scanline" />
        <div className="cyber-grid" />
        <div className="flex flex-col items-center gap-4 animate-pulse select-none z-10">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-brand-accent" />
          <p className="text-xs uppercase tracking-widest text-brand-text-secondary font-black">Entering Daffgle Secure Space...</p>
        </div>
      </main>
    );
  }
 
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh bg-brand-primary text-white px-6 relative overflow-hidden select-none">
      
      {/* Scanline and Grid layers */}
      <div className="cyber-scanline" />
      <div className="cyber-grid" />
 
      {/* Futuristic ambient background green glows */}
      <div className="absolute top-[35%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-[380px] md:w-[600px] h-[380px] md:h-[600px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/8 via-brand-accent-secondary/3 to-transparent blur-[90px] pointer-events-none" />
      <div className="absolute top-[45%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent-lime/6 via-brand-accent/2 to-transparent blur-[70px] pointer-events-none" />
 
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
          className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-brand-accent/25 bg-brand-surface/40 px-4.5 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-brand-accent shadow-[0_0_15px_rgba(124,255,107,0.1)] backdrop-blur-md"
        >
          <span>🛡️ DIU SECURE NETWORK</span>
        </motion.div>
 
        {/* Futuristic App Title */}
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white/80 to-brand-accent/80 drop-shadow-[0_0_55px_rgba(124,255,107,0.22)]">
            Daffgle
          </h1>
          
          <p className="text-[10px] md:text-xs font-black text-brand-text-secondary/70 uppercase tracking-[0.35em]">
            Anonymous • Realtime • Helpdesk
          </p>
        </div>
 
        {/* Center spacing */}
        <div className="h-6" />
 
        {/* Enter Daffgle Main CTA Button with cyber glow specs */}
        <div className="relative group inline-block">
          
          {/* Rotating and Pulsing gradient border light behind */}
          <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-brand-accent via-brand-accent-secondary to-brand-accent-lime opacity-35 blur-[4px] group-hover:opacity-75 group-hover:blur-[7px] transition duration-500 group-hover:duration-200 animate-pulse" />
          
          {/* Emerald Green Neon Aura Backdrop */}
          <div
            className={`absolute -inset-[1px] rounded-[15px] bg-gradient-to-r from-brand-accent to-brand-accent-secondary blur-[3px] transition-all pointer-events-none duration-700 ease-out z-0 ${
              isGlowing 
                ? "opacity-80 blur-[8px] scale-[1.01] duration-75 ease-in" 
                : "opacity-0 group-hover:opacity-20 group-hover:blur-[4px]"
            }`}
          />
          {/* Liquid Glass border glow */}
          <div
            className={`absolute inset-0 rounded-[15px] border border-transparent transition-all pointer-events-none duration-700 z-0 ${
              isGlowing 
                ? "border-brand-accent/80 duration-75" 
                : "group-hover:border-brand-accent/40"
            }`}
          />
          
          {/* Liquid Glass Translucent button surface */}
          <button
            onClick={() => {
              setIsGlowing(true);
              setTimeout(() => {
                setIsGlowing(false);
                router.push("/dashboard");
              }, 220); // Delay slightly for high-end click feel
            }}
            className="relative px-9 py-4.5 rounded-[15px] font-black text-xs uppercase tracking-[0.2em] text-brand-accent bg-[#0B120B]/90 hover:bg-[#0B120B]/75 border border-brand-accent/25 backdrop-blur-2xl transition duration-300 group-hover:text-white group-hover:border-brand-accent/50 hover:scale-[1.015] active:scale-[0.985] cursor-pointer shadow-[0_0_30px_rgba(124,255,107,0.1)] flex items-center justify-center gap-2.5 mx-auto"
          >
            <span>Enter Daffgle</span>
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="text-base text-brand-accent-secondary"
            >
              →
            </motion.span>
          </button>
        </div>
      </motion.div>
    </main>
  );
}