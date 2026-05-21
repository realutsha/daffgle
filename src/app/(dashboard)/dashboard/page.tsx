"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Profile = {
  anonymous_username: string;
  department: string;
  gender: string;
  is_online: boolean;
};

type OnlineUser = {
  id: string;
  anonymous_username: string;
  department: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const filteredUsers = useMemo(() => {
    return onlineUsers.filter((user) =>
      user.anonymous_username.toLowerCase().includes(search.toLowerCase())
    );
  }, [onlineUsers, search]);

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("anonymous_username, department, gender, is_online")
        .eq("id", userData.user.id)
        .single();

      if (!profileData) {
        router.push("/setup");
        return;
      }

      setProfile(profileData);

      const { data: users } = await supabase
        .from("profiles")
        .select("id, anonymous_username, department")
        .eq("is_online", true);

      if (users) {
        setOnlineUsers(users);
      }

      setLoading(false);
    };

    loadDashboard();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white">
        Loading Daffgle...
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-[#0E1621] text-white">
      <aside className="hidden w-80 border-r border-[#22303D] bg-[#17212B] md:block">
        <div className="border-b border-[#22303D] p-5">
          <h1 className="text-2xl font-bold text-[#2AABEE]">Daffgle</h1>
          <p className="text-sm text-gray-400">Online DIU Students</p>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-[#0F1A24] p-4">
            <p className="font-semibold">{profile?.anonymous_username}</p>
            <p className="text-sm text-gray-400">{profile?.department}</p>
            <p className="mt-2 text-xs text-green-400">● Online</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-2xl bg-[#2B5278] py-3 text-sm font-semibold hover:opacity-90"
          >
            Logout
          </button>
        </div>
      </aside>

      <section className="flex flex-1 items-center justify-center bg-[#0F1A24] p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <h2 className="text-4xl font-bold text-[#2AABEE]">
            Welcome to Daffgle
          </h2>

          <div className="mt-6 rounded-2xl border border-[#22303D] bg-[#17212B] p-5 text-left">
            <h3 className="mb-4 text-lg font-semibold text-[#2AABEE]">
              Online Users
            </h3>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anonymous username..."
              className="mb-4 w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-sm text-white placeholder:text-gray-500"
            />

            <div className="max-h-80 space-y-3 overflow-y-auto">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-xl bg-[#0E1621] p-4"
                  >
                    <div>
                      <p className="font-medium">{user.anonymous_username}</p>
                      <p className="text-sm text-gray-400">{user.department}</p>
                    </div>

                    <button
  onClick={() => router.push(`/chat/${user.id}`)}
  className="rounded-xl bg-[#2AABEE] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
>
  Chat
</button>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-gray-400">
                  No online users found.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}