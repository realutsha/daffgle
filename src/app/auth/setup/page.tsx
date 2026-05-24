"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { isEmailAllowed } from "@/lib/validations/auth";

const departments = [
  "CSE",
  "SWE",
  "MCT",
  "CIS",
  "ITM",
  "RME",

  "ICE",
  "TE",
  "EEE",
  "ARCH",
  "CE",

  "BBA",
  "MGT",
  "RE",
  "THM",
  "IE",
  "ACC",
  "F&B",
  "MKT",

  "AGS",
  "FISH",

  "ESDM",
  "PHARM",
  "NFE",
  "PH",
  "PESS",
  "GEB",

  "ENG",
  "LAW",
  "JMC",
  "DS",
];

export default function SetupPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [anonymousUsername, setAnonymousUsername] = useState("");
  const [department, setDepartment] = useState("");
  const [gender, setGender] = useState("");
  const [hall, setHall] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const maleHalls = ["YKSG 1", "YKSG 2", "YKSG 3"];
  const femaleHalls = ["RASG 1", "RASG 2"];

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user || !isEmailAllowed(data.user.email)) {
        if (data.user) {
          await supabase.auth.signOut();
        }
        router.push("/login?error=domain_restricted");
        return;
      }

      setUserId(data.user.id);
    };

    loadUser();
  }, [router]);

  const handleSetup = async () => {
    if (!anonymousUsername || !department || !gender || !hall) {
      setMessage("Please fill all fields.");
      return;
    }

    if (anonymousUsername.length < 3) {
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

    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      anonymous_username: anonymousUsername.trim(),
      department,
      gender,
      hall,
      is_online: true,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="flex h-screen items-center justify-center bg-[#0E1621] px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-[#22303D] bg-[#17212B] p-8"
      >
        <h1 className="text-center text-3xl font-bold text-[#2AABEE]">
          Setup Anonymous Profile
        </h1>

        <p className="mt-2 text-center text-gray-400">
          Your real email stays hidden from users.
        </p>

        <div className="mt-8 space-y-4">
          <input
            value={anonymousUsername}
            onChange={(e) => setAnonymousUsername(e.target.value)}
            placeholder="Anonymous username"
            className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white"
          />

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white"
          >
            <option value="">Select department</option>

            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={gender}
            onChange={(e) => {
              setGender(e.target.value);
              setHall("");
            }}
            className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white"
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <select
            value={hall}
            onChange={(e) => setHall(e.target.value)}
            disabled={!gender}
            className="w-full rounded-2xl border border-[#22303D] bg-[#0F1A24] px-4 py-3 text-white disabled:opacity-50"
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

          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full rounded-2xl bg-[#2AABEE] py-3 font-semibold text-white cursor-pointer"
          >
            {loading ? "Saving..." : "Enter Daffgle"}
          </button>

          {message && (
            <p className="text-center text-sm text-gray-400">
              {message}
            </p>
          )}
        </div>
      </motion.div>
    </main>
  );
}