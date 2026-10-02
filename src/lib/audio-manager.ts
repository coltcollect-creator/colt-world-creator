import { supabase } from "@/integrations/supabase/client";
import { gameDataStore } from "./gameDataStore";

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  url: string;
  active: boolean;
  order_index: number;
  duration_seconds?: number;
  created_at: string;
}

// No demo tracks by default - only owner uploaded music tracks
export const DEFAULT_MUSIC_TRACKS: MusicTrack[] = [];

const LOCAL_MUSIC_SETTINGS_KEY = "colt_music_player_settings_v1";

export interface PlayerAudioPreferences {
  muted: boolean;
  volume: number; // 0.0 to 1.0 (default 0.18)
  autoPlayEnabled: boolean;
}

export function getStoredAudioPreferences(): PlayerAudioPreferences {
  if (typeof window === "undefined") return { muted: false, volume: 0.18, autoPlayEnabled: true };
  try {
    const raw = localStorage.getItem(LOCAL_MUSIC_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        muted: Boolean(parsed.muted),
        volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : 0.18,
        autoPlayEnabled: parsed.autoPlayEnabled !== false,
      };
    }
  } catch {}
  return { muted: false, volume: 0.18, autoPlayEnabled: true };
}

export function saveStoredAudioPreferences(prefs: Partial<PlayerAudioPreferences>) {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredAudioPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(LOCAL_MUSIC_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("colt-audio-prefs-changed", { detail: updated }));
  } catch {}
}

export async function fetchMusicTracks(): Promise<MusicTrack[]> {
  try {
    const { data, error } = await supabase
      .from("music_tracks")
      .select("*")
      .order("order_index", { ascending: true });

    if (!error && Array.isArray(data)) {
      return data as MusicTrack[];
    }
  } catch (err) {
    console.warn("Could not fetch music_tracks from remote, checking local data store:", err);
  }

  // Check local store
  const local = gameDataStore.getAll("music_tracks");
  if (local && Array.isArray(local)) {
    return (local as MusicTrack[]).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  return [];
}
