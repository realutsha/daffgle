"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { setUserOffline } from "@/lib/presence";
import { isEmailAllowed } from "@/lib/validations/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete, clearCachedProfile } from "@/utils/profile";
import { 
  PremiumCard, 
  PremiumButton, 
  PremiumInput, 
  PremiumSelect, 
  PremiumDialog, 
  FloatingBottomNav, 
  Skeleton, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { ArrowLeft, User, ShieldAlert, Award, Star, Compass, Trash2, Shield, Info, LogOut } from "lucide-react";

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
      <main className="flex h-screen items-center justify-center bg-brand-primary text-white px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-border border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">Loading Profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-primary text-brand-text-primary pb-32 pt-safe">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              My Profile
            </h1>
            <p className="mt-1 text-xs text-brand-text-secondary select-none">
              Manage your anonymous campus statistics
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl bg-brand-surface border border-brand-border px-4 py-2.5 text-xs font-bold text-brand-accent transition hover:bg-brand-elevated cursor-pointer shadow-sm flex items-center gap-1.5"
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
          <PremiumCard className="p-6 border-brand-border bg-brand-surface shadow-xl space-y-6">
            
            {/* Top Identity details */}
            <div className="flex items-center gap-4 border-b border-brand-border pb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-elevated border border-brand-border text-2xl font-black text-brand-accent relative select-none">
                {profile?.anonymous_username?.charAt(0).toUpperCase() || "D"}
                {profile?.warning_badge && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white animate-pulse">
                    ⚠️
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-white/95">
                    {profile?.anonymous_username || "Not set"}
                  </h2>
                  {profile?.warning_badge && (
                    <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[8px] font-bold text-red-400 uppercase tracking-wider animate-pulse select-none">
                      ⚠️ {profile.warning_badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-text-secondary mt-0.5">
                  Verified student with <span className="text-brand-accent font-black">{profile?.karma} Karma point rating</span>
                </p>
              </div>
            </div>

            {/* Editing Limit Warning Box */}
            {!isEditing && (
              <div className="rounded-2xl bg-brand-secondary p-4 border border-brand-border select-none space-y-2.5 shadow-inner">
                <p className="text-xs text-brand-text-secondary leading-normal flex items-start gap-2">
                  <Info className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                  <span>
                    <span className="text-white font-semibold">Identity limits:</span> You can edit profile parameters freely 2 times. Starting from the 3rd edit, a strict <span className="text-brand-accent font-black">30-day cooldown lock</span> applies.
                  </span>
                </p>
                <div className="flex items-center justify-between border-t border-brand-border pt-2.5">
                  <span className="text-[9px] font-bold uppercase text-brand-text-secondary tracking-widest">
                    Total Edits count
                  </span>
                  <span className="rounded-full bg-brand-elevated px-2.5 py-0.5 text-[10px] font-black text-brand-accent border border-brand-border">
                    {profile?.profile_edit_count} used
                  </span>
                </div>
              </div>
            )}

            {/* Editing State Form fields */}
            {isEditing ? (
              <div className="space-y-4">
                
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

                <div className="flex gap-3 pt-2">
                  <PremiumButton
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </PremiumButton>
                  <PremiumButton
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving || cooldownActive}
                    variant="primary"
                    className="flex-1 font-bold shadow-lg"
                  >
                    {saving ? "Saving..." : "Save Identity"}
                  </PremiumButton>
                </div>
              </div>
            ) : (
              /* Read Only Grid */
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-brand-border bg-brand-secondary p-4 shadow-inner">
                    <span className="text-[9px] font-bold text-brand-text-secondary uppercase tracking-widest block mb-1">
                      DEPARTMENT
                    </span>
                    <span className="text-sm font-bold text-white">
                      {profile?.department || "Not set"}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-brand-border bg-brand-secondary p-4 shadow-inner">
                    <span className="text-[9px] font-bold text-brand-text-secondary uppercase tracking-widest block mb-1">
                      GENDER
                    </span>
                    <span className="text-sm font-bold text-white capitalize">
                      {profile?.gender || "Not set"}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-brand-border bg-brand-secondary p-4 shadow-inner">
                    <span className="text-[9px] font-bold text-brand-text-secondary uppercase tracking-widest block mb-1">
                      CAMPUS HALL
                    </span>
                    <span className="text-sm font-bold text-white">
                      {profile?.hall || "Not set"}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-brand-border bg-brand-secondary p-4 shadow-inner">
                    <span className="text-[9px] font-bold text-brand-text-secondary uppercase tracking-widest block mb-1">
                      TRUST REPUTATION
                    </span>
                    <span className="text-sm font-black text-brand-accent flex items-center gap-1 select-none">
                      <Star className="h-4 w-4 text-brand-accent fill-brand-accent" />
                      {profile?.karma || 0} Karma Points
                    </span>
                  </div>
                </div>

                <PremiumButton
                  onClick={() => setIsEditing(true)}
                  variant="accent"
                  className="w-full font-bold shadow-md"
                >
                  Edit Profile Details
                </PremiumButton>
              </div>
            )}

            {/* Privacy Shield Info panel */}
            <div className="rounded-2xl border border-brand-border bg-brand-secondary p-5 select-none space-y-1.5 shadow-inner">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-brand-accent" />
                🔒 Privacy Shield active
              </h3>
              <p className="text-[11px] text-brand-text-secondary leading-relaxed">
                Your real university registration, email, phone number, and student ID are completely shielded. Only your custom anonymous identity parameters and Karma ratings are broadcasted inside Daffgle chat rooms and assistance feeds.
              </p>
            </div>

            {/* Account Purging Dangerous Panel */}
            <div className="rounded-2xl bg-red-500/5 border border-red-500/10 p-5 space-y-3.5 select-none shadow-inner">
              <h3 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                ⚠️ Permanent Account Deletion
              </h3>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                Purging your identity is permanent, irreversible, and instantly deletes your profile parameters, active conversation feeds, messages history, help requests, moderation flags, and notification tokens.
              </p>
              <PremiumButton
                onClick={() => setShowDeleteModal(true)}
                variant="danger"
                className="py-2.5 px-4 text-xs font-bold rounded-xl"
              >
                Purge Account Permanently
              </PremiumButton>
            </div>

            {/* Logout actions */}
            <div className="border-t border-brand-border pt-5">
              <PremiumButton
                onClick={handleLogout}
                variant="secondary"
                className="w-full py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5 opacity-75" />
                Log Out of Daffgle
              </PremiumButton>
            </div>

          </PremiumCard>
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
              <label className="text-[9px] font-bold text-brand-text-secondary uppercase tracking-widest block text-center select-none">
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
