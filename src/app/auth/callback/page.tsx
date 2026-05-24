"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const ADMIN_EMAIL = "madhurzamutsha@gmail.com";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const verifyUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const email = data.user.email?.toLowerCase() || "";

      const allowed =
        email.endsWith("@diu.edu.bd") || email === ADMIN_EMAIL;

      if (!allowed) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      router.replace("/dashboard");
    };

    verifyUser();
  }, [router]);

  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[#0E1621] text-white px-4">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute h-full w-full animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE] shadow-lg shadow-[#2AABEE]/10" />
          <span className="text-xl">👻</span>
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-[#2AABEE] tracking-tight animate-pulse">
            Daffgle
          </h1>
          <p className="text-sm text-gray-400 font-medium">
            Verifying your DIU Google account...
          </p>
        </div>
      </div>
    </main>
  );
}