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
    <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white">
      Verifying your Daffgle account...
    </main>
  );
}