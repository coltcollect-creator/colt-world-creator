import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { createGemPurchase } from "@/lib/gem-purchase.functions";

type Auction = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_ids: string[] | null;
  starting_price: number;
  bid_increment: number;
  starts_at: string;
  ends_at: string | null;
  status: string;
  current_bid: number | null;
  current_leader: string | null;
  winner_id: string | null;
  settled_at: string | null;
  active: boolean;
};

export function AuctionView({ storeId }: { storeId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: auctions = [] } = useQuery({
    queryKey: ["auctions-for-store", storeId],
    queryFn: async () =>
      ((await supabase.from("auctions").select("*").eq("store_id", storeId).eq("active", true).order("starts_at")).data ??
        []) as unknown as Auction[],
  });

  if (!auctions.length)
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        🔨 עדיין לא הוגדרו מכרזים לדוכן הזה. בעלים – הגדירו בטאב "מכרזים".
      </div>
    );

  const open = auctions.find((a) => a.id === openId) ?? null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {auctions.map((a) => (
          <button key={a.id} onClick={() => setOpenId(a.id)} className="chrome-panel overflow-hidden p-0 text-right">
            <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-amber-100 to-yellow-200">
              {a.image_url ? (
                <img src={a.image_url} alt={a.name} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
              ) : (
                <div className="grid h-full w-full place-items-center text-6xl">🔨</div>
              )}
            </div>
            <div className="p-3">
              <div className="truncate font-bold">{a.name}</div>
              {a.description && <div className="line-clamp-2 text-xs text-muted-foreground">{a.description}</div>}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-black text-primary">💎 {a.current_bid ?? a.starting_price}</span>
                <span className="text-muted-foreground">{statusLabel(a)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {open && <AuctionRoom auction={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function statusLabel(a: Auction): string {
  if (a.settled_at || a.status === "ended") return "הסתיים";
  if (new Date(a.starts_at) > new Date()) return `נפתח ב־${new Date(a.starts_at).toLocaleString("he-IL")}`;
  return "🟢 פעיל";
}

function AuctionRoom({ auction, onClose }: { auction: Auction; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [needGems, setNeedGems] = useState<number | null>(null);

  const { data: live } = useQuery({
    queryKey: ["auction", auction.id],
    queryFn: async () => ((await supabase.from("auctions").select("*").eq("id", auction.id).maybeSingle()).data ?? null) as unknown as Auction | null,
    initialData: auction,
    refetchInterval: 5000,
  });
  const a = live ?? auction;

  const { data: bids = [] } = useQuery({
    queryKey: ["auction-bids", auction.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_auction_bid_feed", { _auction_id: auction.id, _limit: 10 });
      return (data ?? []) as Array<{ id: string; amount: number; created_at: string; bidder_name: string; is_me: boolean }>;
    },
    refetchInterval: 5000,
  });

  const { data: names = {} } = useQuery({
    queryKey: ["auction-names", a.current_leader, a.winner_id],
    enabled: !!(a.current_leader || a.winner_id),
    queryFn: async () => {
      const ids = Array.from(new Set([a.current_leader, a.winner_id].filter(Boolean) as string[]));
      const { data } = await supabase.rpc("get_public_profiles", { _ids: ids });
      const map: Record<string, string> = {};
      for (const p of (data ?? []) as Array<{ id: string; username: string; display_name: string | null }>) {
        map[p.id] = p.display_name || p.username;
      }
      return map;
    },
  });



  const { data: products = [] } = useQuery({
    queryKey: ["auction-products", auction.id],
    enabled: (a.product_ids ?? []).length > 0,
    queryFn: async () =>
      ((await supabase.from("products").select("id,name,image_url,sku").in("id", a.product_ids ?? [])).data ?? []) as Array<{
        id: string;
        name: string;
        image_url: string | null;
        sku: string | null;
      }>,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`auction-${auction.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions", filter: `id=eq.${auction.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["auction", auction.id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auction_bids", filter: `auction_id=eq.${auction.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["auction-bids", auction.id] });
        qc.invalidateQueries({ queryKey: ["auction", auction.id] });
        refreshProfile();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [auction.id, qc, refreshProfile]);

  const ended = !!a.settled_at || a.status === "ended";
  const notStarted = new Date(a.starts_at) > new Date();
  const expired = !!a.ends_at && new Date(a.ends_at) < new Date();
  const nextBid = a.current_bid == null ? a.starting_price : a.current_bid + a.bid_increment;
  const isLeader = !!profile && a.current_leader === profile.id;
  const canBid = !ended && !notStarted && !expired && !isLeader;

  const bid = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("place_auction_bid", { _auction_id: auction.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = data as { ok: boolean; reason?: string; needed?: number; bid?: number };
    if (!res.ok) {
      if (res.reason === "insufficient_credits") {
        setNeedGems(res.needed ?? nextBid);
        return;
      }
      toast.error("ההצעה נכשלה");
      return;
    }
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    toast.success(`ההצעה שלך נרשמה: 💎 ${res.bid}`);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["auction", auction.id] });
    qc.invalidateQueries({ queryKey: ["auction-bids", auction.id] });
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary">🔨 מכירה פומבית</div>
              <h2 className="truncate text-2xl font-black">{a.name}</h2>
              {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-md">✕</button>
          </div>
        </div>

        <div className="p-5">
          {a.image_url && (
            <img src={a.image_url} alt={a.name} className="mx-auto mb-4 max-h-56 rounded-2xl object-contain shadow-lg" />
          )}

          {products.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-xs font-semibold">מה במכרז:</div>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <div key={p.id} className="chrome-panel flex items-center gap-2 p-2 text-xs">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded object-contain" /> : <span className="text-xl">📦</span>}
                    <div>
                      <div className="font-bold">{p.name}</div>
                      {p.sku && <div className="text-[10px] text-muted-foreground">מק"ט: {p.sku}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="chrome-panel p-3 text-center">
              <div className="text-xs text-muted-foreground">ההצעה המובילה</div>
              <div className="text-2xl font-black text-primary">💎 {a.current_bid ?? "—"}</div>
              <div className="mt-1 text-xs font-semibold">
                {a.current_leader ? `👑 ${names[a.current_leader] ?? "שחקן"}` : "אין הצעות עדיין"}
              </div>
            </div>
            <div className="chrome-panel p-3 text-center">
              <div className="text-xs text-muted-foreground">ההצעה הבאה</div>
              <div className="text-2xl font-black">💎 {nextBid}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">קפיצה: 💎 {a.bid_increment}</div>
            </div>
          </div>

          <div className="mt-2 text-center text-xs text-muted-foreground">
            {ended
              ? a.winner_id
                ? `המכרז הסתיים — הזוכה: ${names[a.winner_id] ?? "שחקן"}`
                : "המכרז הסתיים"
              : notStarted
                ? `נפתח ב־${new Date(a.starts_at).toLocaleString("he-IL")}`
                : expired
                  ? "הזמן נגמר — ממתין לסגירה על ידי הבעלים"
                  : a.ends_at
                    ? `מסתיים ב־${new Date(a.ends_at).toLocaleString("he-IL")}`
                    : "המכרז פעיל"}
          </div>

          <button onClick={bid} disabled={!canBid || busy} className="btn-plastic mt-4 w-full text-lg disabled:opacity-40">
            {isLeader ? "👑 אתם מובילים!" : busy ? "…" : `הציעו 💎 ${nextBid}`}
          </button>
          <div className="mt-1 text-center text-[11px] text-muted-foreground">
            הסכום נתפס מהיהלומים שלכם ומוחזר אוטומטית אם מישהו עוקף אתכם.
          </div>

          {needGems != null && <GemPacksPrompt needed={needGems} balance={profile?.credits ?? 0} onClose={() => setNeedGems(null)} />}

          {bids.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold">היסטוריית הצעות</div>
              <div className="space-y-1">
                {bids.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-muted px-2 py-1 text-[11px]">
                    <span>{b.is_me ? "אתם" : b.bidder_name}</span>
                    <span className="font-bold">💎 {b.amount}</span>
                    <span className="text-muted-foreground">{new Date(b.created_at).toLocaleTimeString("he-IL")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GemPacksPrompt({ needed, balance, onClose }: { needed: number; balance: number; onClose: () => void }) {
  const create = useServerFn(createGemPurchase);
  const [busy, setBusy] = useState<string | null>(null);
  const { data: packs = [] } = useQuery({
    queryKey: ["packs"],
    queryFn: async () => (await supabase.from("credit_packages").select("*").eq("active", true).order("display_order")).data ?? [],
  });

  const buy = async (id: string) => {
    try {
      setBusy(id);
      const res = await create({ data: { package_id: id, return_origin: window.location.origin } });
      window.open(res.paypal_url, "_blank", "noopener,noreferrer");
      window.location.href = `/payment/success?order=${res.order_id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="chrome-panel mt-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-black">💎 אין לכם מספיק יהלומים</div>
          <div className="text-xs text-muted-foreground">
            נדרש 💎 {needed} · יש לכם 💎 {balance}. רכשו חבילה והמשיכו במכרז.
          </div>
        </div>
        <button onClick={onClose} className="rounded-full bg-muted px-3 py-1 text-xs">✕</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {packs.map((p) => (
          <div key={p.id} className={`chrome-panel p-3 ${p.featured ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{p.name}</span>
              <span className="text-lg font-black text-primary">💎 {p.credit_amount + (p.bonus_credits ?? 0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold">{Number(p.price ?? 0).toFixed(2)} ₪</span>
              <button onClick={() => buy(p.id)} disabled={busy === p.id} className="btn-plastic text-xs disabled:opacity-50">
                {busy === p.id ? "…" : "רכישה"}
              </button>
            </div>
          </div>
        ))}
        {packs.length === 0 && <div className="text-xs text-muted-foreground">אין חבילות זמינות כרגע.</div>}
      </div>
    </div>
  );
}
