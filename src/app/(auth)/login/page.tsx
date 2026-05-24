"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { isEmailAllowed } from "@/lib/validations/auth";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (isEmailAllowed(user.email)) {
          router.replace("/dashboard");
        } else {
          await supabase.auth.signOut();
          setMessage("Access denied: Only @diu.edu.bd emails are allowed.");
          setCheckingSession(false);
        }
      } else {
        setCheckingSession(false);
      }
    };

    const errorParam = searchParams.get("error");
    if (errorParam === "domain_restricted") {
      setMessage("Access denied: Only @diu.edu.bd emails are allowed.");
    }

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
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
        <p className="text-sm text-gray-400 font-medium animate-pulse">Loading Daffgle...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-3xl border border-[#22303D] bg-[#17212B] p-8 shadow-2xl"
    >
      <h1 className="mb-2 text-center text-4xl font-bold text-[#2AABEE]">
        Daffgle
      </h1>

      <p className="mb-8 text-center text-gray-400">
        Anonymous Realtime Chat for DIU Students
      </p>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full rounded-2xl bg-[#2AABEE] py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60 cursor-pointer"
      >
        {loading
          ? "Opening Google..."
          : "Continue with DIU Google"}
      </button>

      <p className="mt-4 text-center text-xs text-gray-500">
        Only @diu.edu.bd students are allowed
      </p>

      {message && (
        <p className="mt-4 text-center text-sm text-red-400 font-semibold">
          {message}
        </p>
      )}
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex h-screen items-center justify-center bg-[#0E1621] px-4">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">Loading Daffgle...</p>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </main>
  );
}