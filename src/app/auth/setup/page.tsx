"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { isEmailAllowed } from "@/lib/validations/auth";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete, setCachedProfile } from "@/utils/profile";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { 
  PremiumInput, 
  PremiumSelect, 
  PremiumButton, 
  PremiumCard, 
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { ShieldCheck, User, School, Sparkles, AlertCircle } from "lucide-react";

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

export default function SetupPage() {
  const router = useRouter();
  const { featureToggles } = useAppSettings();

  const [userId, setUserId] = useState("");
  const [anonymousUsername, setAnonymousUsername] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");
  const [hall, setHall] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadUserAndProfile = async () => {
      try {
        const { data } = await supabase.auth.getUser();

        if (!data.user || !isEmailAllowed(data.user.email)) {
          if (data.user) {
            await supabase.auth.signOut();
          }
          router.push("/login?error=domain_restricted");
          return;
        }

        const myId = data.user.id;
        setUserId(myId);

        // Fetch existing profile to check completion or pre-populate fields
        const { data: profile } = await fetchProfileSafely(myId);

        if (profile) {
          if (profile.anonymous_username) setAnonymousUsername(profile.anonymous_username);
          if (profile.department) setDepartment(profile.department);
          if (profile.gender) setGender(profile.gender);
          if (profile.hall) setHall(profile.hall);

          // Unified completeness rule
          const isComplete = isProfileComplete(profile);

          if (isComplete) {
            // Already complete! Do not force setup, go to dashboard directly
            router.replace("/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Setup load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUserAndProfile();
  }, [router]);

  const hallOptions = useMemo(() => {
    if (gender === "Male") return MALE_HALLS;
    if (gender === "Female") return FEMALE_HALLS;
    return [];
  }, [gender]);

  const handleSetup = async () => {
    if (!anonymousUsername.trim() || !department || !gender || !hall) {
      setMessage("Please fill all fields.");
      return;
    }

    if (anonymousUsername.trim().length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    const maleHallValues = MALE_HALLS.map(h => h.value);
    if (gender === "Male" && !maleHallValues.includes(hall)) {
      setMessage("Invalid hall selected for Male.");
      return;
    }

    const femaleHallValues = FEMALE_HALLS.map(h => h.value);
    if (gender === "Female" && !femaleHallValues.includes(hall)) {
      setMessage("Invalid hall selected for Female.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const updatePayload = {
        id: userId,
        anonymous_username: anonymousUsername.trim(),
        department,
        gender,
        hall,
        is_online: true,
      };

      const { error } = await supabase.from("profiles").upsert(updatePayload);

      if (error) {
        setMessage(error.message);
        return;
      }

      // Update the client cache with successful profile details
      setCachedProfile({
        ...updatePayload,
        karma: 0,
        notification_enabled: true,
        warning_badge: null,
      });

      toast.success("Profile setup completed successfully!");
      router.push("/dashboard");
    } catch {
      setMessage("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#111111] text-white px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/5 border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">Syncing profile status...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111111] px-4 py-8 relative overflow-hidden">
      
      {/* Starry Sky Atmosphere & Glow overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 bg-white rounded-full animate-star-twinkle pointer-events-none" />
      <div className="absolute top-1/2 left-2/3 w-1 h-1 bg-white rounded-full animate-star-twinkle pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={premiumSpring}
        className="w-full max-w-md z-10"
      >
        <PremiumCard className="p-8 border-white/5 bg-brand-surface shadow-2xl space-y-6">
          
          {/* Welcoming cinematic Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent/5 border border-brand-accent/15 shadow-inner">
              <Sparkles className="h-6 w-6 text-brand-accent" />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white/95">
              Welcome to Daffgle
            </h1>
            <p className="text-xs text-brand-text-secondary max-w-xs mx-auto leading-relaxed select-none">
              Verify your campus residence and establish your anonymous identity. Real names, student IDs, and emails remain hidden.
            </p>
          </div>

          {/* Form setup fields */}
          <div className="space-y-4">
            
            {/* Username Input */}
            <PremiumInput
              label="Anonymous Username"
              value={anonymousUsername}
              onChange={(e) => setAnonymousUsername(e.target.value)}
              placeholder="e.g., SilentOwl, CyberSwan..."
              leftIcon={<User className="h-4 w-4 opacity-50" />}
              disabled={saving}
            />

            {/* Department Dropdown Selector */}
            <PremiumSelect
              label="Academic Department"
              value={department}
              onChange={setDepartment}
              options={DEPARTMENTS}
              placeholder="Select your department..."
              disabled={saving}
            />

            {/* Gender Dropdown Selector */}
            <PremiumSelect
              label="Gender"
              value={gender}
              onChange={(val) => {
                setGender(val);
                setHall("");
              }}
              options={GENDERS}
              placeholder="Choose gender..."
              disabled={saving}
            />

            {/* Campus Hall Dropdown Selector */}
            <PremiumSelect
              label="Campus Residence Hall"
              value={hall}
              onChange={setHall}
              options={hallOptions}
              placeholder={gender ? "Select residence hall..." : "Please select gender first"}
              disabled={saving || !gender}
            />

            {/* Shield Callout info */}
            <div className="rounded-2xl border border-brand-accent/10 bg-brand-accent/5 p-4 flex gap-3 select-none">
              <ShieldCheck className="h-5 w-5 text-[#C9D7F2] shrink-0 mt-0.5" />
              <p className="text-[11px] text-brand-text-secondary leading-normal">
                <span className="text-white font-semibold">Privacy Shield active</span>: Daffgle restricts student verification to campus networks and halls to guarantee academic anonymity.
              </p>
            </div>

            {/* Primary Action Setup Button */}
            <PremiumButton
              onClick={() => {
                if (!featureToggles.registrations) {
                  toast.error("Registrations are temporarily restricted by Admin.");
                  return;
                }
                handleSetup();
              }}
              isLoading={saving}
              disabled={!featureToggles.registrations}
              variant="primary"
              className="w-full font-bold py-3.5 mt-2 shadow-lg"
            >
              Enter Daffgle
            </PremiumButton>

            <AnimatePresence>
              {message && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs text-red-400 font-bold leading-normal flex items-center justify-center gap-1 mt-2 select-none"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </PremiumCard>
      </motion.div>
    </main>
  );
}