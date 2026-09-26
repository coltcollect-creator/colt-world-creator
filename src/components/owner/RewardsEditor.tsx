import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Reward = {
  id: string;
  type: "credits" | "free_spin" | "product" | "cosmetic";
  label?: string;
  weight: number;
  amount?: number;
  product_id?: string;
  cosmetic_id?: string;
  image_url?: string;
  color?: string;
};

type Item = {
  id: string;
  name: string;
  image_url: string | null;
  credit_price: number | null;
  category: string | null;
  stock: number | null;
  unlimited_stock: boolean;
};

const uid = () => Math.random().toString(36).slice(2, 10);

function normalize(list: Reward[]): Reward[] {
  const total = list.reduce((s, r) => s + (r.weight || 0), 0);
  if (total <= 0 && list.length) return list.map((r) => ({ ...r, weight: 100 / list.length }));
  return list;
}

function setPct(list: Reward[], idx: number, newPct: number): Reward[] {
  newPct = Math.max(0, Math.min(100, newPct));
  const others = list.filter((_, i) => i !== idx);
  const remaining = 100 - newPct;
  const sumOthers = others.reduce((s, r) => s + (r.weight || 0), 0);
  return list.map((r, i) => {
    if (i === idx) return { ...r, weight: newPct };
    if (!others.length) return r;
    const scale = sumOthers > 0 ? (r.weight || 0) / sumOthers : 1 / others.length;
    return { ...r, weight: remaining * scale };
  });
}

function equalize(list: Reward[]): Reward[] {
  if (!list.length) return list;
  return list.map((r) => ({ ...r, weight: 100 / list.length }));
}

