"use client";

import { supabase } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TargetUser = {
  id: string;
  anonymous_username: string;
  department: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const targetUserId = params.userId as string;

  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);

  useEffect(() => {
    const loadTargetUser = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, anonymous_username, department")
        .eq("id", targetUserId)
        .single();

      setTargetUser(data);
    };

    loadTargetUser();
  }, [targetUserId]);

  return (
    <main className="flex h-screen flex-col bg-[#0E1621] text-white">
      <header className="flex items-center gap-4 border-b border-[#22303D] bg-[#17212B] p-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-xl bg-[#2B5278] px-4 py-2 text-sm"
        >
          Back
        </button>

        <div>
          <h1 className="text-lg font-bold">
            {targetUser?.anonymous_username || "Loading..."}
          </h1>
          <p className="text-sm text-gray-400">{targetUser?.department}</p>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center bg-[#0F1A24]">
        <p className="text-gray-400">Chat system coming next...</p>
      </section>
    </main>
  );
}