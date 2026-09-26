import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/owner/ImageUpload";

type Row = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  store_id: string | null;
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

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AuctionsPanel() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["own", "auctions"],
    queryFn: async () => ((await supabase.from("auctions").select("*").order("created_at", { ascending: false })).data ?? []) as unknown as Row[],
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-auction"],
    queryFn: async () => (await supabase.from("stores").select("id,name,store_type").eq("store_type", "auction").order("name")).data ?? [],
  });
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const editing = editingId === "new" ? null : rows.find((r) => r.id === editingId) ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["own", "auctions"] });

  const del = async (id: string) => {
    if (!confirm("למחוק את המכרז?")) return;
    const { error } = await supabase.from("auctions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("נמחק");
      invalidate();
    }
  };

  const settle = async (id: string) => {
    if (!confirm("לסגור את המכרז ולהכריז על הזוכה?")) return;
    const { error } = await supabase.rpc("settle_auction", { _auction_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success("המכרז נסגר — נוצרה הזמנה לזוכה");
      invalidate();
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("לבטל את המכרז ולהחזיר את היהלומים למוביל?")) return;
    const { error } = await supabase.rpc("cancel_auction", { _auction_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success("בוטל והוחזרו היהלומים");
      invalidate();
    }
  };

  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🔨 מכרזים ({rows.length})</h2>
        <button onClick={() => setEditingId("new")} className="btn-plastic text-xs">+ חדש</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="chrome-panel flex items-center gap-3 p-3">
            {r.image_url ? (
              <img src={r.image_url} alt="" className="h-14 w-14 rounded object-contain" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded bg-muted text-2xl">🔨</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                פתיחה 💎 {r.starting_price} · קפיצה 💎 {r.bid_increment} · מוביל 💎 {r.current_bid ?? "—"} ·{" "}
                {(r.product_ids ?? []).length} מוצרים · {r.settled_at ? "הסתיים" : r.active ? "פעיל" : "כבוי"}
              </div>
              <div className="text-[11px] text-muted-foreground">נפתח: {new Date(r.starts_at).toLocaleString("he-IL")}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditingId(r.id)} className="chrome-panel px-2 py-1 text-xs">ערוך</button>
              {!r.settled_at && (
                <>
                  <button onClick={() => settle(r.id)} className="chrome-panel px-2 py-1 text-xs">סגור</button>
                  <button onClick={() => cancel(r.id)} className="chrome-panel px-2 py-1 text-xs">בטל</button>
                </>
              )}
              <button onClick={() => del(r.id)} className="chrome-panel px-2 py-1 text-xs">🗑️</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">אין מכרזים עדיין.</div>}
      </div>
      {editingId && (
        <AuctionEditor
          row={editing}
          stores={stores as Array<{ id: string; name: string }>}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function AuctionEditor({
  row,
  stores,
  onClose,
  onSaved,
}: {
  row: Row | null;
  stores: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Row>(
    () =>
      row ?? {
        id: "",
        name: "מכרז חדש",
        description: "",
        image_url: null,
        store_id: null,
        product_ids: [],
        starting_price: 100,
        bid_increment: 10,
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: "scheduled",
        current_bid: null,
        current_leader: null,
        winner_id: null,
        settled_at: null,
        active: true,
      },
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["auction-picker-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,sku,image_url,stock,unlimited_stock").eq("active", true).limit(50);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      return (await q).data ?? [];
    },
  });

  const selected = form.product_ids ?? [];
  const toggle = (id: string) =>
    setForm((f) => {
      const cur = f.product_ids ?? [];
      return { ...f, product_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  const save = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      image_url: form.image_url,
      store_id: form.store_id || null,
      product_ids: form.product_ids ?? [],
      starting_price: Number(form.starting_price) || 0,
      bid_increment: Math.max(1, Number(form.bid_increment) || 1),
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      active: form.active,
    };
    const res = row?.id ? await supabase.from("auctions").update(payload).eq("id", row.id) : await supabase.from("auctions").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("נשמר");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">🔨 עורך מכרז</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <span className="font-semibold">שם המכרז</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">חנות משוייכת (סוג "auction")</span>
            <select
              value={form.store_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value || null }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            >
              <option value="">— ללא —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs md:col-span-2">
            <span className="font-semibold">תיאור / מידע לתצוגה מקדימה</span>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">מחיר פתיחה (💎)</span>
            <input
              type="number"
              value={form.starting_price}
              onChange={(e) => setForm((f) => ({ ...f, starting_price: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">גודל קפיצת בידים (💎)</span>
            <input
              type="number"
              value={form.bid_increment}
              onChange={(e) => setForm((f) => ({ ...f, bid_increment: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">שעת פתיחה</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.starts_at)}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: new Date(e.target.value).toISOString() }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">שעת סיום (אופציונלי)</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.ends_at)}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <div className="flex items-center gap-3 pt-4 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <span className="font-semibold">פעיל</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold">תמונת המכרז</div>
            <ImageUpload value={form.image_url ?? ""} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">מוצרים מהמלאי במכרז ({selected.length})</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש מוצר…"
                className="rounded-xl border-2 border-border bg-input px-3 py-1 text-xs"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border-2 border-border p-2">
              {products.map((p) => {
                const prod = p as { id: string; name: string; sku: string | null; image_url: string | null; stock: number | null; unlimited_stock: boolean };
                return (
                  <label key={prod.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted">
                    <input type="checkbox" checked={selected.includes(prod.id)} onChange={() => toggle(prod.id)} />
                    {prod.image_url && <img src={prod.image_url} alt="" className="h-8 w-8 rounded object-contain" />}
                    <span className="flex-1 truncate font-semibold">{prod.name}</span>
                    <span className="text-muted-foreground">{prod.unlimited_stock ? "∞" : `מלאי ${prod.stock ?? 0}`}</span>
                  </label>
                );
              })}
              {products.length === 0 && <div className="text-xs text-muted-foreground">לא נמצאו מוצרים.</div>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="chrome-panel px-3 py-1 text-xs">ביטול</button>
          <button onClick={save} disabled={saving} className="btn-plastic text-xs disabled:opacity-50">
            {saving ? "שומר…" : "שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}
