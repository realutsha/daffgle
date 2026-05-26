import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { getNightOwlState, isNightOwlActive } from "@/lib/night-owl/time";
import { NightRequest, NightSession, NightMood, NightOwlTimeState } from "@/types/night-owl/types";
import { toast } from "sonner";
import { fetchProfileSafely } from "@/utils/profile";

export function useNightOwl() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [requests, setRequests] = useState<NightRequest[]>([]);
  const [myActiveRequest, setMyActiveRequest] = useState<NightRequest | null>(null);
  const [activeSession, setActiveSession] = useState<NightSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeState, setTimeState] = useState<NightOwlTimeState>(getNightOwlState());

  // Ref to prevent double executions of loader on startup
  const isFetchedRef = useRef(false);

  // 1. Tick Bangladesh clock every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setTimeState(getNightOwlState());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // 2. Fetch all requests, active user requests, and active sessions
  const loadRequestsAndSessions = useCallback(async (userId: string, silent = false) => {
    if (!silent) setLoading(true);

    try {
      // A. Fetch current user's profile
      const { data: profileData } = await fetchProfileSafely(userId);
      if (profileData) {
        setProfile(profileData);
      }

      // If Night Owl is not active, skip DB queries for lists to optimize loads
      if (!isNightOwlActive()) {
        setRequests([]);
        setMyActiveRequest(null);
        setActiveSession(null);
        setLoading(false);
        return;
      }

      // B. Fetch open active requests from other users
      const { data: reqData, error: reqError } = await supabase
        .from("night_requests")
        .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
        .eq("active", true)
        .eq("status", "open")
        .neq("requester_id", userId)
        .order("created_at", { ascending: false });

      if (reqError) {
        console.error("Error fetching night requests:", reqError.message);
      } else {
        setRequests(reqData || []);
      }

      // C. Fetch current user's own active request if any
      const { data: ownReqData, error: ownReqError } = await supabase
        .from("night_requests")
        .select("*, requester:profiles!requester_id(anonymous_username, department, gender, karma, warning_badge, is_online, last_seen)")
        .eq("requester_id", userId)
        .eq("active", true)
        .maybeSingle();

      if (!ownReqError && ownReqData) {
        setMyActiveRequest(ownReqData);
      } else {
        setMyActiveRequest(null);
      }

      // D. Fetch user's active night sessions (where requester or accepter is user)
      const { data: sessionData, error: sessionError } = await supabase
        .from("night_sessions")
        .select(`
          *,
          requester:profiles!requester_id(id, anonymous_username, department, gender, karma, is_online, last_seen),
          accepter:profiles!accepter_id(id, anonymous_username, department, gender, karma, is_online, last_seen)
        `)
        .or(`requester_id.eq.${userId},accepter_id.eq.${userId}`)
        .eq("active", true)
        .maybeSingle();

      if (!sessionError && sessionData) {
        setActiveSession(sessionData);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error("loadRequestsAndSessions error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Initialize user session and trigger loading
  const initUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setCurrentUser(user);
      await loadRequestsAndSessions(user.id);
    } else {
      setLoading(false);
    }
  }, [loadRequestsAndSessions]);

  useEffect(() => {
    if (!isFetchedRef.current) {
      isFetchedRef.current = true;
      initUser();
    }
  }, [initUser]);

  // 4. Action: Create a temporary active Night Owl request
  const createRequest = async (mood: NightMood) => {
    if (!currentUser) return;

    if (!isNightOwlActive()) {
      toast.error("Night Owl Mode is closed. It only opens between 3:00 AM and 6:00 AM BDT.");
      return;
    }

    if (myActiveRequest) {
      toast.error("You already have an active late-night request!");
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase
        .from("night_requests")
        .insert({
          requester_id: currentUser.id,
          mood,
          status: "open",
        })
        .select()
        .single();

      if (error) {
        toast.error("Submission failed: " + error.message);
        return;
      }

      toast.success("Your late-night mood has been broadcasted anonymously!");
      await loadRequestsAndSessions(currentUser.id, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create request.");
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Action: Delete own active request
  const deleteRequest = async (requestId: string) => {
    if (!currentUser) return;

    const confirmCancel = window.confirm("Are you sure you want to delete your active Night Owl request?");
    if (!confirmCancel) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("night_requests")
        .delete()
        .eq("id", requestId)
        .eq("requester_id", currentUser.id);

      if (error) {
        toast.error("Deletion failed: " + error.message);
        return;
      }

      toast.success("Your request has been cancelled and deleted.");
      await loadRequestsAndSessions(currentUser.id, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete request.");
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Action: Accept another student's request (spawns secure, private, anonymous chat)
  const acceptRequest = async (targetRequest: NightRequest) => {
    if (!currentUser) return;

    if (!isNightOwlActive()) {
      toast.error("Night Owl Mode is closed. You cannot accept requests now.");
      return;
    }

    const confirmAccept = window.confirm(
      `Accept request from Anonymous Peer for "${targetRequest.mood}"? This will immediately connect you both in a secure, completely anonymous 1-on-1 private chat.`
    );
    if (!confirmAccept) return;

    try {
      setSubmitting(true);

      // A. Create new Conversation
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .insert({
          user_one: targetRequest.requester_id,
          user_two: currentUser.id,
        })
        .select("id")
        .single();

      if (convError || !convData) {
        toast.error("Failed to build connection: " + (convError?.message || "Unknown error"));
        return;
      }

      // B. Create new Night Session
      const { data: sessionData, error: sessionError } = await supabase
        .from("night_sessions")
        .insert({
          request_id: targetRequest.id,
          requester_id: targetRequest.requester_id,
          accepter_id: currentUser.id,
          conversation_id: convData.id,
          expires_at: targetRequest.expires_at,
        })
        .select()
        .single();

      if (sessionError || !sessionData) {
        toast.error("Failed to establish session: " + (sessionError?.message || "Unknown error"));
        return;
      }

      // C. Close request (status = accepted, active = false)
      const { error: updateError } = await supabase
        .from("night_requests")
        .update({
          status: "accepted",
          active: false,
        })
        .eq("id", targetRequest.id);

      if (updateError) {
        console.error("Status update error:", updateError.message);
      }

      // D. Send introductory message
      await supabase.from("messages").insert({
        sender_id: currentUser.id,
        conversation_id: convData.id,
        message: `🦉 Night Owl chat initiated! Let's talk about: "${targetRequest.mood}". Remember, both of you remain completely anonymous here. Have a peaceful conversation!`,
      });

      toast.success("Connected! Opening anonymous private chat room...");
      await loadRequestsAndSessions(currentUser.id, true);
      
      // Return the new conversation ID to let the UI redirect the user
      return convData.id;
    } catch (err: any) {
      toast.error(err.message || "Failed to accept request.");
    } finally {
      setSubmitting(false);
    }
  };

  // 7. Subscribe to PostgreSQL updates in real-time
  useEffect(() => {
    if (!currentUser) return;

    // Listen for inserts, deletes and status updates to night_requests
    const reqChannel = supabase
      .channel("realtime-night-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "night_requests",
        },
        async () => {
          await loadRequestsAndSessions(currentUser.id, true);
        }
      )
      .subscribe();

    // Listen for inserts to night_sessions (alert user if they were accepted!)
    const sessChannel = supabase
      .channel("realtime-night-sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "night_sessions",
        },
        async (payload) => {
          const newSession = payload.new as any;
          if (
            payload.eventType === "INSERT" &&
            newSession &&
            (newSession.requester_id === currentUser.id || newSession.accepter_id === currentUser.id)
          ) {
            toast.success("🔔 Night Owl Alert: An anonymous peer accepted your request! Secure chat is open.");
            await loadRequestsAndSessions(currentUser.id, true);
          } else {
            await loadRequestsAndSessions(currentUser.id, true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reqChannel);
      supabase.removeChannel(sessChannel);
    };
  }, [currentUser, loadRequestsAndSessions]);

  return {
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
    refreshData: () => currentUser && loadRequestsAndSessions(currentUser.id),
  };
}
