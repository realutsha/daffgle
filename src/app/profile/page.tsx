"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOffline } from "@/lib/presence";
import { isEmailAllowed } from "@/lib/validations/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Profile = {
  anonymous_username: string;
  department: string;
  gender?: string;
  hall?: string;
  is_online: boolean;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const checkAndLoadProfile = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user || !isEmailAllowed(userData.user.email)) {
          if (userData.user) {
            await supabase.auth.signOut();
          }
          router.replace("/login?error=domain_restricted");
          return;
        }

        const myId = userData.user.id;
        setUserId(myId);

        // Fetch user anonymous profile details
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("anonymous_username, department, gender, hall, is_online")
          .eq("id", myId)
          .single();

        if (error || !profileData) {
          router.replace("/auth/setup");
          return;
        }

        setProfile(profileData);
      } catch (err) {
        console.error("Profile load error:", err);
        toast.error("Failed to load profile details.");
      } finally {
        setLoading(false);
      }
    };

    checkAndLoadProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      if (userId) {
        await setUserOffline(userId);
      }
      await supabase.auth.signOut();
      toast.success("Signed out successfully!");
      router.replace("/login");
    } catch {
      toast.error("Logout failed.");
    }
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">Loading Profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0E1621] text-white pb-32">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[#2AABEE] tracking-tight">
              My Profile
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Your anonymous student identity
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl bg-[#2B5278] px-4 py-2 text-xs font-bold transition hover:scale-[1.02] hover:opacity-90 cursor-pointer"
          >
            ← Help Hub
          </button>
        </header>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl space-y-6"
        >
          {/* Top Info Banner */}
          <div className="flex items-center gap-4 border-b border-[#22303D] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2B5278] text-2xl font-black text-white">
              {profile?.anonymous_username?.charAt(0).toUpperCase() || "D"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {profile?.anonymous_username || "Not set"}
              </h2>
              <p className="text-sm text-gray-400">
                Anonymous {profile?.department || "Not set"} Student
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#22303D]/60 bg-[#0F1A24] p-4">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                DEPARTMENT
              </span>
              <span className="text-base font-bold text-white">
                {profile?.department || "Not set"}
              </span>
            </div>

            <div className="rounded-2xl border border-[#22303D]/60 bg-[#0F1A24] p-4">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                GENDER
              </span>
              <span className="text-base font-bold text-white capitalize">
                {profile?.gender || "Not set"}
              </span>
            </div>

            <div className="rounded-2xl border border-[#22303D]/60 bg-[#0F1A24] p-4">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                CAMPUS HALL
              </span>
              <span className="text-base font-bold text-white">
                {profile?.hall || "Not set"}
              </span>
            </div>

            <div className="rounded-2xl border border-[#22303D]/60 bg-[#0F1A24] p-4">
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                VERIFICATION STATUS
              </span>
              <span className="text-base font-bold text-[#2AABEE] flex items-center gap-1">
                🛡️ DIU Student Verified
              </span>
            </div>
          </div>

          {/* Privacy Status */}
          <div className="rounded-2xl border border-[#22303D]/60 bg-[#0F1A24] p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              🔒 Privacy Shield
            </h3>
            <p className="text-sm text-gray-400 leading-6">
              Your real identity and student email are completely shielded. 
              Only your anonymous username (<span className="text-white font-medium">{profile?.anonymous_username}</span>), 
              department, gender, and hall are displayed to other students inside chats or active help requests.
            </p>
          </div>

          {/* Safety & Accountability Note */}
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-2">
              ⚠️ Safety & Accountability Note
            </h3>
            <p className="text-xs text-amber-300/90 leading-6">
              Daffgle provides secure, anonymous 1-to-1 interactions for the DIU community. 
              While other students cannot trace your real identity, users remain accountable to 
              administrative moderation to protect the safety of the community. 
              Any reports of harassment, threats, or abuse are logged and reviewed. Please be respectful.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleLogout}
              className="flex-1 rounded-2xl bg-red-600/90 py-3.5 font-bold text-white transition hover:bg-red-700 cursor-pointer text-center text-sm"
            >
              Log Out of Daffgle
            </button>
          </div>
        </motion.div>

        {/* Footer Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533] cursor-pointer"
            >
              Help Hub
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="rounded-2xl bg-[#0F1A24] py-3 text-sm font-bold text-gray-300 transition duration-200 hover:bg-[#182533] cursor-pointer"
            >
              My Chats
            </button>

            <button
              onClick={() => router.push("/profile")}
              className="rounded-2xl bg-[#2AABEE] py-3 text-sm font-black text-white shadow-lg shadow-[#2AABEE]/20 cursor-pointer"
            >
              Profile
            </button>
          </div>
        </nav>
      </div>
    </main>
  );
}
