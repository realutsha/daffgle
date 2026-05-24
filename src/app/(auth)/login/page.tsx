"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  return (
    <main className="flex h-screen items-center justify-center bg-[#0E1621] px-4">
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
          className="w-full rounded-2xl bg-[#2AABEE] py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading
            ? "Opening Google..."
            : "Continue with DIU Google"}
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          Only @diu.edu.bd students are allowed
        </p>

        {message && (
          <p className="mt-4 text-center text-sm text-gray-400">
            {message}
          </p>
        )}
      </motion.div>
    </main>
  );
}