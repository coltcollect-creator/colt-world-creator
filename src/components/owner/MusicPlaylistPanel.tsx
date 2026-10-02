import { useEffect, useRef, useState } from "react";
import { supabase, cleanForFirestore, notifyTableChange } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { gameDataStore } from "@/lib/gameDataStore";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { fetchMusicTracks, type MusicTrack } from "@/lib/audio-manager";
import { saveAudioBlob, resolveAudioUrl, deleteAudioBlob } from "@/lib/indexeddb-audio";
import { toast } from "sonner";
import {
  Music,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  UploadCloud,
  CheckCircle2,
  Link as LinkIcon,
  FileAudio,
  AlertCircle,
} from "lucide-react";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export function MusicPlaylistPanel() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // New track form
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTracks = async () => {
    setLoading(true);
    try {
      const list = await fetchMusicTracks();
      setTracks(list);
    } catch (err) {
      console.error("Error loading music tracks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    setPreviewTrackId(null);
  };

  const togglePreview = async (track: MusicTrack) => {
    if (previewTrackId === track.id) {
      stopPreview();
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    try {
      const playableUrl = await resolveAudioUrl(track.url);
      if (!playableUrl) {
        toast.error("לא ניתן לטעון את קובץ השמע");
        return;
      }
      const audio = new Audio(playableUrl);
      audio.volume = 0.25;
      audio.play()
        .then(() => {
          setPreviewAudio(audio);
          setPreviewTrackId(track.id);
        })
        .catch((err) => {
          toast.error("שגיאה בניגון התצוגה המקדימה");
          console.warn(err);
        });

      audio.onended = () => {
        setPreviewTrackId(null);
      };
    } catch (err) {
      toast.error("שגיאה בפתיחת קובץ השמע");
    }
  };

  // Direct Audio / Video MP4 / MP3 file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי (מקסימום 100MB)");
      return;
    }

    setUploading(true);
    setUploadedFileName(file.name);

    // Auto-fill title from filename if empty
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(cleanName);
    }

    try {
      const trackId = "trk-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now();
      // Store in IndexedDB for fast, unlimited browser audio playback
      const idbUri = await saveAudioBlob(trackId, file);
      setTrackUrl(idbUri);
      toast.success(`קובץ השמע (${file.name}) נטען ומוכן להוספה!`);
    } catch (err: any) {
      console.error("Audio upload error:", err);
      // Fallback to object URL
      try {
        const objUrl = URL.createObjectURL(file);
        setTrackUrl(objUrl);
        toast.success(`קובץ השמע נטען!`);
      } catch {
        toast.error("שגיאה בטעינת הקובץ: " + (err?.message || ""));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("נא להזין שם לשיר/רצועה");
      return;
    }
    if (!trackUrl.trim()) {
      toast.error("נא לבחור קובץ MP4/MP3 או להזין קישור");
      return;
    }

    const trackId = "trk-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now();
    const newTrack: MusicTrack = {
      id: trackId,
      title: title.trim(),
      artist: artist.trim() || "COLT Ambiance",
      url: trackUrl.trim(),
      active: true,
      order_index: tracks.length,
      created_at: new Date().toISOString(),
    };

    try {
      // 1. Save to local in-memory store
      gameDataStore.set("music_tracks", newTrack);

      // 2. Save metadata to Firestore (lightweight, under 1KB)
      await setDoc(doc(db, "music_tracks", newTrack.id), cleanForFirestore(newTrack), { merge: true }).catch(() => {});
      notifyTableChange("music_tracks");

      window.dispatchEvent(new CustomEvent("colt-music-tracks-updated"));
      toast.success("🎵 הרצועה נוספה בהצלחה לרשימת ההשמעה!");

      setTitle("");
      setArtist("");
      setTrackUrl("");
      setUploadedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadTracks();
    } catch (err: any) {
      toast.error("שגיאה בשמירת הרצועה: " + (err?.message || ""));
    }
  };

  const handleDeleteTrack = async (track: MusicTrack) => {
    if (previewTrackId === track.id) stopPreview();

    try {
      // Delete blob from IndexedDB if stored locally
      await deleteAudioBlob(track.url);

      // Delete locally from gameDataStore
      gameDataStore.delete("music_tracks", track.id);

      // Delete from Firestore
      await deleteDoc(doc(db, "music_tracks", track.id)).catch(() => {});
      notifyTableChange("music_tracks");

      // Update local state immediately
      setTracks((prev) => prev.filter((t) => t.id !== track.id));
      window.dispatchEvent(new CustomEvent("colt-music-tracks-updated"));
      toast.success(`השיר "${track.title}" נמחק`);
    } catch (err: any) {
      toast.error("שגיאה במחיקה: " + (err?.message || ""));
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("האם למחוק את כל השירים הנוכחיים ברשימת ההשמעה?")) return;
    stopPreview();

    try {
      for (const t of tracks) {
        await deleteAudioBlob(t.url);
        gameDataStore.delete("music_tracks", t.id);
        deleteDoc(doc(db, "music_tracks", t.id)).catch(() => {});
      }
      notifyTableChange("music_tracks");
      setTracks([]);
      window.dispatchEvent(new CustomEvent("colt-music-tracks-updated"));
      toast.success("כל רשימת ההשמעה נמחקה");
    } catch (err: any) {
      toast.error("שגיאה במחיקה: " + (err?.message || ""));
    }
  };

  const handleToggleActive = async (track: MusicTrack) => {
    const updated = { ...track, active: !track.active };
    try {
      gameDataStore.set("music_tracks", updated);
      await setDoc(doc(db, "music_tracks", updated.id), cleanForFirestore(updated), { merge: true }).catch(() => {});
      notifyTableChange("music_tracks");
      window.dispatchEvent(new CustomEvent("colt-music-tracks-updated"));
      toast.success(updated.active ? "הרצועה הופעלה" : "הרצועה הושבתה");
      loadTracks();
    } catch (err: any) {
      toast.error("שגיאה בעדכון: " + (err?.message || ""));
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tracks.length) return;

    const newTracks = [...tracks];
    const temp = newTracks[index];
    newTracks[index] = newTracks[targetIndex];
    newTracks[targetIndex] = temp;

    for (let i = 0; i < newTracks.length; i++) {
      newTracks[i].order_index = i;
      gameDataStore.set("music_tracks", newTracks[i]);
      setDoc(doc(db, "music_tracks", newTracks[i].id), cleanForFirestore(newTracks[i]), { merge: true }).catch(() => {});
    }

    setTracks(newTracks);
    notifyTableChange("music_tracks");
    window.dispatchEvent(new CustomEvent("colt-music-tracks-updated"));
    toast.success("סדר ההשמעה עודכן");
  };

  return (
    <div dir="rtl" className="space-y-6 max-w-4xl">
      {/* Header Info */}
      <div className="chrome-panel p-6 bg-card border-2 border-primary/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-black text-2xl shadow-md">
              🎵
            </div>
            <div>
              <h2 className="text-xl font-black">ניהול מוזיקת רקע ורשימת השמעה (BGM)</h2>
              <p className="text-xs text-muted-foreground">
                העלו קבצי MP4 / MP3 אישיים. רק מה שתעלו יתנגן לשחקנים ברקע בלולאה רציפה ובווליום רגוע.
              </p>
            </div>
          </div>
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              className="px-3 py-1.5 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>מחק את כל השירים</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Add Track Form */}
        <div className="chrome-panel p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Plus className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm">העלאת שיר / קובץ MP4 / MP3 חדש</h3>
          </div>

          <form onSubmit={handleAddTrack} className="space-y-3.5 text-xs">
            {/* Upload Method Selector */}
            <div className="space-y-1.5">
              <label className="block font-bold text-foreground">אופן הוספת הקובץ *</label>
              <div className="flex rounded-xl bg-muted p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setUploadMethod("file")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    uploadMethod === "file" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UploadCloud className="h-3.5 w-3.5 inline ml-1" />
                  העלאת קובץ מהמחשב (MP3 / MP4)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMethod("url")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    uploadMethod === "url" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LinkIcon className="h-3.5 w-3.5 inline ml-1" />
                  הדבקת קישור (URL)
                </button>
              </div>
            </div>

            {/* Direct File Dropzone */}
            {uploadMethod === "file" ? (
              <div className="space-y-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                    trackUrl
                      ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500"
                      : "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/mp4,video/*,.mp3,.mp4,.wav,.m4a,.ogg,.aac,.webm"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />

                  {uploading ? (
                    <div className="space-y-1">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="font-bold text-xs text-foreground">מעלה קובץ שמע...</p>
                    </div>
                  ) : trackUrl ? (
                    <div className="space-y-1">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="font-bold text-xs text-foreground truncate max-w-[240px]">
                        {uploadedFileName || "קובץ שמע מוכן"}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        לחצו להחלפת הקובץ
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <FileAudio className="mx-auto h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                      <p className="font-bold text-xs text-foreground">
                        לחצו כאן להעלאת קובץ MP3 או MP4
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        תומך ב-MP4, MP3, WAV, M4A, OGG, AAC (עד 50MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block font-bold text-foreground">קישור ישיר לקובץ שמע (URL) *</label>
                <input
                  type="url"
                  placeholder="https://example.com/music.mp3 או https://example.com/video.mp4"
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block font-bold text-foreground">שם השיר / רצועה *</label>
              <input
                type="text"
                placeholder="למשל: נעימת הרקע של היריד"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-foreground">אמן / יוצר (אופציונלי)</label>
              <input
                type="text"
                placeholder="למשל: COLT Chill"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-xs font-medium focus:border-primary focus:outline-none"
              />
            </div>

            {trackUrl && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-2.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-primary truncate max-w-[200px]">
                  קובץ נטען: {uploadedFileName || title || "מוכן להאזנה"}
                </span>
                <button
                  type="button"
                  onClick={() => togglePreview({ id: "temp", title: title || "בדיקה", url: trackUrl, active: true, order_index: 0, created_at: "" })}
                  className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 flex items-center gap-1"
                >
                  {previewTrackId === "temp" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                  <span>{previewTrackId === "temp" ? "השהה" : "האזן לבדיקה"}</span>
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !trackUrl}
              className="btn-plastic w-full py-2.5 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>הוסף שיר לרשימת ההשמעה</span>
            </button>
          </form>
        </div>

        {/* Current Playlist Table */}
        <div className="chrome-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm">רשימת ההשמעה הפעילה ({tracks.length})</h3>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              ניגון בלולאה רציפה 🔁
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">טוען שירים...</div>
          ) : tracks.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-3 rounded-2xl bg-muted/30 border border-dashed border-border p-6">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground opacity-60" />
              <div>
                <p className="font-bold text-foreground">אין שירים ברשימת ההשמעה</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  העלו קובץ MP3 או MP4 בטופס מימין כדי להפעיל את המוזיקה לשחקנים.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {tracks.map((trk, idx) => (
                <div
                  key={trk.id}
                  className={`rounded-2xl border-2 p-3 transition-all flex items-center justify-between gap-2 ${
                    trk.active !== false
                      ? "border-border bg-card/80 shadow-sm hover:border-primary/50"
                      : "border-border/40 bg-muted/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Order index / Play preview */}
                    <button
                      type="button"
                      onClick={() => togglePreview(trk)}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-bold transition-all ${
                        previewTrackId === trk.id
                          ? "bg-primary text-primary-foreground animate-pulse shadow-md"
                          : "bg-muted text-foreground hover:bg-primary/20"
                      }`}
                      title={previewTrackId === trk.id ? "השהה" : "האזן לשיר"}
                    >
                      {previewTrackId === trk.id ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-bold text-xs text-foreground">{trk.title}</span>
                        {!trk.active && (
                          <span className="rounded bg-destructive/10 px-1.5 py-0.2 text-[9px] font-bold text-destructive">
                            מושבת
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground font-mono">
                        {trk.artist || "אמן"} · {trk.url.endsWith(".mp4") ? "MP4 Audio" : "Audio"}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Move, Toggle, Delete) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="העלה מעלה"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === tracks.length - 1}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="הורד מטה"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(trk)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        trk.active !== false
                          ? "bg-primary/15 text-primary hover:bg-primary/25"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      title="הפעל / השבת שיר"
                    >
                      {trk.active !== false ? "פעיל" : "הפעל"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTrack(trk)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                      title="מחק שיר"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
