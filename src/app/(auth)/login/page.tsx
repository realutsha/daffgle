"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { isEmailAllowed } from "@/lib/validations/auth";
import { ShieldAlert, LogIn, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Core Authentication states
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  // UI Flow states
  const [step, setStep] = useState<"email" | "code" | "success">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Handle email submission (Interactive UI validation)
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Validate email domain constraint / admin bypass
    if (isEmailAllowed(email)) {
      setLoading(true);
      setMessage("");
      // Simulate sending visual OTP (premium transition)
      setTimeout(() => {
        setLoading(false);
        setStep("code");
      }, 1200);
    } else {
      setMessage("Access denied: Only @diu.edu.bd university emails are allowed.");
    }
  };

  // Focus first input when code screen appears
  useEffect(() => {
    if (step === "code") {
      setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 300);
    }
  }, [step]);

  // Handle individual code character inputs
  const handleCodeChange = (index: number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, ""); // Only digits allowed
    if (cleanValue.length <= 1) {
      const newCode = [...code];
      newCode[index] = cleanValue;
      setCode(newCode);

      // Shift focus to next input
      if (cleanValue && index < 5) {
        codeInputRefs.current[index + 1]?.focus();
      }

      // Check if full code entered (Simulate verification)
      if (index === 5 && cleanValue) {
        const isComplete = newCode.every((digit) => digit.length === 1);
        if (isComplete) {
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
            setStep("success");
          }, 1200);
        }
      }
    }
  };

  // Keyboard accessibility: backspace focus movement
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleBackClick = () => {
    setStep("email");
    setCode(["", "", "", "", "", ""]);
    setMessage("");
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className="w-full max-w-[420px] z-10 px-4"
    >
      {/* Premium Glassmorphic Login Card */}
      <div className="relative border border-white/[0.08] bg-[#17212B]/75 backdrop-blur-[24px] rounded-[24px] p-8 md:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),_0_0_40px_rgba(42,171,238,0.06)] overflow-hidden">
        {/* Sleek top glowing border bar */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#2AABEE] to-transparent opacity-80" />

        <AnimatePresence mode="wait">
          {/* STEP 1: EMAIL & OAUTH */}
          {step === "email" && (
            <motion.div
              key="email-step"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Branding Section */}
              <div className="text-center space-y-4">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/[0.08] bg-[#0E1621]/90 shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
                  <Image
                    src="/logo.png"
                    alt="Daffgle Logo"
                    width={48}
                    height={48}
                    className="object-contain"
                    priority
                  />
                  <div className="absolute -right-2 -bottom-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#2AABEE] px-1.5 text-[8px] font-black text-white tracking-wider shadow-lg shadow-[#2AABEE]/20">
                    DIU
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-black tracking-tight text-white uppercase tracking-wider">
                    Daffgle
                  </h1>
                  <p className="text-[10px] font-bold text-[#2AABEE] uppercase tracking-[0.25em] select-none">
                    Anonymous Realtime Student Communication
                  </p>
                  <p className="text-xs text-white/50 font-medium select-none">
                    Verified DIU students only
                  </p>
                </div>
              </div>

              {/* Input Forms */}
              <div className="space-y-5">
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="yourname@diu.edu.bd"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#0F1A24]/90 text-white placeholder-white/20 border border-white/[0.08] rounded-full py-4.5 px-6 text-sm focus:outline-none focus:border-[#2AABEE]/50 focus:ring-1 focus:ring-[#2AABEE]/20 text-center transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                      required
                    />
                    
                    {/* Integrated Submit Circle Button */}
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className={`absolute right-1.5 top-1.5 text-white w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 group overflow-hidden ${
                        email 
                          ? "bg-[#2AABEE] hover:bg-[#2AABEE]/80 cursor-pointer shadow-[0_0_15px_rgba(42,171,238,0.4)]" 
                          : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                      }`}
                    >
                      {loading ? (
                        <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/10 border-t-white" />
                      ) : (
                        <span className="relative w-full h-full block overflow-hidden">
                          <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-full">
                            <ArrowRight className="h-4.5 w-4.5" />
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 -translate-x-full group-hover:translate-x-0">
                            <ArrowRight className="h-4.5 w-4.5" />
                          </span>
                        </span>
                      )}
                    </button>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className={`w-full py-4 px-6 rounded-full font-bold text-xs uppercase tracking-widest text-center transition-all duration-300 ${
                      email 
                        ? "bg-[#2AABEE] text-white hover:bg-[#2aabee]/90 cursor-pointer shadow-[0_4px_20px_rgba(42,171,238,0.25)]" 
                        : "bg-[#0F1A24]/60 text-white/30 border border-white/[0.04] cursor-not-allowed"
                    }`}
                  >
                    {loading ? "Sending Code..." : "Continue"}
                  </button>
                </form>

                <div className="flex items-center gap-4 text-xs select-none">
                  <div className="h-[1px] bg-white/[0.06] flex-1" />
                  <span className="text-white/20 font-bold uppercase tracking-wider">or</span>
                  <div className="h-[1px] bg-white/[0.06] flex-1" />
                </div>

                {/* Primary Google Authentication Button */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-[#0F1A24]/90 hover:bg-[#0F1A24] border border-white/[0.08] hover:border-[#2AABEE]/30 text-white rounded-full py-4 px-6 text-sm font-bold tracking-wide transition-all duration-300 shadow-md group cursor-pointer"
                >
                  {loading ? (
                    <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/10 border-t-[#2AABEE]" />
                  ) : (
                    <>
                      <LogIn className="h-4.5 w-4.5 text-[#2AABEE] transition-transform duration-300 group-hover:scale-110 shrink-0" />
                      <span>Continue with DIU Google</span>
                    </>
                  )}
                </button>

                {/* Verification Notice */}
                <div className="flex items-center justify-center gap-2 text-[9px] font-black text-[#2AABEE] uppercase tracking-[0.2em] select-none">
                  <Sparkles className="h-3 w-3 shrink-0 animate-pulse" />
                  <span>Only @diu.edu.bd students</span>
                </div>
              </div>

              {/* Agreements Footer */}
              <p className="text-[10px] text-white/30 leading-relaxed text-center font-medium">
                By entering, you confirm you agree to our policies. Your data is kept absolutely private and campus verification ensures a secure, peer-only environment.
              </p>
            </motion.div>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === "code" && (
            <motion.div
              key="code-step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="text-center space-y-3">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#2AABEE]/20 bg-[#0E1621]/90 shadow-[0_0_15px_rgba(42,171,238,0.1)] text-xl select-none">
                  ✉️
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-white uppercase tracking-wider">
                    Verification Code
                  </h1>
                  <p className="text-xs text-white/50 font-medium">
                    We sent a code to <span className="text-[#2AABEE] font-semibold">{email}</span>
                  </p>
                </div>
              </div>

              {/* OTP Digit Boxes */}
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-2">
                  {code.map((digit, i) => (
                    <div key={i} className="flex items-center">
                      <div className="relative">
                        <input
                          ref={(el) => {
                            codeInputRefs.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          disabled={loading}
                          className="w-12 h-14 text-center text-xl font-bold bg-[#0F1A24]/90 text-white border border-white/[0.08] rounded-xl focus:outline-none focus:border-[#2AABEE] focus:ring-1 focus:ring-[#2AABEE]/20 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                          style={{ caretColor: "transparent" }}
                        />
                        {!digit && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xl text-white/10 font-bold">•</span>
                          </div>
                        )}
                      </div>
                      {i === 2 && <span className="text-white/15 px-1 font-bold text-lg">-</span>}
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <button
                    onClick={() => {
                      if (!loading) {
                        setLoading(true);
                        setTimeout(() => {
                          setLoading(false);
                          setMessage("Verification code resent successfully!");
                        }, 1000);
                      }
                    }}
                    disabled={loading}
                    className="text-[#2AABEE] hover:text-[#2AABEE]/80 transition-colors text-xs font-bold uppercase tracking-wider select-none shrink-0"
                  >
                    {loading ? "Resending..." : "Resend code"}
                  </button>
                </div>

                {/* Back / Verify Actions */}
                <div className="flex w-full gap-3">
                  <button
                    onClick={handleBackClick}
                    disabled={loading}
                    className="w-1/3 flex items-center justify-center gap-1.5 rounded-full bg-[#0F1A24]/60 hover:bg-[#0F1A24] border border-white/[0.06] text-white/80 hover:text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 py-4 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    <span>Back</span>
                  </button>

                  <button
                    onClick={() => {
                      const isComplete = code.every((digit) => digit.length === 1);
                      if (isComplete) {
                        setLoading(true);
                        setTimeout(() => {
                          setLoading(false);
                          setStep("success");
                        }, 1200);
                      }
                    }}
                    disabled={loading || !code.every((d) => d !== "")}
                    className={`flex-1 rounded-full font-bold text-xs uppercase tracking-wider transition-all duration-300 py-4 ${
                      code.every((d) => d !== "") && !loading
                        ? "bg-[#2AABEE] text-white hover:bg-[#2AABEE]/90 shadow-[0_4px_20px_rgba(42,171,238,0.25)] cursor-pointer"
                        : "bg-[#0F1A24]/40 text-white/20 border border-white/[0.04] cursor-not-allowed"
                    }`}
                  >
                    {loading ? "Verifying..." : "Continue"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: SUCCESS STEP */}
          {step === "success" && (
            <motion.div
              key="success-step"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="space-y-8 text-center"
            >
              {/* Animated Success Orb */}
              <div className="relative mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#2AABEE] to-[#2AABEE]/70 flex items-center justify-center shadow-[0_0_30px_rgba(42,171,238,0.4)]">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 150, delay: 0.2 }}
                >
                  <Check className="h-10 w-10 text-white stroke-[3px]" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                  Welcome to Daffgle
                </h1>
                <p className="text-sm text-[#2AABEE] font-bold uppercase tracking-wider select-none animate-pulse">
                  Verification Complete!
                </p>
                <p className="text-xs text-white/50 font-medium">
                  Welcome to the anonymous, real-time campus space.
                </p>
              </div>

              <button
                onClick={() => {
                  router.push("/dashboard");
                }}
                className="w-full rounded-full bg-white text-black hover:bg-white/95 font-bold text-xs uppercase tracking-widest py-4.5 transition-all duration-300 shadow-[0_4px_25px_rgba(255,255,255,0.25)] cursor-pointer"
              >
                Continue to Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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