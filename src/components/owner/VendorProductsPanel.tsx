import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  set_name: string | null;
  tags: string[] | null;
  credit_price: number;
  stock: number | null;
  active: boolean;
  vendor_status: string;
  store_id: string | null;
  created_at: string;
  vendor_id: string | null;
  vendors: { id: string; shop_name: string | null; user_id: string } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתין לאישור", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "אושר", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "נדחה", cls: "bg-red-100 text-red-700" },
};

export function VendorProductsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStore, setBulkStore] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["owner-vendor-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, image_url, category, set_name, tags, credit_price, stock, active, vendor_status, store_id, created_at, vendor_id, vendors(id, shop_name, user_id)",
        )
        .not("vendor_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["owner-stores-simple"],
    queryFn: async () => (await supabase.from("stores").select("id, name").order("name")).data ?? [],
  });

  const refresh = () => {
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["owner-vendor-products"] });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.vendor_status === filter) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          (r.vendors?.shop_name ?? "").toLowerCase().includes(q) ||
          (r.category ?? "").toLowerCase().includes(q)),
    );
  }, [rows, filter, search]);

  const counts = {
    pending: rows.filter((r) => r.vendor_status === "pending").length,
    approved: rows.filter((r) => r.vendor_status === "approved").length,
    rejected: rows.filter((r) => r.vendor_status === "rejected").length,
  };

  const update = async (ids: string[], patch: { vendor_status?: string; active?: boolean; store_id?: string | null }, msg: string) => {
    if (!ids.length) return;
    const { error } = await supabase.from("products").update(patch).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    refresh();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const ids = [...selected];

  return (
    <div dir="rtl" className="space-y-3">
      <div className="chrome-panel flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <div className="text-sm font-black">🏪 מוצרי ונדורים</div>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${filter === f ? "bg-primary text-primary-foreground shadow" : "bg-muted"}`}
            >
              {f === "pending" ? `ממתינים (${counts.pending})` : f === "approved" ? `אושרו (${counts.approved})` : f === "rejected" ? `נדחו (${counts.rejected})` : "הכל"}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר / ונדור / קטגוריה"
          className="ms-auto w-56 rounded-xl border-2 border-border bg-input px-3 py-1.5 text-xs"
        />
      </div>

      {ids.length > 0 && (
        <div className="chrome-panel flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs">
          <span className="font-bold">נבחרו {ids.length}</span>
          <button onClick={() => void update(ids, { vendor_status: "approved", active: true }, "אושרו והוצגו")} className="rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white">✅ אישור והצגה</button>
          <button onClick={() => void update(ids, { vendor_status: "rejected", active: false }, "נדחו")} className="rounded-xl bg-red-600 px-3 py-1.5 font-bold text-white">🚫 דחייה</button>
          <select value={bulkStore} onChange={(e) => setBulkStore(e.target.value)} className="rounded-xl border-2 border-border bg-input px-2 py-1.5">
            <option value="">שיוך לחנות…</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            disabled={!bulkStore}
            onClick={() => void update(ids, { store_id: bulkStore }, "שויכו לחנות")}
            className="rounded-xl bg-primary px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-40"
          >
            שיוך
          </button>
          <button onClick={() => setSelected(new Set())} className="chrome-panel px-2 py-1.5">נקה בחירה</button>
        </div>
      )}

      <div className="chrome-panel rounded-2xl p-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">טוען…</div>
        ) : !visible.length ? (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            אין מוצרי ונדורים בקטגוריה הזו.
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={visible.every((r) => selected.has(r.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())}
              />
              בחירת כל המוצגים
            </label>
            {visible.map((r) => {
              const st = STATUS[r.vendor_status] ?? { label: r.vendor_status, cls: "bg-muted" };
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-border bg-white/60 p-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                    {r.image_url ? <img src={r.image_url} alt={r.name} className="h-full w-full object-contain" /> : <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">—</div>}
                  </div>
                  <div className="min-w-40 flex-1">
                    <div className="truncate text-sm font-bold">{r.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      ונדור: {r.vendors?.shop_name || "ללא שם"} · {r.category ?? "—"}{r.set_name ? ` · ${r.set_name}` : ""} · 💎 {r.credit_price} · מלאי {r.stock ?? "∞"}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  <select
                    value={r.store_id ?? ""}
                    onChange={(e) => void update([r.id], { store_id: e.target.value || null }, "החנות עודכנה")}
                    className="rounded-xl border-2 border-border bg-input px-2 py-1 text-xs"
                  >
                    <option value="">ללא חנות</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {r.vendor_status !== "approved" && (
                    <button onClick={() => void update([r.id], { vendor_status: "approved", active: true }, "אושר")} className="rounded-xl bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">אישור</button>
                  )}
                  {r.vendor_status !== "rejected" && (
                    <button onClick={() => void update([r.id], { vendor_status: "rejected", active: false }, "נדחה")} className="rounded-xl bg-red-600 px-2 py-1 text-[11px] font-bold text-white">דחייה</button>
                  )}
                  <button
                    onClick={() => void update([r.id], { active: !r.active }, r.active ? "הוסתר" : "מוצג")}
                    className="chrome-panel px-2 py-1 text-[11px]"
                  >
                    {r.active ? "⏸️ הסתרה" : "▶️ הצגה"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
