"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    if (
      !email.endsWith("@diu.edu.bd") &&
      email !== "admin@daffgle.com"
    ) {
      setMessage("Only DIU emails are allowed.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: "http://localhost:3000/dashboard",
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("OTP login link sent to your email.");
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

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Enter your DIU email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white placeholder:text-gray-500"
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-2xl bg-[#2AABEE] py-3 font-semibold text-white transition hover:opacity-90"
          >
            {loading ? "Sending..." : "Continue"}
          </button>

          {message && (
            <p className="text-center text-sm text-gray-400">
              {message}
            </p>
          )}
        </div>
      </motion.div>
    </main>
  );
}