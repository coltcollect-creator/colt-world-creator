import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMusicTracks,
  getStoredAudioPreferences,
  saveStoredAudioPreferences,
  type MusicTrack,
} from "@/lib/audio-manager";
import { resolveAudioUrl } from "@/lib/indexeddb-audio";
import { Volume2, VolumeX, SkipForward, Music, Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export function BackgroundMusicPlayer() {
  const { profile } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [prefs, setPrefs] = useState(() => getStoredAudioPreferences());
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Sync profile settings if user configured them in profile/settings
  const profileMusicEnabled = profile?.settings?.music !== false;
  const profileSoundVolume = typeof profile?.settings?.music_volume === "number" ? profile.settings.music_volume : null;

  // Load tracks
  useEffect(() => {
    let mounted = true;
    fetchMusicTracks().then((list) => {
      if (mounted) {
        const activeList = list.filter((t) => t.active !== false);
        setTracks(activeList.length > 0 ? activeList : list);
      }
    });

    // Listen for database changes to music_tracks or game_settings
    const onStorageChange = () => {
      fetchMusicTracks().then((list) => {
        if (mounted) {
          const activeList = list.filter((t) => t.active !== false);
          setTracks(activeList.length > 0 ? activeList : list);
        }
      });
    };
    window.addEventListener("colt-music-tracks-updated", onStorageChange);

    // Listen for local prefs changes
    const onPrefsChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setPrefs(detail);
    };
    window.addEventListener("colt-audio-prefs-changed", onPrefsChange);

    return () => {
      mounted = false;
      window.removeEventListener("colt-music-tracks-updated", onStorageChange);
      window.removeEventListener("colt-audio-prefs-changed", onPrefsChange);
    };
  }, []);

  const currentTrack = tracks[currentIndex] || tracks[0];

  // Determine effective volume and mute state
  const effectiveVolume = profileSoundVolume !== null ? profileSoundVolume : prefs.volume;
  const isMuted = prefs.muted || !profileMusicEnabled;

  // Update audio element volume & mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, effectiveVolume));
    audio.muted = isMuted;
  }, [effectiveVolume, isMuted]);

  // Handle track changing
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.url) return;

    let cancelled = false;
    (async () => {
      const playable = await resolveAudioUrl(currentTrack.url);
      if (cancelled || !playable) return;

      if (audio.src !== playable) {
        audio.src = playable;
        audio.load();
      }

      if (!isMuted && profileMusicEnabled) {
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay policy prevented playback until user gesture
            setIsPlaying(false);
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, isMuted, profileMusicEnabled]);

  // Robust Autoplay / Gesture unlock handler for Mobile & Desktop
  useEffect(() => {
    const tryPlayAudio = () => {
      setHasInteracted(true);
      const audio = audioRef.current;
      if (audio && !isMuted && profileMusicEnabled && audio.paused && audio.src) {
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    };

    const gestureEvents = ["touchstart", "touchend", "pointerdown", "click", "keydown", "colt-unlock-audio"];
    gestureEvents.forEach((evt) => {
      window.addEventListener(evt, tryPlayAudio, { passive: true });
    });

    return () => {
      gestureEvents.forEach((evt) => {
        window.removeEventListener(evt, tryPlayAudio);
      });
    };
  }, [isMuted, profileMusicEnabled]);

  // Handle track ended -> play next, or loop back to index 0
  const handleEnded = () => {
    if (tracks.length <= 1) {
      // Loop single track
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      // Next track
      const nextIndex = (currentIndex + 1) % tracks.length;
      setCurrentIndex(nextIndex);
      setIsPlaying(true);
    }
  };

  const handleNextTrack = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tracks.length <= 0) return;
    const nextIdx = (currentIndex + 1) % tracks.length;
    setCurrentIndex(nextIdx);
    setIsPlaying(true);
    setHasInteracted(true);
    toast.info(`🎶 מנגן: ${tracks[nextIdx]?.title || "שיר הבא"}`);
  };

  const togglePlayPause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHasInteracted(true);
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (isMuted) {
        saveStoredAudioPreferences({ muted: false });
      }
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Could not play audio:", err);
          toast.error("לא ניתן לנגן כעת, נא ללחוץ על המסך");
        });
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newMuted = !prefs.muted;
    saveStoredAudioPreferences({ muted: newMuted });
    if (!newMuted && !isPlaying) {
      setIsPlaying(true);
      audioRef.current?.play().catch(() => {});
    }
  };

  const handleVolumeChange = (newVol: number) => {
    saveStoredAudioPreferences({ volume: newVol, muted: false });
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = false;
    }
    if (!isPlaying) {
      setIsPlaying(true);
      audioRef.current?.play().catch(() => {});
    }
  };

  if (!tracks.length) return null;

  return (
    <div
      dir="rtl"
      className="fixed top-16 left-3 sm:top-auto sm:bottom-4 sm:left-4 z-40 select-none font-sans transition-all duration-300 print:hidden"
    >
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          // If a track fails, automatically skip to next track
          console.warn("Track failed to load, skipping to next track");
          handleNextTrack();
        }}
      />

      {/* Floating Pill Mini-Player */}
      <div className="relative group overflow-hidden rounded-2xl border-2 border-primary/30 bg-card/95 p-2 shadow-2xl backdrop-blur-md transition-all hover:border-primary">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlayPause}
            className={`grid h-8 w-8 place-items-center rounded-xl font-bold transition-all shadow-sm ${
              isPlaying && !isMuted
                ? "bg-primary text-primary-foreground animate-pulse"
                : "bg-muted text-foreground hover:bg-primary/20"
            }`}
            title={isPlaying ? "השהה מוזיקה" : "נגן מוזיקה"}
          >
            {isPlaying && !isMuted ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>

          {/* Current track title & animation */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex max-w-[140px] sm:max-w-[190px] cursor-pointer flex-col overflow-hidden text-right leading-tight"
          >
            <div className="flex items-center gap-1">
              <Music className={`h-3 w-3 shrink-0 text-primary ${isPlaying && !isMuted ? "animate-bounce" : ""}`} />
              <span className="truncate text-xs font-bold text-foreground">
                {currentTrack?.title || "מוזיקת רקע"}
              </span>
            </div>
            <span className="truncate text-[10px] text-muted-foreground font-mono">
              {currentTrack?.artist || `רצועה ${currentIndex + 1}/${tracks.length}`}
            </span>
          </div>

          {/* Skip Next Button */}
          <button
            type="button"
            onClick={handleNextTrack}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="שיר הבא"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          {/* Mute / Unmute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={isMuted ? "בטל השתקה" : "השתק"}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4 text-primary" />}
          </button>

          {/* Expand/Collapse details */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Expanded Volume Slider & Playlist Controls */}
        {isExpanded && (
          <div className="mt-2.5 space-y-2 border-t border-border/60 pt-2.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">עוצמת שמע:</span>
              <span className="text-[11px] font-mono font-bold text-primary">
                {isMuted ? "מושתק (0%)" : `${Math.round(effectiveVolume * 100)}%`}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : effectiveVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />

            {/* Track selector list */}
            {tracks.length > 1 && (
              <div className="max-h-28 overflow-y-auto space-y-1 rounded-xl bg-muted/50 p-1.5">
                {tracks.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsPlaying(true);
                      setHasInteracted(true);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] text-right transition-all ${
                      idx === currentIndex
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{t.title}</span>
                    {idx === currentIndex && <span className="text-[9px] shrink-0 font-mono">▶ פעיל</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
