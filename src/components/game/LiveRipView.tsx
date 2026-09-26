import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useAuth } from "@/lib/auth-context";
import { GemPacksPrompt } from "@/components/game/AuctionView";

type Rip = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_id: string | null;
  scheduled_at: string;
  total_slots: number;
  price_credits: number;
  max_slots_per_user: number;
  status: string;
  youtube_url: string | null;
  closed_at: string | null;
  active: boolean;
};

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function LiveRipView({ storeId }: { storeId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: rips = [] } = useQuery({
    queryKey: ["live-rips-for-store", storeId],
    queryFn: async () =>
      ((await supabase.from("live_rips").select("*").eq("store_id", storeId).eq("active", true).order("scheduled_at")).data ??
        []) as unknown as Rip[],
  });

  if (!rips.length)
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        📦 עדיין לא הוגדרו אירועי Live Rip לדוכן הזה. בעלים – הגדירו בטאב "Live Rip".
      </div>
    );

  const open = rips.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {rips.map((r) => (
          <button key={r.id} onClick={() => setOpenId(r.id)} className="chrome-panel overflow-hidden p-0 text-right">
            <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-sky-100 to-indigo-200">
              {r.image_url ? (
                <img src={r.image_url} alt={r.name} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
              ) : (
                <div className="grid h-full w-full place-items-center text-6xl">📦</div>
              )}
            </div>
            <div className="p-3">
              <div className="truncate font-bold">{r.name}</div>
              {r.description && <div className="line-clamp-2 text-xs text-muted-foreground">{r.description}</div>}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-black text-primary">💎 {r.price_credits}</span>
                <span className="text-muted-foreground">
                  {r.closed_at ? "סגור" : new Date(r.scheduled_at) > new Date() ? new Date(r.scheduled_at).toLocaleString("he-IL") : "🟢 פתוח"}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {open && <LiveRipRoom rip={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function LiveRipRoom({ rip, onClose }: { rip: Rip; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [needGems, setNeedGems] = useState<number | null>(null);

  const { data: live } = useQuery({
    queryKey: ["live-rip", rip.id],
    queryFn: async () => ((await supabase.from("live_rips").select("*").eq("id", rip.id).maybeSingle()).data ?? null) as unknown as Rip | null,
    initialData: rip,
    refetchInterval: 5000,
  });
  const r = live ?? rip;

  const { data: slots = [] } = useQuery({
    queryKey: ["live-rip-my-slots", rip.id],
    queryFn: async () =>
      ((await supabase.from("live_rip_slots").select("id,user_id,slot_number,credits_paid").eq("rip_id", rip.id).order("slot_number")).data ??
        []) as Array<{ id: string; user_id: string; slot_number: number; credits_paid: number }>,
    refetchInterval: 5000,
  });

  const { data: taken = 0 } = useQuery({
    queryKey: ["live-rip-count", rip.id],
    queryFn: async () => (await supabase.from("live_rip_slots").select("id", { count: "exact", head: true }).eq("rip_id", rip.id)).count ?? 0,
    refetchInterval: 5000,
  });

  const { data: product } = useQuery({
    queryKey: ["live-rip-product", r.product_id],
    enabled: !!r.product_id,
    queryFn: async () =>
      ((await supabase.from("products").select("id,name,image_url,sku").eq("id", r.product_id!).maybeSingle()).data ?? null) as
        | { id: string; name: string; image_url: string | null; sku: string | null }
        | null,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`live-rip-${rip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_rips", filter: `id=eq.${rip.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["live-rip", rip.id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_rip_slots", filter: `rip_id=eq.${rip.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["live-rip-count", rip.id] });
        qc.invalidateQueries({ queryKey: ["live-rip-my-slots", rip.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [rip.id, qc]);

  const mine = slots.filter((s) => s.user_id === profile?.id);
  const closed = !!r.closed_at || r.status === "closed";
  const notStarted = new Date(r.scheduled_at) > new Date();
  const remaining = Math.max(r.total_slots - taken, 0);
  const canJoin = !closed && !notStarted && remaining > 0 && mine.length < r.max_slots_per_user;
  const embed = r.youtube_url ? youtubeEmbed(r.youtube_url) : null;

  const join = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("join_live_rip", { _rip_id: rip.id, _count: 1 });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = data as { ok: boolean; reason?: string; needed?: number };
    if (!res.ok) {
      if (res.reason === "insufficient_credits") {
        setNeedGems(res.needed ?? r.price_credits);
        return;
      }
      toast.error(res.reason === "sold_out" ? "כל המקומות נתפסו" : res.reason === "limit_reached" ? "הגעת למכסת הכניסות" : "ההצטרפות נכשלה");
      return;
    }
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    toast.success("שמרנו לך מקום! החבילה נוספה למלאי שלך");
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["live-rip-count", rip.id] });
    qc.invalidateQueries({ queryKey: ["live-rip-my-slots", rip.id] });
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-sky-200 via-indigo-100 to-purple-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary">📦 Live Rip</div>
              <h2 className="truncate text-2xl font-black">{r.name}</h2>
              {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-md">✕</button>
          </div>
        </div>

        <div className="p-5">
          {r.image_url && <img src={r.image_url} alt={r.name} className="mx-auto mb-4 max-h-56 rounded-2xl object-contain shadow-lg" />}

          {product && (
            <div className="chrome-panel mb-4 flex items-center gap-2 p-2 text-xs">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-10 w-10 rounded object-contain" />
              ) : (
                <span className="text-xl">📦</span>
              )}
              <div>
                <div className="font-bold">{product.name}</div>
                <div className="text-[10px] text-muted-foreground">כל מקום מקבל חפיסה אחת</div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="chrome-panel p-3 text-center">
              <div className="text-xs text-muted-foreground">מקומות שנותרו</div>
              <div className="text-2xl font-black text-primary">
                {remaining}/{r.total_slots}
              </div>
            </div>
            <div className="chrome-panel p-3 text-center">
              <div className="text-xs text-muted-foreground">מחיר כניסה</div>
              <div className="text-2xl font-black">💎 {r.price_credits}</div>
            </div>
            <div className="chrome-panel p-3 text-center">
              <div className="text-xs text-muted-foreground">הכניסות שלי</div>
              <div className="text-2xl font-black">
                {mine.length}/{r.max_slots_per_user}
              </div>
            </div>
          </div>

          <div className="mt-2 text-center text-xs text-muted-foreground">
            {closed
              ? "האירוע נסגר — החבילות נוספו למלאי המשתתפים"
              : notStarted
                ? `נפתח ב־${new Date(r.scheduled_at).toLocaleString("he-IL")}`
                : remaining === 0
                  ? "כל המקומות נתפסו — ממתין לפתיחה על ידי הבעלים"
                  : "האירוע פתוח להצטרפות"}
          </div>

          <button onClick={join} disabled={!canJoin || busy} className="btn-plastic mt-4 w-full text-lg disabled:opacity-40">
            {busy ? "…" : mine.length >= r.max_slots_per_user ? "🎟️ הגעת למכסה" : `תפסו מקום · 💎 ${r.price_credits}`}
          </button>
          <div className="mt-1 text-center text-[11px] text-muted-foreground">
            כל מקום שווה חפיסה אחת. אחרי הסגירה תבחרו במלאי שלכם משלוח או איסוף עצמי.
          </div>

          {needGems != null && <GemPacksPrompt needed={needGems} balance={profile?.credits ?? 0} onClose={() => setNeedGems(null)} />}

          {mine.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold">המקומות שלי</div>
              <div className="flex flex-wrap gap-1">
                {mine.map((s) => (
                  <span key={s.id} className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold">
                    מקום #{s.slot_number}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mine.length > 0 && embed && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold">🎬 סרטון הפתיחה</div>
              <div className="aspect-video w-full overflow-hidden rounded-2xl">
                <iframe src={embed} title="Live Rip" allowFullScreen className="h-full w-full" />
              </div>
            </div>
          )}
          {mine.length > 0 && closed && !embed && (
            <div className="mt-4 text-center text-xs text-muted-foreground">סרטון הפתיחה יעלה בקרוב 🎬</div>
          )}
        </div>
      </div>
    </div>
  );
}
