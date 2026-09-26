import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { syncWooStock } from "@/lib/woo.functions";
import { cn } from "@/lib/utils";

type Reward = {
  id?: string;
  type: "credits" | "free_spin" | "product" | "cosmetic";
  label?: string;
  weight: number;
  amount?: number;
  product_id?: string;
  cosmetic_id?: string;
  color?: string;
  name?: string;
  image_url?: string;
  sku?: string;
};

type Wheel = { id: string; name: string; description: string | null; image_url: string | null; spin_cost_credits: number; active: boolean; rewards: Reward[] | null; };

export function WheelView({ storeId }: { storeId: string }) {
  const { refreshProfile } = useAuth();
  const qc = useQueryClient();
  const { data: wheels = [] } = useQuery({
    queryKey: ["wheels-for-store", storeId],
    queryFn: async () => (await supabase.from("wheel_configs").select("*").eq("store_id", storeId).eq("active", true)).data as unknown as Wheel[] ?? [],
  });
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (wheels.length === 1) setOpenId(wheels[0].id);
  }, [wheels.length]);

  const onSpun = () => {
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["inv"] });
    qc.invalidateQueries({ queryKey: ["my-orders"] });
    qc.invalidateQueries({ queryKey: ["wheels-for-store"] });
  };

  if (!wheels.length) return <div className="py-10 text-center text-sm text-muted-foreground">🎡 עדיין לא הוגדר גלגל לחנות הזו. בעלים – הגדירו בטאב "גלגלי מזל".</div>;

  return (
    <div className={cn("grid gap-2", wheels.length > 2 && "max-h-[420px] overflow-y-auto pr-1")}>
      {wheels.map((w) => {
        const open = openId === w.id;
        return (
          <div key={w.id} className="chrome-panel overflow-hidden p-0">
            <button
              onClick={() => setOpenId(open ? null : w.id)}
              className="flex w-full items-center gap-3 p-3 text-right"
            >
              {w.image_url
                ? <img src={w.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl">🎡</div>}
              <div className="min-w-0 flex-1">
                <div className="truncate font-black">{w.name}</div>
                {w.description && <div className="line-clamp-1 text-[11px] text-muted-foreground">{w.description}</div>}
              </div>
              <span className="shrink-0 text-sm font-black text-primary">💎 {w.spin_cost_credits}</span>
              <span className={`shrink-0 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
            </button>
            {open && (
              <div className="border-t border-border p-3">
                <WheelSpinner wheel={w} onSpun={onSpun} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WheelSpinner({ wheel, onSpun }: { wheel: Wheel; onSpun: () => void }) {
  const rewards = wheel.rewards ?? [];
  const total = rewards.reduce((s, r) => s + (r.weight || 0), 0) || 1;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Reward | null>(null);
  const [showItems, setShowItems] = useState(false);

  const segments = useMemo(() => {
    let acc = 0;
    return rewards.map((r) => {
      const from = (acc / total) * 360;
      acc += r.weight || 0;
      const to = (acc / total) * 360;
      return { r, from, to, mid: (from + to) / 2 };
    });
  }, [rewards, total]);

  const conic = useMemo(() => {
    const stops = segments.map((s) => `${s.r.color ?? "#ec4899"} ${s.from}deg ${s.to}deg`).join(", ");
    return `conic-gradient(${stops})`;
  }, [segments]);

  const pushWooStock = useServerFn(syncWooStock);

  const spin = async () => {
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    const { data, error } = await supabase.rpc("spin_wheel" as never, { _wheel_id: wheel.id } as never);
    if (error) { toast.error(error.message); setSpinning(false); return; }
    const res = data as { ok: boolean; index: number; reward: Reward; new_balance: number };
    const seg = segments[res.index];
    const targetMid = seg?.mid ?? 0;
    // Wheel rotates so that the top pointer (at 0deg from top / 270deg CSS) points at the segment.
    // We use pointer at top (12 o'clock). CSS conic-gradient starts at top (0deg).
    // Final rotation modulo 360 should equal (360 - targetMid). Add multiple full turns.
    const finalMod = (360 - targetMid) % 360;
    const nextRotation = rotation + (5 * 360) + (finalMod - (rotation % 360) + 360) % 360;
    setRotation(nextRotation);
    setTimeout(() => {
      setSpinning(false);
      setResult(res.reward);
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      toast.success(`זכית: ${labelFor(res.reward)}`);
      if (res.reward?.type === "product" && res.reward.product_id) {
        pushWooStock({ data: { product_id: res.reward.product_id } }).catch(() => {});
      }
      onSpun();
    }, 4200);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto grid place-items-center">
        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[22px] border-x-transparent border-t-red-500" />
        <div
          className="relative h-72 w-72 rounded-full border-8 border-white shadow-2xl"
          style={{ background: conic, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(0.2,0.8,0.2,1)" : undefined }}
        >
          {segments.map((s, i) => {
            // Product segments: colors only — names clutter the wheel when there are many items.
            if (s.r.type === "product" || s.r.type === "cosmetic") return null;
            return (
              <div key={i} className="absolute inset-0" style={{ transform: `rotate(${s.mid}deg)` }}>
                <div className="absolute left-1/2 top-4 -translate-x-1/2 text-[10px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                  {labelFor(s.r)}
                </div>
              </div>
            );
          })}
          <div className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-white text-2xl shadow-inner">🎡</div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-xl font-black">{wheel.name}</h3>
          {wheel.description && <p className="text-xs text-muted-foreground">{wheel.description}</p>}
        </div>
        <div className="text-sm">עלות סיבוב: <span className="font-black text-primary">💎 {wheel.spin_cost_credits}</span></div>
        <button onClick={spin} disabled={spinning || !rewards.length} className="btn-plastic text-lg disabled:opacity-40">
          {spinning ? "🎡 מסתובב…" : "🎡 סובב!"}
        </button>
        {result && (
          <div className="chrome-panel animate-in fade-in zoom-in p-3 text-center">
            <div className="text-xs text-muted-foreground">זכיתם ב:</div>
            {result.image_url && (
              <img src={result.image_url} alt="" className="mx-auto my-2 h-24 w-24 rounded-xl object-cover shadow-lg" />
            )}
            <div className="text-lg font-black">{labelFor(result)}</div>
            {result.sku && <div className="text-[11px] text-muted-foreground">מק"ט: {result.sku}</div>}
          </div>
        )}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowItems((v) => !v)}
            className="chrome-panel flex w-full items-center gap-2 p-2 text-right text-xs font-semibold"
          >
            <span className="flex-1">🎁 פריטים בגלגל ({rewards.length})</span>
            <span className={`transition-transform ${showItems ? "rotate-180" : ""}`}>▼</span>
          </button>
          {showItems && (
            <div className="mt-2 flex max-h-56 flex-wrap gap-1 overflow-y-auto text-[11px]">
              {rewards.map((r, i) => (
                <span key={i} className="rounded-full px-2 py-0.5 text-white" style={{ background: r.color ?? "#ec4899" }}>
                  {labelFor(r)} · {((r.weight / total) * 100).toFixed(1)}%
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function labelFor(r: Reward): string {
  if (r.type === "product" && r.name) return `📦 ${r.name}`;
  if (r.type === "cosmetic" && r.name) return `👕 ${r.name}`;
  if (r.label) return r.label;
  if (r.type === "credits") return `💎 ${r.amount ?? 0}`;
  if (r.type === "free_spin") return "🎁 סיבוב";
  if (r.type === "product") return "📦 מוצר";
  if (r.type === "cosmetic") return "👕 קוסמטיקה";
  return "?";
}

export function MysteryView({ storeId }: { storeId: string }) {
  const { refreshProfile } = useAuth();
  const qc = useQueryClient();
  const { data: boxes = [] } = useQuery({
    queryKey: ["boxes-for-store", storeId],
    queryFn: async () => (await supabase.from("mystery_boxes").select("*").eq("store_id", storeId).eq("active", true)).data ?? [],
  });
  const [opening, setOpening] = useState<{ boxName: string; reward: Reward } | null>(null);
  const pushWooStock = useServerFn(syncWooStock);
  const [busy, setBusy] = useState<string | null>(null);

  const open = async (id: string, name: string) => {
    setBusy(id);
    const { data, error } = await supabase.rpc("open_mystery_box" as never, { _box_id: id } as never);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; reward: Reward };
    setOpening({ boxName: name, reward: res.reward });
    if (res.reward?.type === "product" && res.reward.product_id) {
      pushWooStock({ data: { product_id: res.reward.product_id } }).catch(() => {});
    }
    setTimeout(() => confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } }), 3200);
    refreshProfile(); qc.invalidateQueries({ queryKey: ["inv"] }); qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  if (!boxes.length) return <div className="py-10 text-center text-sm text-muted-foreground">🎁 עדיין לא הוגדרו חבילות. בעלים – הגדירו בטאב "קופסאות מסתורין".</div>;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {boxes.map((b) => {
          const box = b as { id: string; name: string; description: string | null; image_url: string | null; price_credits: number; stock: number | null; unlimited_stock: boolean };
          const soldOut = !box.unlimited_stock && (box.stock ?? 0) <= 0;
          return (
            <div key={box.id} className="chrome-panel overflow-hidden p-0">
              <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-purple-200 to-pink-200">
                {box.image_url ? <img src={box.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-6xl">🎁</div>}
              </div>
              <div className="p-3">
                <div className="font-bold">{box.name}</div>
                {box.description && <div className="line-clamp-2 text-xs text-muted-foreground">{box.description}</div>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-black text-primary">💎 {box.price_credits}</span>
                  <button disabled={soldOut || busy === box.id} onClick={() => open(box.id, box.name)} className="btn-plastic text-xs disabled:opacity-40">
                    {soldOut ? "אזל" : busy === box.id ? "…" : "פתחו!"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {opening && <PackReveal boxName={opening.boxName} reward={opening.reward} onClose={() => setOpening(null)} />}
    </>
  );
}

function PackReveal({ boxName, reward, onClose }: { boxName: string; reward: Reward; onClose: () => void }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0: shaking, 1: glowing/cracking, 2: opened
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1800);
    const t2 = setTimeout(() => setStage(2), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const emoji = reward.type === "credits" ? "💎" : reward.type === "cosmetic" ? "👕" : reward.type === "product" ? "📦" : "🎁";
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4" onClick={stage === 2 ? onClose : undefined}>
      <div className="chrome-panel relative w-full max-w-sm overflow-hidden p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs text-muted-foreground">{boxName}</div>
        <div className="relative mx-auto my-4 h-44 w-44 [perspective:1000px]">
          {/* Glow ring */}
          <div className={`absolute -inset-4 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 opacity-0 blur-2xl transition-opacity duration-700 ${stage >= 1 ? "opacity-70 animate-pulse" : ""}`} />
          {/* Box */}
          <div
            className={`absolute inset-0 grid place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-7xl text-white shadow-2xl [transform-style:preserve-3d] transition-all duration-1000 ${stage === 0 ? "animate-[wiggle_0.4s_ease-in-out_infinite]" : ""} ${stage === 1 ? "scale-110" : ""} ${stage === 2 ? "opacity-0 [transform:rotateY(180deg)_scale(2)]" : ""}`}
            style={{ animationName: stage === 0 ? "wiggle" : undefined }}
          >
            🎁
          </div>
          {/* Reward */}
          <div className={`absolute inset-0 grid place-items-center rounded-2xl bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-400 text-white shadow-2xl transition-all duration-1000 ${stage === 2 ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
            {reward.image_url ? (
              <img src={reward.image_url} alt="" className="h-32 w-32 rounded-xl object-cover shadow-xl" />
            ) : (
              <span className="text-6xl">{emoji}</span>
            )}
          </div>
        </div>
        <div className="mb-1 text-xs text-muted-foreground">{stage < 2 ? "פותחים…" : "קיבלתם"}</div>
        <div className={`text-2xl font-black transition-opacity duration-500 ${stage === 2 ? "opacity-100" : "opacity-40"}`}>
          {stage === 2 ? labelFor(reward) : "❓ ❓ ❓"}
        </div>
        {reward.sku && stage === 2 && <div className="text-[11px] text-muted-foreground">מק"ט: {reward.sku}</div>}
        <button onClick={onClose} disabled={stage < 2} className="btn-plastic mt-4 disabled:opacity-40">
          {stage < 2 ? "רגע…" : "איזה כיף!"}
        </button>
      </div>
      <style>{`@keyframes wiggle { 0%,100% { transform: rotate(-6deg) translateY(0); } 25% { transform: rotate(6deg) translateY(-4px); } 50% { transform: rotate(-4deg) translateY(2px); } 75% { transform: rotate(4deg) translateY(-2px); } }`}</style>
    </div>
  );
}
