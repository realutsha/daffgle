"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        router.replace("/chat");
      } else {
        router.replace("/login");
      }
    };

    checkUser();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0E1621] text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-[#2AABEE]">
          Daffgle
        </h1>

        <p className="mt-4 text-lg text-gray-400">
          Anonymous Realtime Chat for DIU Students
        </p>
      </div>
    </main>
  );
}