const COLORS = ["#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

export function RewardsEditor({ value, onChange, includeFreeSpin = false }: { value: Reward[]; onChange: (v: Reward[]) => void; includeFreeSpin?: boolean }) {
  const list = useMemo(() => normalize(value ?? []), [value]);

  const [products, setProducts] = useState<Item[]>([]);
  const [cosmetics, setCosmetics] = useState<Item[]>([]);
  const [tab, setTab] = useState<"list" | "bulk">("list");

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("products")
        .select("id,name,image_url,credit_price,sale_credit_price,category,stock,unlimited_stock")
        .eq("active", true)
        .order("name");
      const { data: c } = await supabase
        .from("cosmetics")
        .select("id,name,thumbnail_url,sprite_right_url,credit_price,layer_type")
        .eq("active", true)
        .order("name");
      setProducts(
        (p ?? []).map((x: Record<string, unknown>) => ({
          id: x.id as string,
          name: x.name as string,
          image_url: (x.image_url as string) ?? null,
          credit_price: (x.sale_credit_price as number) ?? (x.credit_price as number) ?? null,
          category: (x.category as string) ?? null,
          stock: (x.stock as number) ?? null,
          unlimited_stock: Boolean(x.unlimited_stock),
        })),
      );
      setCosmetics(
        (c ?? []).map((x: Record<string, unknown>) => ({
          id: x.id as string,
          name: x.name as string,
          image_url: ((x.thumbnail_url as string) || (x.sprite_right_url as string)) ?? null,
          credit_price: (x.credit_price as number) ?? null,
          category: (x.layer_type as string) ?? null,
          stock: null,
          unlimited_stock: true,
        })),
      );
    })();
  }, []);

  const total = list.reduce((s, r) => s + (r.weight || 0), 0);

  const addRow = (type: Reward["type"]) => {
    const color = COLORS[list.length % COLORS.length];
    const base: Reward = { id: uid(), type, weight: 0, color, label: type === "credits" ? "💎 credits" : type === "free_spin" ? "🎁 free spin" : "" };
    if (type === "credits") base.amount = 10;
    onChange(equalize([...list, base]));
  };

  const addMany = (kind: "product" | "cosmetic", items: Item[]) => {
    const rows: Reward[] = items.map((it, n) => ({
      id: uid(),
      type: kind,
      weight: 0,
      color: COLORS[(list.length + n) % COLORS.length],
      label: it.name,
      image_url: it.image_url ?? undefined,
      ...(kind === "product" ? { product_id: it.id } : { cosmetic_id: it.id }),
    }));
    onChange(equalize([...list, ...rows]));
    setTab("list");
  };

  const update = (i: number, patch: Partial<Reward>) => {
    const next = list.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (i: number) => onChange(equalize(list.filter((_, idx) => idx !== i)));

  const priceOf = (r: Reward): number | null => {
    if (r.type === "product") return products.find((p) => p.id === r.product_id)?.credit_price ?? null;
    if (r.type === "cosmetic") return cosmetics.find((c) => c.id === r.cosmetic_id)?.credit_price ?? null;
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 text-xs">
        <button type="button" onClick={() => setTab("list")} className={`px-3 py-1 rounded ${tab === "list" ? "btn-plastic" : "chrome-panel"}`}>🎯 פרסים ({list.length})</button>
        <button type="button" onClick={() => setTab("bulk")} className={`px-3 py-1 rounded ${tab === "bulk" ? "btn-plastic" : "chrome-panel"}`}>➕ הוספה מרובה</button>
      </div>

      {tab === "bulk" ? (
        <BulkPicker products={products} cosmetics={cosmetics} existing={list} onAdd={addMany} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button type="button" className="chrome-panel px-2 py-1" onClick={() => addRow("credits")}>+ 💎 קרדיטים</button>
            {includeFreeSpin && <button type="button" className="chrome-panel px-2 py-1" onClick={() => addRow("free_spin")}>+ 🎁 סיבוב חוזר</button>}
            <button type="button" className="chrome-panel px-2 py-1" onClick={() => addRow("product")}>+ 📦 מוצר</button>
            <button type="button" className="chrome-panel px-2 py-1" onClick={() => addRow("cosmetic")}>+ 👕 קוסמטיקה</button>
            <button type="button" className="chrome-panel px-2 py-1" onClick={() => onChange(equalize(list))}>⚖️ יחסים שווים</button>
            <span className="ms-auto text-[11px] text-muted-foreground">סה״כ סיכוי: {total.toFixed(1)}%</span>
          </div>
          {list.length === 0 && <div className="rounded bg-muted p-3 text-xs text-muted-foreground">אין פרסים. הוסיפו למעלה.</div>}
          {list.map((r, i) => {
            const opts = r.type === "product" ? products : r.type === "cosmetic" ? cosmetics : [];
            const price = priceOf(r);
            return (
              <div key={r.id} className="chrome-panel space-y-1 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded" style={{ background: r.color ?? "#ec4899" }} />
                  <select value={r.type} onChange={(e) => update(i, { type: e.target.value as Reward["type"], product_id: undefined, cosmetic_id: undefined })} className="rounded border bg-input px-1 py-0.5">
                    <option value="credits">💎 קרדיטים</option>
                    {includeFreeSpin && <option value="free_spin">🎁 סיבוב חוזר</option>}
                    <option value="product">📦 מוצר</option>
                    <option value="cosmetic">👕 קוסמטיקה</option>
                  </select>
                  <input value={r.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} placeholder="תווית תצוגה" className="flex-1 rounded border bg-input px-2 py-0.5" />
                  <input type="color" value={r.color ?? "#ec4899"} onChange={(e) => update(i, { color: e.target.value })} className="h-7 w-8 rounded" />
                  <button type="button" onClick={() => remove(i)} className="rounded bg-destructive/20 px-2 text-destructive">✕</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.type === "credits" && (
                    <label className="flex items-center gap-1">כמות 💎
                      <input type="number" value={r.amount ?? 0} onChange={(e) => update(i, { amount: Number(e.target.value) })} className="w-20 rounded border bg-input px-1" />
                    </label>
                  )}
                  {(r.type === "product" || r.type === "cosmetic") && (
                    <>
                      <select value={(r.type === "product" ? r.product_id : r.cosmetic_id) ?? ""} onChange={(e) => {
                        const id = e.target.value;
                        const item = opts.find((o) => o.id === id);
                        update(i, {
                          ...(r.type === "product" ? { product_id: id } : { cosmetic_id: id }),
                          // Default the display label to the item name (owner can edit after).
                          ...(item && (!r.label || r.label === "") ? { label: item.name, image_url: r.image_url ?? item.image_url ?? undefined } : {}),
                        });
                      }} className="flex-1 rounded border bg-input px-1 py-0.5">
                        <option value="">— בחר —</option>
                        {opts.map((o) => <option key={o.id} value={o.id}>{o.name} · 💎 {o.credit_price ?? 0}</option>)}
                      </select>
                      {price !== null && <span className="shrink-0 rounded bg-muted px-2 py-0.5">שווי: 💎 {price}</span>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} step={0.5} value={r.weight} onChange={(e) => onChange(setPct(list, i, Number(e.target.value)))} className="flex-1" />
                  <input type="number" min={0} max={100} step={0.5} value={Number(r.weight.toFixed(2))} onChange={(e) => onChange(setPct(list, i, Number(e.target.value)))} className="w-16 rounded border bg-input px-1 py-0.5" />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function BulkPicker({
  products,
  cosmetics,
  existing,
  onAdd,
}: {
  products: Item[];
  cosmetics: Item[];
  existing: Reward[];
  onAdd: (kind: "product" | "cosmetic", items: Item[]) => void;
}) {
  const [kind, setKind] = useState<"product" | "cosmetic">("product");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const source = kind === "product" ? products : cosmetics;
  const categories = useMemo(() => Array.from(new Set(source.map((s) => s.category).filter(Boolean))) as string[], [source]);
  const alreadyIds = useMemo(
    () => new Set(existing.map((r) => (r.type === "product" ? r.product_id : r.cosmetic_id)).filter(Boolean) as string[]),
    [existing],
  );

  const filtered = useMemo(
    () =>
      source.filter(
        (s) =>
          (!category || s.category === category) &&
          (!search || s.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [source, category, search],
  );

  const pickedItems = filtered.filter((f) => picked[f.id]);
  const allPicked = filtered.length > 0 && filtered.every((f) => picked[f.id]);

  const switchKind = (k: "product" | "cosmetic") => { setKind(k); setCategory(""); setPicked({}); };

  return (
    <div className="chrome-panel space-y-2 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => switchKind(e.target.value as "product" | "cosmetic")} className="rounded border bg-input px-2 py-1">
          <option value="product">📦 מוצרים</option>
          <option value="cosmetic">👕 קוסמטיקות</option>
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPicked({}); }} className="rounded border bg-input px-2 py-1">
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם…" className="flex-1 rounded border bg-input px-2 py-1" />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="chrome-panel px-2 py-1"
          onClick={() => setPicked(allPicked ? {} : Object.fromEntries(filtered.map((f) => [f.id, true])))}
        >
          {allPicked ? "נקה בחירה" : `בחר הכל (${filtered.length})`}
        </button>
        <span className="text-muted-foreground">נבחרו {pickedItems.length}</span>
        <button
          type="button"
          disabled={!pickedItems.length}
          className="btn-plastic ms-auto px-3 py-1 disabled:opacity-40"
          onClick={() => { onAdd(kind, pickedItems); setPicked({}); }}
        >
          הוסף לגלגל ({pickedItems.length})
        </button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {filtered.length === 0 && <div className="rounded bg-muted p-3 text-muted-foreground">לא נמצאו פריטים.</div>}
        {filtered.map((it) => (
          <label key={it.id} className="flex cursor-pointer items-center gap-2 rounded bg-muted/40 p-1.5">
            <input type="checkbox" checked={Boolean(picked[it.id])} onChange={(e) => setPicked((p) => ({ ...p, [it.id]: e.target.checked }))} />
            {it.image_url ? <img src={it.image_url} alt="" className="h-8 w-8 rounded bg-background object-contain" /> : <span className="grid h-8 w-8 place-items-center rounded bg-background">{kind === "product" ? "📦" : "👕"}</span>}
            <span className="min-w-0 flex-1 truncate">{it.name}</span>
            {it.category && <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{it.category}</span>}
            <span className="shrink-0 rounded bg-background px-1.5 py-0.5">💎 {it.credit_price ?? 0}</span>
            {kind === "product" && <span className="shrink-0 text-[10px] text-muted-foreground">{it.unlimited_stock ? "∞" : `מלאי ${it.stock ?? 0}`}</span>}
            {alreadyIds.has(it.id) && <span className="shrink-0 text-[10px] text-amber-500">כבר בגלגל</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
