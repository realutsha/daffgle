"use client";

import { useNightOwl } from "@/hooks/night-owl/useNightOwl";
import { NightMood } from "@/types/night-owl/types";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  PremiumCard, 
  PremiumButton, 
  EmptyState,
  premiumSpring 
} from "@/components/ui/PremiumUI";
import { RefreshCw, Moon, Sparkles, Clock, Lock, CheckCircle2, Star } from "lucide-react";

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
      <div className="flex h-full flex-col items-center justify-center bg-brand-primary text-brand-text-primary px-4">
        <div className="flex flex-col items-center gap-4 animate-pulse select-none">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-border border-t-brand-accent" />
          <p className="text-sm text-brand-text-secondary font-medium">
            Connecting to Night Owl Network...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-brand-primary text-brand-text-primary overflow-hidden">
      
      {/* Cinematic Starry/Cosmic Sky background overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-accent/8 via-transparent to-transparent pointer-events-none" />
      
      {/* Star twinkling animation elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-12 left-1/4 w-1 h-1 bg-white rounded-full animate-ping" />
        <div className="absolute top-1/3 left-3/4 w-1 h-1 bg-white rounded-full animate-pulse" />
        <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-white rounded-full animate-ping" />
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
      </div>

      <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-secondary/90 backdrop-blur px-6 py-5 flex items-center justify-between select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Moon className="h-6 w-6 text-brand-accent shrink-0" />
              Night Owl Mode
            </h1>
            <AnimatePresence>
              {timeState.isActive && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="rounded-full bg-brand-accent/15 border border-brand-accent/30 px-2.5 py-0.5 text-[9px] font-black text-brand-accent uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-[0_0_8px_rgba(201,215,242,0.15)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-ping" />
                  Live
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mt-1">
            Daffgle Late Night Sanctuary
          </p>
        </div>

        <PremiumButton
          onClick={refreshData}
          disabled={submitting}
          variant="secondary"
          className="py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3 shrink-0" />
          Sync Feed
        </PremiumButton>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 z-10 no-scrollbar">
        <div className="mx-auto max-w-4xl space-y-8 pb-20">
          
          {/* LOCKED STATE: Outside 3:00 AM - 6:00 AM BDT */}
          {!timeState.isActive ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-md"
            >
              <PremiumCard className="p-8 text-center space-y-6 relative border-brand-border bg-brand-surface shadow-2xl">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-elevated border border-brand-border text-4xl shadow-inner select-none animate-bounce">
                  <Lock className="h-8 w-8 text-brand-text-secondary" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white">Night Owl is Closed</h2>
                  <p className="text-xs text-brand-accent font-black tracking-widest uppercase">
                    Opens at 3:00 AM BD Time
                  </p>
                </div>

                <p className="text-xs text-brand-text-secondary leading-relaxed px-4">
                  This sanctuary is only accessible between **3:00 AM and 6:00 AM Bangladesh Time (Asia/Dhaka)**. Join us then for anonymous late-night conversations.
                </p>

                <div className="rounded-3xl bg-brand-elevated p-5 border border-brand-border space-y-2 shadow-inner">
                  <p className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest">
                    Sanctuary Unlocks In
                  </p>
                  <p className="text-3xl font-black text-white font-mono tracking-wider animate-pulse">
                    {timeState.timeLeftFormatted}
                  </p>
                </div>

                <div className="text-[10px] text-brand-text-secondary font-semibold uppercase tracking-wider pt-2">
                  Current BD Time: {String(timeState.bdtTime.hour).padStart(2, "0")}:{String(timeState.bdtTime.minute).padStart(2, "0")} BDT
                </div>
              </PremiumCard>
            </motion.div>
          ) : (
            
            /* ACTIVE LIVE STATE: 3:00 AM - 6:00 AM BDT */
            <div className="space-y-8 animate-fade-in">
              
              {/* Header Banner - Breathing Glow animation */}
              <motion.div
                animate={{
                  boxShadow: ["0 0 10px rgba(201,215,242,0.02)", "0 0 25px rgba(201,215,242,0.08)", "0 0 10px rgba(201,215,242,0.02)"]
                }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="rounded-[28px] border border-brand-border bg-brand-surface p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 select-none"
              >
                <div className="space-y-1.5">
                  <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                    Night Owl is Live! 🦉
                  </h2>
                  <p className="text-xs text-brand-text-secondary leading-relaxed max-w-xl">
                    Share a late-night mood anonymously. Other students staying up can accept and connect. Chat messages and sessions automatically vanish at 6:00 AM BDT.
                  </p>
                </div>
                
                <div className="rounded-2xl bg-brand-elevated px-5 py-3 border border-brand-border shrink-0 text-center md:text-right">
                  <p className="text-[9px] font-bold text-brand-accent uppercase tracking-widest mb-0.5">
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
                    <PremiumCard className="p-6 shadow-2xl space-y-4 border-brand-border bg-brand-surface relative overflow-hidden">
                      <div className="absolute top-0 right-0 h-24 w-24 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-accent/10 via-transparent to-transparent pointer-events-none" />
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 border border-brand-border text-2xl select-none">
                        🤝
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-brand-accent">Connection Connected!</h3>
                        <p className="text-xs text-brand-text-secondary leading-relaxed">
                          Your secure, private 1-on-1 chat room is active. Dive back in.
                        </p>
                      </div>
                      <PremiumButton
                        onClick={() => router.push(`/chat/${activeSession.conversation_id}`)}
                        variant="primary"
                        className="w-full py-3.5 text-xs font-black shadow-lg font-bold rounded-2xl"
                      >
                        Enter Anonymous Chat Room
                      </PremiumButton>
                    </PremiumCard>
                  ) :
                  
                  /* CASE B: User Has Active Broadcast Request */
                  myActiveRequest ? (
                    <PremiumCard className="p-6 shadow-2xl space-y-5 border-brand-border bg-brand-surface">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-accent/15 border border-brand-border px-3 py-1 text-[10px] font-black text-brand-accent uppercase tracking-wide">
                          Your Active Mood
                        </span>
                        <span className="text-[10px] text-brand-text-secondary">
                          Waiting for peer...
                        </span>
                      </div>
                      
                      <div className="rounded-2xl bg-brand-elevated p-4 border border-brand-border flex items-center gap-3">
                        <span className="text-3xl select-none">
                          {MOODS.find(m => m.mood === myActiveRequest.mood)?.icon || "👻"}
                        </span>
                        <div>
                          <p className="text-sm font-black text-white">{myActiveRequest.mood}</p>
                          <p className="text-[10px] text-brand-text-secondary">Broadcasting anonymously</p>
                        </div>
                      </div>

                      <PremiumButton
                        onClick={() => deleteRequest(myActiveRequest.id)}
                        disabled={submitting}
                        variant="danger"
                        className="w-full py-3 rounded-2xl text-xs font-bold"
                      >
                        {submitting ? "Cancelling..." : "Cancel Broadcast"}
                      </PremiumButton>
                    </PremiumCard>
                  ) : (
                    
                    /* CASE C: Eligible to Create a Request */
                    <PremiumCard className="p-6 shadow-2xl space-y-6 border-brand-border bg-brand-surface">
                      <div>
                        <h3 className="text-lg font-black text-white">How is your night?</h3>
                        <p className="text-xs text-brand-text-secondary mt-1">
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
                                  ? "border-brand-accent bg-brand-accent/15 shadow-[0_0_8px_rgba(201,215,242,0.1)] text-white"
                                  : "border-brand-border bg-brand-elevated/40 hover:bg-brand-elevated/80 text-brand-text-primary"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl select-none">{icon}</span>
                                <div>
                                  <p className={`text-xs font-extrabold ${isSel ? "text-brand-accent" : "text-white"}`}>
                                    {mood}
                                  </p>
                                  <p className="text-[9px] text-brand-text-secondary mt-0.5">{desc}</p>
                                </div>
                              </div>
                              {isSel && <span className="text-xs text-brand-accent font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      <PremiumButton
                        onClick={handleCreate}
                        disabled={submitting || !selectedMood}
                        variant="primary"
                        className="w-full py-3.5 text-xs font-black shadow-lg font-bold rounded-2xl"
                      >
                        {submitting ? "Broadcasting..." : "Broadcast Mood"}
                      </PremiumButton>
                    </PremiumCard>
                  )}
                </div>

                {/* Right side: Live Peer Requests List */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between select-none">
                    <div>
                      <h3 className="text-lg font-black text-white">Stay Up Together</h3>
                      <p className="text-xs text-brand-text-secondary">
                        Peer moods awaiting connections
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-surface px-3 py-1 text-xs font-bold text-brand-accent border border-brand-border">
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
                          transition={premiumSpring}
                        >
                          <PremiumCard
                            className="p-5 shadow-xl flex items-center justify-between gap-4 border-brand-border bg-brand-surface"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-elevated border border-brand-border text-2xl select-none">
                                {MOODS.find(m => m.mood === req.mood)?.icon || "👻"}
                              </div>
                              <div className="min-w-0">
                                <span className="rounded-full bg-brand-accent/15 border border-brand-border px-2 py-0.2 text-[8px] font-black text-brand-accent uppercase tracking-wide">
                                  Anonymous Owl
                                </span>
                                <h4 className="font-extrabold text-sm text-white truncate mt-1">
                                  {req.mood}
                                </h4>
                                <p className="text-[10px] text-brand-text-secondary mt-0.5">
                                  Stayed up • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>

                            <PremiumButton
                              onClick={() => handleAccept(req)}
                              disabled={submitting || !!activeSession}
                              variant="accent"
                              className="py-2.5 px-4 text-xs font-bold rounded-xl shrink-0"
                            >
                              Connect
                            </PremiumButton>
                          </PremiumCard>
                        </motion.div>
                      ))
                    ) : (
                      <EmptyState
                        icon="🌙"
                        title="Quiet at the moment"
                        description="No anonymous late-night requests are broadcasted right now. Check back shortly or share your own mood to start a secure conversation!"
                      />
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
