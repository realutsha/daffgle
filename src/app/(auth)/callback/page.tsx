"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const ADMIN_EMAIL = "madhurzamutsha@gmail.com";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const email = user?.email?.toLowerCase() || "";

      const isDiuEmail = email.endsWith("@diu.edu.bd");
      const isAdminEmail = email === ADMIN_EMAIL;

      if (!user || (!isDiuEmail && !isAdminEmail)) {
        await supabase.auth.signOut();
        router.replace("/login?error=unauthorized");
        return;
      }

      router.replace("/dashboard");
    };

    checkUser();
  }, [router]);

  return (
    <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white">
      <p className="text-gray-400">Verifying your DIU account...</p>
    </main>
  );
}