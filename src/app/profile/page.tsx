"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOffline } from "@/lib/presence";
import { isEmailAllowed } from "@/lib/validations/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";
import { 
  PremiumButton, 
  PremiumInput, 
  PremiumSelect, 
  PremiumDialog, 
  FloatingBottomNav, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { ArrowLeft, User, ShieldAlert, Star, Shield, Info, LogOut, BookOpen, Home } from "lucide-react";

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
  { value: "CSE", label: "CSE" },
  { value: "SWE", label: "SWE" },
  { value: "EEE", label: "EEE" },
  { value: "CE", label: "CE" },
  { value: "ME", label: "ME" },
  { value: "TE", label: "TE" },
  { value: "BBA", label: "BBA" },
  { value: "English", label: "English" },
  { value: "Pharmacy", label: "Pharmacy" },
  { value: "Law", label: "Law" }
];

const GENDERS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" }
];

const MALE_HALLS = [
  { value: "YKSG 1", label: "YKSG 1" },
  { value: "YKSG 2", label: "YKSG 2" },
  { value: "YKSG 3", label: "YKSG 3" }
];

const FEMALE_HALLS = [
  { value: "RASG 1", label: "RASG 1" },
  { value: "RASG 2", label: "RASG 2" }
];

export default function ProfilePage() {
  const router = useRouter();
  const { featureToggles } = useAppSettings();

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

        // Fetch user anonymous profile details using unified safety utility
        const { data: profileData } = await fetchProfileSafely(myId);

        const complete = isProfileComplete(profileData);

        if (!complete || !profileData) {
          toast.error("Please complete your profile setup first!");
          router.replace("/auth/setup");
          return;
        }

        setProfile(profileData as Profile);
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

  const hallOptions = useMemo(() => {
    if (editGender === "Male") return MALE_HALLS;
    if (editGender === "Female") return FEMALE_HALLS;
    return [];
  }, [editGender]);

  const handleGenderChange = (newGender: string) => {
    setEditGender(newGender);
    // Reset hall if gender mismatch occurs
    if (newGender === "Male") {
      setEditHall(MALE_HALLS[0].value);
    } else if (newGender === "Female") {
      setEditHall(FEMALE_HALLS[0].value);
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

    const maleHallValues = MALE_HALLS.map(h => h.value);
    if (editGender === "Male" && !maleHallValues.includes(editHall)) {
      toast.error("Male students are restricted to YKSG male halls.");
      return;
    }

    const femaleHallValues = FEMALE_HALLS.map(h => h.value);
    if (editGender === "Female" && !femaleHallValues.includes(editHall)) {
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

      // Reload profile details using safe fetch (updates cache automatically)
      const { data: updated } = await fetchProfileSafely(userId);
      if (updated) {
        setProfile(updated as Profile);
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
      clearCachedProfile();
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
      clearCachedProfile();
      await supabase.auth.signOut();
      toast.success("Signed out successfully!");
      router.replace("/login");
    } catch {
      toast.error("Logout failed.");
    }
  };

  // Background Chats Unread Counter
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const fetchUnread = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id")
        .neq("sender_id", userId)
        .eq("seen", false);
      setUnreadChatsCount(data?.length || 0);
    };
    fetchUnread();
  }, [userId]);

  // Floating Bottom Navigation Data
  const bottomNavItems = [
    { label: "Home", icon: "🏠", onClick: () => router.push("/"), isActive: false },
    { label: "Help Hub", icon: "🤝", onClick: () => router.push("/dashboard"), isActive: false },
    { label: "Chats", icon: "💬", onClick: () => router.push("/chat"), isActive: false, badge: unreadChatsCount },
    { label: "Sanctuary", icon: "🦉", onClick: () => router.push("/night-owl"), isActive: false },
    { label: "Profile", icon: "👤", onClick: () => router.push("/profile"), isActive: true },
  ];

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-[#39FF88]" />
          <p className="text-sm text-gray-400 font-medium tracking-wide">Loading Profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0E1621] text-white pb-36 pt-safe relative overflow-hidden">
      {/* Premium Top Glow Orb */}
      <div className="absolute top-[-250px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#39FF88]/5 blur-[120px] pointer-events-none" />

      <div className="mx-auto w-full max-w-2xl px-4 pt-8 relative z-10">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              My Profile
            </h1>
            <p className="mt-1 text-xs text-gray-400 select-none tracking-wide">
              Manage your anonymous campus statistics
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03, y: -0.5 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl bg-[#17212B] border border-white/5 px-4.5 py-3 text-xs font-bold text-[#39FF88] transition hover:bg-[#1E293B] hover:border-[#39FF88]/30 cursor-pointer shadow-lg flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Help Hub
          </motion.button>
        </header>

        {/* Profile Details Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={premiumSpring}
          className="space-y-6"
        >
          {/* Main Card Panel */}
          <div className="rounded-[32px] border border-white/[0.08] bg-[#17212B] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl bg-opacity-[0.95] space-y-8 relative overflow-hidden">
            {/* Internal Gloss Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.003] via-transparent to-white/[0.012] pointer-events-none" />
            
            {/* Top Identity Centered Section */}
            <div className="flex flex-col items-center text-center pb-6 border-b border-white/[0.08] relative">
              <motion.div
                whileHover={{ scale: 1.05, rotate: [0, -1, 1, 0] }}
                transition={premiumSpring}
                className="relative flex h-28 w-28 items-center justify-center rounded-[36px] bg-[#0E1621] border-2 border-[#39FF88]/25 text-4xl font-black text-[#39FF88] select-none shadow-[0_0_35px_rgba(57,255,136,0.12)] mb-4 group cursor-pointer"
              >
                {/* Subtle Breathing Inner Ring */}
                <div className="absolute inset-0 rounded-[36px] border border-[#39FF88]/30 animate-pulse-glow opacity-30" />
                <span className="drop-shadow-[0_0_12px_rgba(57,255,136,0.5)]">
                  {profile?.anonymous_username?.charAt(0).toUpperCase() || "D"}
                </span>
                
                {profile?.warning_badge && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white border-2 border-[#17212B] shadow-lg animate-pulse">
                    ⚠️
                  </span>
                )}
              </motion.div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {profile?.anonymous_username || "Not set"}
                  </h2>
                  {profile?.warning_badge && (
                    <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[8px] font-black text-red-400 uppercase tracking-wider animate-pulse select-none">
                      ⚠️ {profile.warning_badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 font-semibold flex-wrap">
                  <span className="flex items-center gap-1 bg-[#39FF88]/10 text-[#39FF88] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-[#39FF88]/20 shadow-[0_0_15px_rgba(57,255,136,0.08)]">
                    <Star className="h-3 w-3 fill-[#39FF88] text-[#39FF88]" />
                    {profile?.karma || 0} Karma Rating
                  </span>
                  <span className="text-white/20 select-none">•</span>
                  <span className="text-gray-400">Verified Student</span>
                </div>
              </div>
            </div>

            {/* Editing Limit Warning Box */}
            {!isEditing && (
              <div className="rounded-2xl bg-[#1E293B]/60 p-5 border border-white/[0.06] select-none space-y-4 shadow-inner relative overflow-hidden">
                <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-3">
                  <Info className="h-4.5 w-4.5 text-[#39FF88] shrink-0 mt-0.5 drop-shadow-[0_0_6px_rgba(57,255,136,0.4)]" />
                  <span>
                    <span className="text-white font-bold block mb-0.5">Identity parameters:</span>
                    You can edit profile parameters freely 2 times. Starting from the 3rd edit, a strict <span className="text-[#39FF88] font-bold">30-day cooldown lock</span> applies to shield the campus identity pool.
                  </span>
                </p>
                
                <div className="border-t border-white/[0.06] pt-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-gray-400 tracking-widest">
                      Total Edits count
                    </span>
                    <span className="rounded-full bg-[#0E1621] px-3 py-1 text-[10px] font-black text-[#39FF88] border border-white/5">
                      {profile?.profile_edit_count || 0} / 2 used
                    </span>
                  </div>
                  {/* Elegant progress track */}
                  <div className="h-1.5 w-full bg-[#0E1621] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#39FF88] to-[#7CFF6B] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(57,255,136,0.4)]"
                      style={{ width: `${Math.min(100, ((profile?.profile_edit_count || 0) / 2) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Editing State Form fields */}
            {isEditing ? (
              <div className="space-y-5">
                
                {/* Active Cooldown Lock Alert */}
                {cooldownActive && (
                  <div className="rounded-2xl bg-red-500/5 border border-red-500/15 p-4 flex gap-3 select-none">
                    <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400 font-semibold leading-normal">
                      🚫 Identity parameters are locked. Cooldown active. You can edit details again in {cooldownRemainingDays} days.
                    </p>
                  </div>
                )}

                {/* Username parameter */}
                <PremiumInput
                  label="Anonymous Username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  disabled={saving || cooldownActive}
                  placeholder="Enter anonymous username..."
                  leftIcon={<User className="h-4 w-4 opacity-50" />}
                />

                {/* Department selector */}
                <PremiumSelect
                  label="Academic Department"
                  value={editDepartment}
                  onChange={setEditDepartment}
                  options={DEPARTMENTS}
                  placeholder="Select department..."
                  disabled={saving || cooldownActive}
                />

                {/* Gender selector */}
                <PremiumSelect
                  label="Gender"
                  value={editGender}
                  onChange={handleGenderChange}
                  options={GENDERS}
                  placeholder="Select gender..."
                  disabled={saving || cooldownActive}
                />

                {/* Hall selector */}
                <PremiumSelect
                  label="Residence Hall"
                  value={editHall}
                  onChange={setEditHall}
                  options={hallOptions}
                  placeholder={editGender ? "Choose residence hall..." : "Please select gender first"}
                  disabled={saving || cooldownActive || !editGender}
                />

                <div className="flex gap-4 pt-2 flex-col sm:flex-row">
                  <PremiumButton
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    variant="secondary"
                    className="flex-1 py-3 text-xs font-bold rounded-2xl bg-[#0E1621] border-white/5 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </PremiumButton>
                  <PremiumButton
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving || cooldownActive}
                    variant="primary"
                    className="flex-1 py-3 text-xs font-bold rounded-2xl bg-gradient-to-r from-[#39FF88] to-[#7CFF6B] text-black border-transparent hover:shadow-[0_0_20px_rgba(57,255,136,0.25)] font-black uppercase tracking-wider"
                  >
                    {saving ? "Saving..." : "Save Identity"}
                  </PremiumButton>
                </div>
              </div>
            ) : (
              /* Read Only Grid */
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  {/* Card 1: Department */}
                  <motion.div
                    whileHover={{ y: -4, scale: 1.015, borderColor: "rgba(57, 255, 136, 0.2)" }}
                    className="rounded-2xl border border-white/5 bg-[#0E1621]/60 p-4.5 flex items-center gap-4 transition-all duration-300 shadow-inner group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">
                        Department
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {profile?.department || "Not set"}
                      </span>
                    </div>
                  </motion.div>

                  {/* Card 2: Gender */}
                  <motion.div
                    whileHover={{ y: -4, scale: 1.015, borderColor: "rgba(57, 255, 136, 0.2)" }}
                    className="rounded-2xl border border-white/5 bg-[#0E1621]/60 p-4.5 flex items-center gap-4 transition-all duration-300 shadow-inner group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">
                        Gender
                      </span>
                      <span className="text-sm font-extrabold text-white capitalize">
                        {profile?.gender || "Not set"}
                      </span>
                    </div>
                  </motion.div>

                  {/* Card 3: Residence Hall */}
                  <motion.div
                    whileHover={{ y: -4, scale: 1.015, borderColor: "rgba(57, 255, 136, 0.2)" }}
                    className="rounded-2xl border border-white/5 bg-[#0E1621]/60 p-4.5 flex items-center gap-4 transition-all duration-300 shadow-inner group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">
                        Campus Hall
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {profile?.hall || "Not set"}
                      </span>
                    </div>
                  </motion.div>

                  {/* Card 4: Karma Score */}
                  <motion.div
                    whileHover={{ y: -4, scale: 1.015, borderColor: "rgba(57, 255, 136, 0.2)" }}
                    className="rounded-2xl border border-white/5 bg-[#0E1621]/60 p-4.5 flex items-center gap-4 transition-all duration-300 shadow-inner group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#39FF88]/10 text-[#39FF88] group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(57,255,136,0.1)]">
                      <Star className="h-5 w-5 fill-[#39FF88]" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">
                        Trust Reputation
                      </span>
                      <span className="text-sm font-extrabold text-[#39FF88] flex items-center gap-1">
                        {profile?.karma || 0} Karma Points
                      </span>
                    </div>
                  </motion.div>
                </div>

                <PremiumButton
                  onClick={() => {
                    if (!featureToggles.profile_editing) {
                      toast.error("Profile parameter updates are temporarily restricted by Admin.");
                      return;
                    }
                    setIsEditing(true);
                  }}
                  disabled={!featureToggles.profile_editing}
                  variant="accent"
                  className="w-full py-4 text-xs font-black uppercase tracking-widest rounded-2xl bg-gradient-to-r from-[#39FF88]/10 to-[#7CFF6B]/10 border border-[#39FF88]/20 text-[#39FF88] hover:border-[#39FF88] hover:shadow-[0_0_20px_rgba(57,255,136,0.15)] transition-all"
                >
                  Edit Profile Details
                </PremiumButton>
              </div>
            )}

            {/* Privacy Shield Info panel */}
            <div className="rounded-2xl border border-[#39FF88]/10 bg-[#1E293B]/40 p-5 select-none space-y-2 shadow-inner backdrop-blur-sm">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-[#39FF88] drop-shadow-[0_0_6px_rgba(57,255,136,0.4)]" />
                <span>Privacy Shield Active</span>
              </h3>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                Your real university registration, email, phone number, and student ID are completely shielded. Only your custom anonymous identity parameters and Karma ratings are broadcasted inside Daffgle chat rooms and assistance feeds.
              </p>
            </div>

            {/* Account Purging Dangerous Panel */}
            <div className="rounded-2xl bg-red-500/[0.02] border border-red-500/10 p-5 space-y-3.5 select-none shadow-inner">
              <h3 className="text-xs font-bold text-red-400 flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-red-400 shrink-0" />
                <span>Permanent Account Deletion</span>
              </h3>
              <p className="text-[11px] text-red-300/80 leading-relaxed font-semibold">
                Purging your identity is permanent, irreversible, and instantly deletes your profile parameters, active conversation feeds, messages history, help requests, moderation flags, and notification tokens.
              </p>
              <PremiumButton
                onClick={() => setShowDeleteModal(true)}
                variant="danger"
                className="w-full py-3.5 text-xs font-bold rounded-2xl bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/25 hover:border-red-500 transition-all shadow-[0_0_15px_rgba(239,68,68,0.05)]"
              >
                Purge Account Permanently
              </PremiumButton>
            </div>

            {/* Logout actions */}
            <div className="border-t border-white/[0.08] pt-6">
              <PremiumButton
                onClick={handleLogout}
                variant="secondary"
                className="w-full py-4 text-xs font-bold rounded-2xl border-white/5 bg-[#0E1621] text-gray-400 hover:text-white flex items-center justify-center gap-2"
              >
                <LogOut className="h-3.5 w-3.5 opacity-75" />
                Log Out of Daffgle
              </PremiumButton>
            </div>

          </div>
        </motion.div>

        {/* Floating Mobile Bottom Navigation Bar (Mobile only) */}
        <FloatingBottomNav items={bottomNavItems} />

        {/* Account Deletion Confirmation Dialog */}
        <PremiumDialog
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText("");
          }}
          title="Irreversible Purge"
          description="Are you absolutely certain? This will wipe your anonymous identity and erase all of your conversation histories permanently."
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block text-center select-none">
                Type <span className="text-red-400 font-extrabold font-mono">delete my account</span> to confirm
              </label>
              <PremiumInput
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type confirmation text..."
                disabled={deleting}
                className="text-center font-semibold placeholder:text-white/10"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <PremiumButton
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                variant="secondary"
                className="flex-1"
              >
                Go Back
              </PremiumButton>

              <PremiumButton
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.toLowerCase() !== "delete my account"}
                variant="danger"
                className="flex-1 font-bold"
              >
                {deleting ? "Purging..." : "Permanently Delete"}
              </PremiumButton>
            </div>
          </div>
        </PremiumDialog>

      </div>
    </main>
  );
}
