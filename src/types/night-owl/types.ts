export type NightMood =
  | "Can’t sleep"
  | "Studying"
  | "Coding all night"
  | "Need conversation"
  | "Feeling lonely";

export type NightRequestStatus = "open" | "accepted" | "expired";

export interface NightRequest {
  id: string;
  requester_id: string;
  mood: NightMood;
  status: NightRequestStatus;
  created_at: string;
  expires_at: string;
  active: boolean;
  requester?: {
    anonymous_username: string;
    department: string;
    gender: string;
    karma: number;
    warning_badge?: string | null;
    is_online: boolean;
    last_seen: string;
  };
}

export interface NightSession {
  id: string;
  request_id: string;
  requester_id: string;
  accepter_id: string;
  conversation_id: string;
  created_at: string;
  expires_at: string;
  active: boolean;
  requester?: {
    anonymous_username: string;
    department: string;
    gender: string;
    karma: number;
    is_online: boolean;
    last_seen: string;
  };
  accepter?: {
    anonymous_username: string;
    department: string;
    gender: string;
    karma: number;
    is_online: boolean;
    last_seen: string;
  };
}

export interface NightOwlTimeState {
  isActive: boolean;
  bdtTime: {
    hour: number;
    minute: number;
    second: number;
  };
  timeLeftFormatted: string; // "02h 15m 10s"
}
