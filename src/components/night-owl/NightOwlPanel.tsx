"use client";

import { useNightOwl } from "@/hooks/night-owl/useNightOwl";
import { NightMood } from "@/types/night-owl/types";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MOODS: { mood: NightMood; icon: string; desc: string }[] = [
  { mood: "Can’t sleep", icon: "🥱", desc: "Tossing and turning" },
  { mood: "Studying", icon: "📚", desc: "Tackling prep work" },
  { mood: "Coding all night", icon: "💻", desc: "Bugs and keyboard clicks" },
  { mood: "Need conversation", icon: "☕", desc: "Looking for a warm talk" },
  { mood: "Feeling lonely", icon: "🌙", desc: "Just want some company" },
];

export default function NightOwlPanel() {
  const router = useRouter();
  const {
    currentUser,
    profile,
    requests,
    myActiveRequest,
    activeSession,
    loading,
    submitting,
    timeState,
    createRequest,
    deleteRequest,
    acceptRequest,
    refreshData,
  } = useNightOwl();

  const [selectedMood, setSelectedMood] = useState<NightMood | "">("");

  const handleCreate = async () => {
    if (!selectedMood) {
      toast.error("Please select a mood first.");
      return;
    }
    await createRequest(selectedMood);
    setSelectedMood("");
  };

  const handleAccept = async (request: any) => {
    const conversationId = await acceptRequest(request);
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0E1621] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2B5278]/30 border-t-[#2AABEE]" />
          <p className="text-sm text-gray-400 font-medium animate-pulse">
            Connecting to Night Owl Network...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#0E1621] text-white overflow-hidden">
      {/* Cinematic Starry/Cosmic Sky background overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#0E1621] to-[#0E1621] pointer-events-none" />
      
      {/* Star twinkling animation elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-12 left-1/4 w-1 h-1 bg-white rounded-full animate-ping" />
        <div className="absolute top-1/3 left-3/4 w-1 h-1 bg-white rounded-full animate-pulse" />
        <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-white rounded-full animate-ping" />
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
      </div>

      <header className="sticky top-0 z-30 border-b border-[#22303D] bg-[#17212B]/90 backdrop-blur px-6 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-[#2AABEE] flex items-center gap-2 select-none">
              <span>🦉</span> Night Owl Mode
            </h1>
            <AnimatePresence>
              {timeState.isActive && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="rounded-full bg-[#2AABEE]/15 border border-[#2AABEE]/30 px-2.5 py-0.5 text-[10px] font-black text-[#2AABEE] uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-[0_0_8px_rgba(42,171,238,0.2)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2AABEE]" />
                  Live
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
            Daffgle Late Night Sanctuary
          </p>
        </div>

        <button
          onClick={refreshData}
          disabled={submitting}
          className="rounded-2xl bg-[#2B5278] px-4 py-2 text-xs font-bold transition hover:scale-[1.02] hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          Sync Feed
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 z-10">
        <div className="mx-auto max-w-4xl space-y-8">
          
          {/* LOCKED STATE: Outside 3:00 AM - 6:00 AM BDT */}
          {!timeState.isActive ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-md rounded-4xl border border-[#22303D] bg-[#17212B]/95 p-8 shadow-2xl text-center space-y-6 relative"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0E1621] border border-[#22303D] text-4xl shadow-inner select-none animate-bounce">
                🔒
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-gray-300">Night Owl is Closed</h2>
                <p className="text-sm text-[#2AABEE] font-black tracking-wide uppercase">
                  Opens at 3:00 AM BD Time
                </p>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed px-4">
                This sanctuary is only accessible between **3:00 AM and 6:00 AM Bangladesh Time (Asia/Dhaka)**. Join us then for anonymous late-night conversations.
              </p>

              <div className="rounded-3xl bg-[#0E1621] p-5 border border-[#22303D]/60 space-y-2 shadow-inner">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Sanctuary Unlocks In
                </p>
                <p className="text-3xl font-black text-white font-mono tracking-wider animate-pulse">
                  {timeState.timeLeftFormatted}
                </p>
              </div>

              <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider pt-2">
                Current BD Time: {String(timeState.bdtTime.hour).padStart(2, "0")}:{String(timeState.bdtTime.minute).padStart(2, "0")} BDT
              </div>
            </motion.div>
          ) : (
            
            /* ACTIVE LIVE STATE: 3:00 AM - 6:00 AM BDT */
            <div className="space-y-8 animate-fade-in">
              
              {/* Header Banner - Breathing Glow animation */}
              <motion.div
                animate={{
                  boxShadow: ["0 0 10px rgba(42,171,238,0.1)", "0 0 25px rgba(42,171,238,0.25)", "0 0 10px rgba(42,171,238,0.1)"]
                }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="rounded-3xl border border-[#2AABEE]/20 bg-[#17212B] p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-1.5">
                  <h2 className="text-xl md:text-2xl font-black text-white">Night Owl is Live! 🦉</h2>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-xl">
                    Share a late-night mood anonymously. Other students staying up can accept and connect. Chat messages and sessions automatically vanish at 6:00 AM BDT.
                  </p>
                </div>
                
                <div className="rounded-2xl bg-[#0E1621] px-5 py-3 border border-[#22303D] shrink-0 text-center md:text-right">
                  <p className="text-[9px] font-bold text-[#2AABEE] uppercase tracking-widest mb-0.5">
                    Sanctuary Closes In
                  </p>
                  <p className="text-xl font-extrabold text-white font-mono tracking-wide">
                    {timeState.timeLeftFormatted}
                  </p>
                </div>
              </motion.div>

              <div className="grid gap-8 md:grid-cols-12">
                {/* Left side: Create Request / Show Active Session */}
                <div className="md:col-span-5 space-y-6">
                  
                  {/* CASE A: Active Ongoing Chat Session */}
                  {activeSession ? (
                    <div className="rounded-3xl border border-green-500/25 bg-[#17212B] p-6 shadow-2xl space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 text-2xl select-none">
                        🤝
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-green-400">Connection Connected!</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Your secure, private 1-on-1 chat room is active. Dive back in.
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/chat/${activeSession.conversation_id}`)}
                        className="w-full rounded-2xl bg-green-600 hover:bg-green-700 py-3.5 text-xs font-black text-white shadow-lg transition duration-200 cursor-pointer"
                      >
                        Enter Anonymous Chat Room
                      </button>
                    </div>
                  ) :
                  
                  /* CASE B: User Has Active Broadcast Request */
                  myActiveRequest ? (
                    <div className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl space-y-5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-[#2AABEE]/15 px-3 py-1 text-[10px] font-black text-[#2AABEE] uppercase tracking-wide">
                          Your Active Mood
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Waiting for peer...
                        </span>
                      </div>
                      
                      <div className="rounded-2xl bg-[#0E1621] p-4 border border-[#22303D] flex items-center gap-3">
                        <span className="text-3xl select-none">
                          {MOODS.find(m => m.mood === myActiveRequest.mood)?.icon || "👻"}
                        </span>
                        <div>
                          <p className="text-base font-black text-white">{myActiveRequest.mood}</p>
                          <p className="text-xs text-gray-400">Broadcasting anonymously</p>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteRequest(myActiveRequest.id)}
                        disabled={submitting}
                        className="w-full rounded-2xl bg-red-650/20 border border-red-500/20 py-3 text-xs font-bold text-red-400 hover:bg-red-650/30 transition duration-200 cursor-pointer"
                      >
                        {submitting ? "Cancelling..." : "Cancel Broadcast"}
                      </button>
                    </div>
                  ) : (
                    
                    /* CASE C: Eligible to Create a Request */
                    <div className="rounded-3xl border border-[#22303D] bg-[#17212B] p-6 shadow-2xl space-y-6">
                      <div>
                        <h3 className="text-lg font-black text-white">How is your night going?</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Select a mood to broadcast anonymous peer help.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {MOODS.map(({ mood, icon, desc }) => {
                          const isSel = selectedMood === mood;
                          return (
                            <button
                              key={mood}
                              onClick={() => setSelectedMood(mood)}
                              className={`w-full rounded-2xl border p-3 flex items-center justify-between text-left transition duration-200 cursor-pointer ${
                                isSel
                                  ? "border-[#2AABEE] bg-[#2AABEE]/10 shadow-[0_0_8px_rgba(42,171,238,0.1)]"
                                  : "border-[#22303D]/60 bg-[#0F1A24] hover:bg-[#182533]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl select-none">{icon}</span>
                                <div>
                                  <p className={`text-xs font-extrabold ${isSel ? "text-[#2AABEE]" : "text-white"}`}>
                                    {mood}
                                  </p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                                </div>
                              </div>
                              {isSel && <span className="text-xs text-[#2AABEE] font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleCreate}
                        disabled={submitting || !selectedMood}
                        className="w-full rounded-2xl bg-[#2AABEE] hover:opacity-90 py-3.5 text-xs font-black text-white shadow-lg shadow-[#2AABEE]/20 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {submitting ? "Broadcasting..." : "Broadcast Mood"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right side: Live Peer Requests List */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white">Stay Up Together</h3>
                      <p className="text-xs text-gray-400">
                        Peer moods awaiting connections
                      </p>
                    </div>
                    <span className="rounded-full bg-[#17212B] px-3.5 py-1 text-xs font-bold text-[#2AABEE] border border-[#22303D]">
                      {requests.length} open
                    </span>
                  </div>

                  <div className="space-y-3">
                    {requests.length > 0 ? (
                      requests.map((req) => (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-3xl border border-[#22303D] bg-[#17212B] p-5 shadow-xl flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0E1621] border border-[#22303D] text-2xl select-none">
                              {MOODS.find(m => m.mood === req.mood)?.icon || "👻"}
                            </div>
                            <div className="min-w-0">
                              <span className="rounded-full bg-[#2AABEE]/10 border border-[#2AABEE]/25 px-2 py-0.2 text-[8px] font-black text-[#2AABEE] uppercase tracking-wide">
                                Anonymous Owl
                              </span>
                              <h4 className="font-extrabold text-sm text-white truncate mt-1">
                                {req.mood}
                              </h4>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Stayed up • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAccept(req)}
                            disabled={submitting || !!activeSession}
                            className="rounded-xl bg-[#2AABEE] hover:opacity-90 px-4 py-2.5 text-xs font-black text-white shadow-md transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                          >
                            Connect
                          </button>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-16 text-center border border-dashed border-[#22303D] rounded-3xl bg-[#17212B]/40">
                        <p className="text-4xl select-none">🌙</p>
                        <h4 className="mt-4 text-base font-bold text-gray-300">Quiet at the moment</h4>
                        <p className="mt-2 text-xs text-gray-400 max-w-sm mx-auto leading-relaxed px-4">
                          No anonymous late-night requests are broadcasted right now. Check back shortly or share your own mood to start a secure conversation!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
