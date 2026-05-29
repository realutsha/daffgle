"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { isEmailAllowed } from "@/lib/validations/auth";
import { ShieldAlert, Sparkles, ArrowRight } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Core Authentication states
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  // Session verification on mount
  useEffect(() => {
    const checkSession = async () => {
      const errorParam = searchParams.get("error");
      if (errorParam === "domain_restricted") {
        setMessage("Access denied: Only @diu.edu.bd university emails are allowed.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (isEmailAllowed(user.email)) {
          router.replace("/dashboard");
        } else {
          await supabase.auth.signOut();
          setMessage("Access denied: Only @diu.edu.bd university emails are allowed.");
          setCheckingSession(false);
        }
      } else {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [router, searchParams]);

  // Handle Google OAuth (Functional)
  const handleGoogleLogin = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setMessage("");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "https://daffgle.vercel.app/auth/callback",
        },
      });

      if (error) {
        setMessage(error.message || "Google login failed.");
      }
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Render initial synchronization state
  if (checkingSession) {
    return (
      <div className="flex flex-col items-center gap-5 select-none animate-pulse z-10 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute h-full w-full animate-spin rounded-full border-4 border-white/5 border-t-[#2AABEE] shadow-[0_0_20px_rgba(42,171,238,0.2)]" />
          <span className="text-xl">🛡️</span>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#2AABEE]">
            Syncing Secure Gateway
          </p>
          <p className="text-[10px] text-gray-500 font-medium">Verifying campus connection...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className="w-full max-w-[400px] z-10 px-4"
    >
      {/* Premium Glassmorphic Login Card */}
      <div className="relative border border-white/[0.08] bg-[#17212B]/75 backdrop-blur-[24px] rounded-[26px] p-8 md:p-10 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8),_0_0_50px_rgba(42,171,238,0.06)] overflow-hidden text-center">
        {/* Sleek top glowing border bar */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#2AABEE] to-transparent opacity-85" />

        {/* Branding & Identification */}
        <div className="flex flex-col items-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/[0.08] bg-[#0E1621]/90 shadow-[0_8px_25px_rgba(0,0,0,0.5)]">
            <Image
              src="/logo.png"
              alt="Daffgle Logo"
              width={72}
              height={72}
              className="object-contain"
              priority
            />
            <div className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#2AABEE] text-[9px] font-black text-white tracking-wider shadow-lg shadow-[#2AABEE]/20 border-2 border-[#17212B]">
              DIU
            </div>
          </div>

          <div className="mt-5 text-center">
            <h1 className="text-3xl font-black tracking-tight text-white uppercase tracking-wider drop-shadow-md">
              Daffgle
            </h1>
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-bold text-[#2AABEE] uppercase tracking-[0.22em] select-none">
                Anonymous Realtime Student Communication
              </p>
              <p className="text-xs text-white/50 font-medium select-none">
                Verified DIU students only
              </p>
            </div>
          </div>
        </div>

        {/* Large Premium "Continue with Google" Action Button */}
        <div className="mt-8 mb-6">
          <motion.button
            onClick={handleGoogleLogin}
            disabled={loading}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className="w-full flex items-center justify-between bg-[#2AABEE] hover:bg-[#2AABEE]/95 text-white rounded-full py-4.5 pl-7 pr-5 text-sm font-bold tracking-wide transition-colors duration-300 shadow-[0_6px_30px_rgba(42,171,238,0.4)] hover:shadow-[0_8px_35px_rgba(42,171,238,0.5)] group cursor-pointer relative overflow-hidden"
          >
            {loading ? (
              <div className="w-full flex items-center justify-center gap-3 py-0.5">
                <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span className="text-xs uppercase tracking-widest text-white/90 font-black animate-pulse">
                  Connecting...
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {/* Google Custom Minimal Logo */}
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-black text-[10px] font-black shrink-0 shadow-sm">
                    G
                  </div>
                  <span className="font-bold text-sm tracking-wide">Continue with Google</span>
                </div>
                
                {/* Sliding Arrow container */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 shrink-0 group-hover:bg-white/20 transition-all duration-300">
                  <motion.div
                    variants={{
                      hover: { x: 3, scale: 1.05 },
                      initial: { x: 0, scale: 1 }
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <ArrowRight className="h-4.5 w-4.5" />
                  </motion.div>
                </div>
              </>
            )}
          </motion.button>
        </div>

        {/* Small Verification & Trust Notice */}
        <div className="flex items-center justify-center gap-2 text-[9px] font-black text-[#2AABEE] uppercase tracking-[0.2em] select-none py-1">
          <Sparkles className="h-3 w-3 shrink-0 animate-pulse" />
          <span>Only @diu.edu.bd emails allowed</span>
        </div>

        {/* Error warnings container */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl border border-[#FF4D4D]/30 bg-[#FF4D4D]/5 p-4 flex gap-3 text-left shadow-[0_0_20px_rgba(255,77,77,0.04)]"
            >
              <ShieldAlert className="h-5 w-5 text-[#FF4D4D] shrink-0 mt-0.5" />
              <p className="text-xs text-[#FF4D4D] font-semibold leading-relaxed">
                {message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0E1621] text-white px-4 relative overflow-hidden select-none">
      
      {/* 1. Custom CSS Styles containing Premium Floating Animations, Particles, and Shifting Glows */}
      <style jsx global>{`
        /* Slow Moving Dotted Grid Overlay */
        .premium-cyber-grid {
          position: absolute;
          inset: -50px;
          background-image: 
            radial-gradient(rgba(42, 171, 238, 0.08) 1.5px, transparent 0);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse at center, black 35%, transparent 75%);
          pointer-events: none;
          z-index: 0;
          opacity: 0.85;
          animation: backgroundMove 40s linear infinite;
        }

        @keyframes backgroundMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(28px, 28px);
          }
        }

        /* Ambient Shifting Neon Glow Orb 1 (Accent Blue) */
        .glow-orb-blue {
          position: absolute;
          width: 550px;
          height: 550px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(42, 171, 238, 0.09) 0%, rgba(42, 171, 238, 0.015) 60%, transparent 100%);
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
          animation: floatGlowOne 20s infinite ease-in-out;
        }

        /* Ambient Shifting Neon Glow Orb 2 (Secondary Deep Blue) */
        .glow-orb-indigo {
          position: absolute;
          width: 450px;
          height: 450px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(15, 26, 36, 0.6) 0%, rgba(14, 22, 33, 0.2) 65%, transparent 100%);
          filter: blur(60px);
          pointer-events: none;
          z-index: 0;
          animation: floatGlowTwo 25s infinite ease-in-out;
        }

        @keyframes floatGlowOne {
          0%, 100% {
            transform: translate(-10%, -10%) scale(1);
          }
          50% {
            transform: translate(15%, 20%) scale(1.15);
          }
        }

        @keyframes floatGlowTwo {
          0%, 100% {
            transform: translate(15%, 15%) scale(1.1);
          }
          50% {
            transform: translate(-10%, -20%) scale(0.9);
          }
        }

        /* Lightweight pure CSS floating particles */
        .floating-particles-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(42, 171, 238, 0.25);
          box-shadow: 0 0 8px rgba(42, 171, 238, 0.6);
          bottom: -10px;
          animation: particleRise 14s infinite linear;
        }

        @keyframes particleRise {
          0% {
            transform: translateY(0) translateX(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-110vh) translateX(50px) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>

      {/* 2. Layered Animated CSS Background Grid and Shifting Glows */}
      <div className="premium-cyber-grid" />
      <div className="glow-orb-blue top-[10%] left-[10%]" />
      <div className="glow-orb-indigo bottom-[15%] right-[10%]" />

      {/* 3. Floating Lightweight CSS Particles */}
      <div className="floating-particles-container select-none">
        <div className="particle left-[15%]" style={{ animationDelay: "0s", animationDuration: "14s" }} />
        <div className="particle left-[30%]" style={{ animationDelay: "3s", animationDuration: "17s" }} />
        <div className="particle left-[45%]" style={{ animationDelay: "1.5s", animationDuration: "15s" }} />
        <div className="particle left-[65%]" style={{ animationDelay: "5.5s", animationDuration: "19s" }} />
        <div className="particle left-[80%]" style={{ animationDelay: "2.2s", animationDuration: "16s" }} />
        <div className="particle left-[90%]" style={{ animationDelay: "7s", animationDuration: "13s" }} />
      </div>

      {/* 4. Main Interactive Login Component with Suspense safety */}
      <Suspense fallback={
        <div className="flex flex-col items-center gap-5 select-none animate-pulse z-10 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute h-full w-full animate-spin rounded-full border-4 border-white/5 border-t-[#2AABEE] shadow-[0_0_20px_rgba(42,171,238,0.2)]" />
            <span className="text-xl">🛡️</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#2AABEE]">
              Syncing Secure Gateway
            </p>
            <p className="text-[10px] text-gray-500 font-medium">Verifying campus connection...</p>
          </div>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </main>
  );
}