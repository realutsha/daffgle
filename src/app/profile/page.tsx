"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOffline } from "@/lib/presence";
import { isEmailAllowed } from "@/lib/validations/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Profile = {
  id: string;
  anonymous_username: string;
  department: string;
  gender: string;
  hall?: string;
  karma: number;
  profile_edit_count: number;
  last_profile_edit_at?: string | null;
  warning_badge?: string | null;
};

const DEPARTMENTS = [
  "CSE",
  "SWE",
  "EEE",
  "CE",
  "ME",
  "TE",
  "BBA",
  "English",
  "Pharmacy",
  "Law"
];

const MALE_HALLS = ["YKSG 1", "YKSG 2", "YKSG 3"];
const FEMALE_HALLS = ["RASG 1", "RASG 2"];

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Cooldown states calculated inside pure useEffect
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownRemainingDays, setCooldownRemainingDays] = useState(0);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editHall, setEditHall] = useState("");
  const [saving, setSaving] = useState(false);

  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          .select("id, anonymous_username, department, gender, hall, karma, profile_edit_count, last_profile_edit_at, warning_badge")
          .eq("id", myId)
          .single();

        if (error || !profileData) {
          router.replace("/auth/setup");
          return;
        }

        setProfile(profileData);
        setEditUsername(profileData.anonymous_username || "");
        setEditDepartment(profileData.department || "");
        setEditGender(profileData.gender || "");
        setEditHall(profileData.hall || "");
      } catch (err) {
        console.error("Profile load error:", err);
        toast.error("Failed to load profile details.");
      } finally {
        setLoading(false);
      }
    };

    checkAndLoadProfile();
  }, [router]);

  // Compute cooldown details safely in useEffect to keep render pure
  useEffect(() => {
    if (!profile || profile.profile_edit_count < 2 || !profile.last_profile_edit_at) {
      setCooldownActive(false);
      setCooldownRemainingDays(0);
      return;
    }

    const lastEdit = new Date(profile.last_profile_edit_at).getTime();
    const cooldownPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
    const nextAllowed = lastEdit + cooldownPeriod;
    const active = Date.now() < nextAllowed;
    setCooldownActive(active);

    const diffMs = nextAllowed - Date.now();
    const remaining = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    setCooldownRemainingDays(remaining);
  }, [profile]);

  const handleGenderChange = (newGender: string) => {
    setEditGender(newGender);
    // Reset hall if gender mismatch occurs
    if (newGender === "Male") {
      setEditHall(MALE_HALLS[0]);
    } else if (newGender === "Female") {
      setEditHall(FEMALE_HALLS[0]);
    } else {
      setEditHall("");
    }
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      toast.error("Anonymous username is required.");
      return;
    }

    if (!editDepartment) {
      toast.error("Please select your department.");
      return;
    }

    if (!editGender) {
      toast.error("Please select your gender.");
      return;
    }

    if (!editHall) {
      toast.error("Please select your hall.");
      return;
    }

    // Hall gender constraints matching
    if (editGender === "Male" && !MALE_HALLS.includes(editHall)) {
      toast.error("Male students are restricted to YKSG male halls.");
      return;
    }
    if (editGender === "Female" && !FEMALE_HALLS.includes(editHall)) {
      toast.error("Female students are restricted to RASG female halls.");
      return;
    }

    if (cooldownActive) {
      toast.error(`Profile editing is locked. Cooldown expires in ${cooldownRemainingDays} days.`);
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          anonymous_username: editUsername.trim(),
          department: editDepartment,
          gender: editGender,
          hall: editHall
        })
        .eq("id", userId);

      if (error) {
        toast.error("Save failed: " + error.message);
        return;
      }

      toast.success("Profile saved successfully!");
      setIsEditing(false);

      // Reload profile details
      const { data: updated } = await supabase
        .from("profiles")
        .select("id, anonymous_username, department, gender, hall, karma, profile_edit_count, last_profile_edit_at, warning_badge")
        .eq("id", userId)
        .single();
      if (updated) {
        setProfile(updated);
      }
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete my account") {
      toast.error("Please type the confirmation text exactly.");
      return;
    }

    try {
      setDeleting(true);

      // Fetch active session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("Active session not found. Please log in again.");
        return;
      }

      // Call cascade account deletion API
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Purge execution failed.");
        return;
      }

      // Force disconnect and redirect
      if (userId) {
        await setUserOffline(userId).catch(() => {});
      }
      await supabase.auth.signOut().catch(() => {});
      
      toast.success("Your Daffgle identity and records have been deleted.");
      setShowDeleteModal(false);
      router.replace("/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown deletion failure";
      toast.error("Deletion failed: " + msg);
    } finally {
      setDeleting(false);
    }
  };

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
              Manage your anonymous campus identity
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl bg-[#2B5278] px-4 py-2 text-xs font-bold transition hover:scale-[1.02] hover:opacity-90 cursor-pointer"
          >
            ← Help Hub
          </button>
        </header>

        {/* Profile Details Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl space-y-6"
        >
          {/* Top Info Banner */}
          <div className="flex items-center gap-4 border-b border-[#22303D] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2B5278] text-2xl font-black text-white relative">
              {profile?.anonymous_username?.charAt(0).toUpperCase() || "D"}
              {profile?.warning_badge && (
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-650 text-[10px] font-black text-white animate-pulse">
                  ⚠️
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">
                  {profile?.anonymous_username || "Not set"}
                </h2>
                {profile?.warning_badge && (
                  <span className="rounded-full bg-red-650/15 border border-red-500/25 px-2.5 py-0.5 text-[9px] font-black text-red-400 uppercase tracking-wide animate-pulse">
                    ⚠️ {profile.warning_badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                Anonymous student with <span className="text-[#2AABEE] font-bold">{profile?.karma} Karma rating</span>
              </p>
            </div>
          </div>

          {/* Warning Message for limits */}
          {!isEditing && (
            <div className="rounded-2xl bg-[#0E1621] p-4 border border-[#22303D]/65">
              <p className="text-xs text-gray-400 leading-normal">
                📢 <span className="text-white font-bold">Identity limits:</span> You can edit profile parameters freely 2 times. Starting from the 3rd edit, a strict <span className="text-[#2AABEE] font-bold">30-day cooldown lock</span> applies.
              </p>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                  Total edits count
                </span>
                <span className="rounded-full bg-[#17212B] px-3 py-1 text-xs font-black text-[#2AABEE] border border-[#22303D]">
                  {profile?.profile_edit_count} used
                </span>
              </div>
            </div>
          )}

          {/* Editing State Form fields */}
          {isEditing ? (
            <div className="space-y-4">
              {cooldownActive && (
                <div className="rounded-2xl bg-red-950/20 border border-red-900/40 p-4">
                  <p className="text-xs text-red-400 font-bold leading-normal">
                    🚫 Editing is blocked! Cooldown active. You can edit details again in {cooldownRemainingDays} days.
                  </p>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest ml-1">
                  Anonymous Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  disabled={saving || cooldownActive}
                  placeholder="Enter anonymous username..."
                  className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition disabled:opacity-50"
                />
              </div>

              {/* Department Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest ml-1">
                  Department
                </label>
                <select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  disabled={saving || cooldownActive}
                  className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition disabled:opacity-50"
                >
                  <option value="">-- Choose department --</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest ml-1">
                  Gender
                </label>
                <select
                  value={editGender}
                  onChange={(e) => handleGenderChange(e.target.value)}
                  disabled={saving || cooldownActive}
                  className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition disabled:opacity-50"
                >
                  <option value="">-- Choose gender --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Hall Selector (dependent on gender) */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest ml-1">
                  Campus Hall
                </label>
                <select
                  value={editHall}
                  onChange={(e) => setEditHall(e.target.value)}
                  disabled={saving || cooldownActive || !editGender}
                  className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition disabled:opacity-50"
                >
                  <option value="">-- Choose hall --</option>
                  {editGender === "Male" &&
                    MALE_HALLS.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                  {editGender === "Female" &&
                    FEMALE_HALLS.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-[#0F1A24] border border-[#22303D] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving || cooldownActive}
                  className="flex-1 rounded-2xl bg-[#2AABEE] py-3 text-sm font-black text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#2AABEE]/20"
                >
                  {saving ? "Saving..." : "Save Identity"}
                </button>
              </div>
            </div>
          ) : (
            /* Read Only view mode details grid */
            <div className="space-y-6">
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
                    TRUST REPUTATION
                  </span>
                  <span className="text-base font-black text-[#2AABEE] flex items-center gap-1">
                    🌟 {profile?.karma || 0} Karma rating
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full rounded-2xl bg-[#2AABEE] py-3.5 text-sm font-black text-white hover:scale-[1.01] transition shadow-lg shadow-[#2AABEE]/25 cursor-pointer"
                >
                  Edit Profile Details
                </button>
              </div>
            </div>
          )}

          {/* Privacy Status */}
          <div className="rounded-2xl border border-[#22303D]/60 bg-[#0F1A24] p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              🔒 Privacy Shield
            </h3>
            <p className="text-xs md:text-sm text-gray-400 leading-6">
              Your real identity, phone, and student email are completely shielded. 
              Only your anonymous username (<span className="text-white font-medium">{profile?.anonymous_username}</span>), 
              department, gender, hall, and trust rating are displayed to other students inside chats or help requests.
            </p>
          </div>

          {/* Warning / Account Purging Block */}
          <div className="rounded-2xl bg-red-950/20 border border-red-900/35 p-5 space-y-4">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              ⚠️ Permanent Account Deletion
            </h3>
            <p className="text-xs text-red-300 leading-relaxed">
              Deleting your account is permanent, irreversible, and instantly removes your profile details, open help requests, moderation logs, messages, reports, active conversations, and push notifications tokens.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full sm:w-auto rounded-2xl bg-red-650/80 px-6 py-3 text-xs font-black text-white hover:bg-red-700 transition cursor-pointer"
            >
              Purge Account Permanently
            </button>
          </div>

          {/* Logout Section */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleLogout}
              className="flex-1 rounded-2xl bg-[#0F1A24] border border-[#22303D] py-3.5 font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer text-center text-sm"
            >
              Log Out of Daffgle
            </button>
          </div>
        </motion.div>

        {/* Floating Mobile bottom navigation bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#22303D] bg-[#17212B]/95 px-4 py-3 backdrop-blur md:hidden pb-safe">
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
            <button
              onClick={() => router.push("/")}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
            >
              <span className="text-lg">🏠</span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Home</span>
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
            >
              <span className="text-lg">🤝</span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Help Hub</span>
            </button>

            <button
              onClick={() => router.push("/chat")}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-gray-400 hover:bg-[#182533]/40 transition duration-200 cursor-pointer"
            >
              <span className="text-lg">💬</span>
              <span className="text-[10px] font-bold tracking-wide uppercase">Chats</span>
            </button>

            <button
              onClick={() => router.push("/profile")}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-2xl bg-[#2B5278]/20 text-[#2AABEE] transition duration-200 cursor-pointer"
            >
              <span className="text-lg">👤</span>
              <span className="text-[10px] font-black tracking-wide uppercase">Profile</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Account Deletion Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-red-900/35 bg-[#17212B] p-6 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-950/20 text-3xl">
                  🚨
                </div>
                <h3 className="text-2xl font-black text-red-500 tracking-tight">Irreversible Deletion</h3>
                <p className="text-xs text-gray-400 leading-normal">
                  Are you absolutely certain? This will completely wipe all of your chats, requested items, ratings, and profile parameters. It cannot be recovered.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block text-center">
                  Type <span className="text-red-400 font-extrabold font-mono">delete my account</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type verification text..."
                  disabled={deleting}
                  className="w-full rounded-2xl border border-red-900/30 bg-[#0F1A24] px-4 py-3 text-white focus:border-red-500 outline-none text-center font-semibold text-sm transition"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={deleting}
                  className="flex-1 rounded-2xl bg-[#0F1A24] border border-[#22303D] py-3 text-sm font-bold text-gray-300 transition hover:bg-[#182533] cursor-pointer"
                >
                  Go Back
                </button>

                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText.toLowerCase() !== "delete my account"}
                  className="flex-1 rounded-2xl bg-red-650 py-3 text-sm font-black text-white hover:bg-red-700 transition disabled:opacity-40 cursor-pointer shadow-lg shadow-red-600/20"
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
