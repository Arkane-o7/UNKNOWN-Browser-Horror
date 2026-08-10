export type Sensitivity = "low" | "moderate" | "sensitive";

export interface BrowserSignal {
  id: string;
  label: string;
  value: string;
  available: boolean;
  source: string;
  sensitivity: Sensitivity;
  requiresPermission: boolean;
  category: "environment" | "display" | "hardware" | "graphics" | "audio" | "preferences" | "sensor";
}

export type LocationStatus =
  | "locked"
  | "requesting"
  | "granted"
  | "denied"
  | "refused"
  | "unavailable"
  | "timed-out";

export interface PreciseLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface LocationResult {
  status: Exclude<LocationStatus, "locked" | "requesting" | "refused">;
  location?: PreciseLocation;
  reason?: string;
}

export type SceneId =
  | "contact"
  | "contact-awake"
  | "contact-refused"
  | "machine"
  | "hardware"
  | "audio-signature"
  | "profile"
  | "profile-refused"
  | "network-truth"
  | "doors"
  | "location-request"
  | "location-granted"
  | "location-denied"
  | "location-unavailable"
  | "tab-prison"
  | "tab-refused"
  | "cookie-reveal"
  | "escape"
  | "vector"
  | "debrief";

export type EyeMood = "dormant" | "curious" | "focused" | "agitated" | "still";

export interface NarrativeContext {
  signal: (id: string, fallback?: string) => string;
  profileId: string;
  locationStatus: LocationStatus;
  location?: PreciseLocation;
  refusalCount: number;
}

export interface NarrativeLine {
  text: string;
  pauseAfter?: number;
  speed?: number;
  tone?: "entity" | "system" | "warning";
}

export interface SceneChoice {
  id: string;
  label: string;
  quiet?: boolean;
}

export interface SceneDefinition {
  id: SceneId;
  act: string;
  room: string;
  title: string;
  completeness: number;
  mood: EyeMood;
  corruption: number;
  lines: (context: NarrativeContext) => NarrativeLine[];
  choices: SceneChoice[];
}

export interface GameSnapshot {
  scene: SceneId;
  act: string;
  room: string;
  dialogue: string[];
  currentlyTyping: string;
  choices: SceneChoice[];
  narrativeComplete: boolean;
  profileCompleteness: number;
  profileId: string;
  discoveredSignals: Array<{ id: string; label: string; value: string }>;
  locationStatus: LocationStatus;
  soundEnabled: boolean;
  booted: boolean;
  audio: {
    state: AudioContextState | "uninitialized";
    eventCount: number;
    lastEvent: string;
  };
  interruption?: string;
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
    __COOKIE_DEBUG__?: {
      jump: (scene: SceneId) => void;
      reset: () => void;
      setSpeed: (multiplier: number) => void;
      simulateLocation: (result: "granted" | "denied" | "unavailable") => void;
      snapshot: () => GameSnapshot;
    };
  }
}
