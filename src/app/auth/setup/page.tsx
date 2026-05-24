"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { isEmailAllowed } from "@/lib/validations/auth";
import { toast } from "sonner";
import { fetchProfileSafely, isProfileComplete, setCachedProfile } from "@/utils/profile";

const departments = [
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

const maleHalls = ["YKSG 1", "YKSG 2", "YKSG 3"];
const femaleHalls = ["RASG 1", "RASG 2"];

export default function SetupPage() {
  const router = useRouter();

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

  const handleSetup = async () => {
    if (!anonymousUsername.trim() || !department || !gender || !hall) {
      setMessage("Please fill all fields.");
      return;
    }

    if (anonymousUsername.trim().length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    if (gender === "Male" && !maleHalls.includes(hall)) {
      setMessage("Invalid hall selected for Male.");
      return;
    }

    if (gender === "Female" && !femaleHalls.includes(hall)) {
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
      <main className="flex h-screen items-center justify-center bg-[#0E1621] text-white px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">Syncing profile status...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen items-center justify-center bg-[#0E1621] px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-[#22303D] bg-[#17212B] p-8 shadow-2xl space-y-6"
      >
        <div>
          <h1 className="text-center text-3xl font-black text-[#2AABEE] tracking-tight">
            Setup Profile
          </h1>
          <p className="mt-1.5 text-center text-xs text-gray-400">
            Real emails, student IDs, and phone numbers remain strictly hidden.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              Anonymous Username
            </label>
            <input
              value={anonymousUsername}
              onChange={(e) => setAnonymousUsername(e.target.value)}
              placeholder="Enter username..."
              className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition"
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                setHall("");
              }}
              className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white focus:border-[#2AABEE] outline-none transition"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              Campus Hall
            </label>
            <select
              value={hall}
              onChange={(e) => setHall(e.target.value)}
              disabled={!gender}
              className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white disabled:opacity-50 focus:border-[#2AABEE] outline-none transition"
            >
              <option value="">Select hall</option>
              {gender === "Male" &&
                maleHalls.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              {gender === "Female" &&
                femaleHalls.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
            </select>
          </div>

          <button
            onClick={handleSetup}
            disabled={saving}
            className="w-full rounded-2xl bg-[#2AABEE] py-3.5 font-bold text-white cursor-pointer hover:opacity-95 transition shadow-lg shadow-[#2AABEE]/20 mt-2"
          >
            {saving ? "Saving profile..." : "Enter Daffgle"}
          </button>

          {message && (
            <p className="text-center text-sm text-red-400 font-semibold leading-normal animate-shake">
              ⚠️ {message}
            </p>
          )}
        </div>
      </motion.div>
    </main>
  );
}