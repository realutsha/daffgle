"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { isEmailAllowed } from "@/lib/validations/auth";
import { 
  PremiumButton, 
  PremiumCard, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { Sparkles, ShieldAlert, ArrowRight, LogIn } from "lucide-react";


function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

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

  if (checkingSession) {
    return (
      <div className="flex flex-col items-center gap-4 select-none animate-pulse">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-brand-accent" />
        <p className="text-sm text-brand-text-secondary font-medium">Entering Daffgle...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={premiumSpring}
      className="w-full max-w-md z-10"
    >
      <PremiumCard className="p-8 border-white/5 bg-brand-surface shadow-2xl space-y-8 text-center relative">
        
        {/* Branding vector logo */}
        <div className="space-y-4">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] shadow-2xl">
            <img
              src="/logo.png"
              alt="Daffgle Logo"
              className="h-16 w-16 object-contain"
            />

            <span className="absolute -right-2 -bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#d9e6ff] text-xs font-black text-black shadow-lg">
              DIU
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-white/95">
              Daffgle
            </h1>
            <p className="text-xs text-brand-text-secondary uppercase tracking-widest select-none">
              Anonymous Realtime Campus Network
            </p>
          </div>
        </div>

        <p className="text-sm text-brand-text-secondary leading-relaxed max-w-xs mx-auto">
          Connect, communicate, and solve real campus needs securely and completely anonymously with verified peers.
        </p>

        {/* Primary OAuth login CTA button */}
        <div className="space-y-4">
          <PremiumButton
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="primary"
            className="w-full font-bold py-3.5 shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              "Opening Google..."
            ) : (
              <>
                <LogIn className="h-4 w-4 text-brand-primary shrink-0" />
                Continue with DIU Google
              </>
            )}
          </PremiumButton>

          <div className="flex items-center justify-center gap-1.5 select-none text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest">
            <span>🛡️ Domain Verified</span>
            <span>•</span>
            <span>Only @diu.edu.bd students</span>
          </div>
        </div>

        {/* Error warnings container */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-red-500/10 bg-red-500/5 p-4 flex gap-3 text-left"
            >
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-semibold leading-normal">
                {message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </PremiumCard>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111111] px-4 relative overflow-hidden">
      
      {/* Background visual atmospheric glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-star-twinkle pointer-events-none" />
      <div className="absolute top-3/4 left-3/4 w-1.5 h-1.5 bg-white rounded-full animate-star-twinkle pointer-events-none" />

      <Suspense fallback={
        <div className="flex flex-col items-center gap-4 select-none animate-pulse">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">Entering Daffgle...</p>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </main>
  );
}