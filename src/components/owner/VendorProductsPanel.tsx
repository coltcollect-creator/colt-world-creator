import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { gameDataStore } from "@/lib/gameDataStore";
import { Check, Store, Layers } from "lucide-react";

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
  store_ids?: string[] | null;
  created_at: string;
  vendor_id: string | null;
  vendors: { id: string; shop_name: string | null; user_id: string } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתין לאישור", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "אושר", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "נדחה", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export function VendorProductsPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStore, setBulkStore] = useState("");
  const [multiStoreModal, setMultiStoreModal] = useState<Row | null>(null);
  const [includeOwnerSelf, setIncludeOwnerSelf] = useState(true);

  // Live real-time subscription to products and vendors in Firestore
  useEffect(() => {
    let unsubProducts: (() => void) | null = null;
    let unsubVendors: (() => void) | null = null;
    try {
      unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
        for (const d of snap.docs) {
          gameDataStore.upsertRow("products", { ...d.data(), id: d.id });
        }
        qc.invalidateQueries({ queryKey: ["owner-vendor-products"] });
      }, (err) => {
        console.warn("Products onSnapshot sync notice:", err);
      });
      unsubVendors = onSnapshot(collection(db, "vendors"), (snap) => {
        for (const d of snap.docs) {
          gameDataStore.upsertRow("vendors", { ...d.data(), id: d.id });
        }
        qc.invalidateQueries({ queryKey: ["owner-vendor-products"] });
      }, (err) => {
        console.warn("Vendors onSnapshot sync notice:", err);
      });
    } catch (e) {
      console.warn("Realtime listener error in VendorProductsPanel:", e);
    }
    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubVendors) unsubVendors();
    };
  }, [qc]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["owner-vendor-products"],
    queryFn: async () => {
      // Ensure vendors are fetched
      await supabase.from("vendors").select("*");
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, image_url, category, set_name, tags, credit_price, stock, active, vendor_status, store_id, store_ids, created_at, vendor_id, vendors(id, shop_name, user_id)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const all = (data ?? []) as unknown as Row[];
      // Keep all vendor-submitted and approval-managed products visible
      return all.filter((r) => r.vendor_id != null || r.vendor_status != null);
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["owner-stores-simple"],
    queryFn: async () => (await supabase.from("stores").select("id, name").order("name")).data ?? [],
  });

  const vendorOnlyRows = useMemo(() => {
    return rows.filter((r) => {
      if (!includeOwnerSelf && r.vendors?.user_id === user?.id) return false;
      return true;
    });
  }, [rows, user?.id, includeOwnerSelf]);

  const refresh = () => {
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["owner-vendor-products"] });
    qc.invalidateQueries({ queryKey: ["store-products"] });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendorOnlyRows.filter(
      (r) =>
        (filter === "all" || r.vendor_status === filter) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          (r.vendors?.shop_name ?? "").toLowerCase().includes(q) ||
          (r.category ?? "").toLowerCase().includes(q)),
    );
  }, [vendorOnlyRows, filter, search]);

  const counts = {
    pending: vendorOnlyRows.filter((r) => r.vendor_status === "pending").length,
    approved: vendorOnlyRows.filter((r) => r.vendor_status === "approved").length,
    rejected: vendorOnlyRows.filter((r) => r.vendor_status === "rejected").length,
  };

  const update = async (
    ids: string[],
    patch: { vendor_status?: string; active?: boolean; store_id?: string | null; store_ids?: string[] },
    msg: string
  ) => {
    if (!ids.length) return;
    const { error } = await supabase.from("products").update(patch).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    refresh();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ids = [...selected];

  const toggleProductStore = async (prod: Row, sId: string) => {
    const current = new Set(prod.store_ids || (prod.store_id ? [prod.store_id] : []));
    if (current.has(sId)) current.delete(sId);
    else current.add(sId);
    const arr = Array.from(current);
    const mainStore = arr[0] || null;
    await update([prod.id], { store_id: mainStore, store_ids: arr }, "שיוך חנויות עודכן");
    if (multiStoreModal?.id === prod.id) {
      setMultiStoreModal({ ...prod, store_id: mainStore, store_ids: arr });
    }
  };

  return (
    <div dir="rtl" className="space-y-3">
      <div className="chrome-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-black">
            <Store className="h-4 w-4 text-primary" />
            <span>אישור וניהול מוצרי ונדורים</span>
          </div>
          <div className="flex gap-1">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  filter === f ? "bg-primary text-primary-foreground shadow" : "bg-muted hover:bg-muted/80"
                }`}
              >
                {f === "pending"
                  ? `ממתינים לאישור (${counts.pending})`
                  : f === "approved"
                  ? `אושרו (${counts.approved})`
                  : f === "rejected"
                  ? `נדחו (${counts.rejected})`
                  : "הכל"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIncludeOwnerSelf((v) => !v)}
            className={`rounded-xl px-2.5 py-1 text-xs font-bold border transition-all ${
              includeOwnerSelf ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-muted-foreground"
            }`}
            title="החלף בין הצגת כל ההגשות להצגת ונדורים חיצוניים בלבד"
          >
            {includeOwnerSelf ? "👁️ מציג את כל ההגשות (כולל בדיקות)" : "🔍 ונדורים חיצוניים בלבד"}
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר / ונדור / קטגוריה"
          className="ms-auto w-56 rounded-xl border-2 border-border bg-input px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
      </div>

      {ids.length > 0 && (
        <div className="chrome-panel flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs">
          <span className="font-bold">נבחרו {ids.length}</span>
          <button
            onClick={() => void update(ids, { vendor_status: "approved", active: true }, "אושרו והוצגו")}
            className="rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white shadow-sm hover:brightness-110"
          >
            ✅ אישור והצגה
          </button>
          <button
            onClick={() => void update(ids, { vendor_status: "rejected", active: false }, "נדחו")}
            className="rounded-xl bg-red-600 px-3 py-1.5 font-bold text-white shadow-sm hover:brightness-110"
          >
            🚫 דחייה
          </button>
          <select
            value={bulkStore}
            onChange={(e) => setBulkStore(e.target.value)}
            className="rounded-xl border-2 border-border bg-input px-2 py-1.5 text-xs"
          >
            <option value="">שיוך לחנות ראשית…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            disabled={!bulkStore}
            onClick={() => void update(ids, { store_id: bulkStore, store_ids: [bulkStore] }, "שויכו לחנות")}
            className="rounded-xl bg-primary px-3 py-1.5 font-bold text-primary-foreground shadow-sm disabled:opacity-40"
          >
            שיוך
          </button>
          <button onClick={() => setSelected(new Set())} className="chrome-panel px-2 py-1.5">
            נקה בחירה
          </button>
        </div>
      )}

      <div className="chrome-panel rounded-2xl p-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">טוען…</div>
        ) : !visible.length ? (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            אין מוצרי ונדורים חיצוניים להצגה בקטגוריה זו.
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())
                }
              />
              בחירת כל המוצגים
            </label>
            {visible.map((r) => {
              const st = STATUS[r.vendor_status] ?? { label: r.vendor_status, cls: "bg-muted" };
              const assignedStores = r.store_ids && r.store_ids.length > 0 ? r.store_ids : r.store_id ? [r.store_id] : [];
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-border bg-card/60 p-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                  <div className="min-w-40 flex-1">
                    <div className="truncate text-sm font-bold">{r.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      ונדור: <span className="font-bold text-foreground">{r.vendors?.shop_name || "ללא שם"}</span> · {r.category ?? "—"}
                      {r.set_name ? ` · ${r.set_name}` : ""} · 💎 {r.credit_price} · מלאי {r.stock ?? "∞"}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                    {st.label}
                  </span>

                  {/* Multi-Store assignment button */}
                  <button
                    type="button"
                    onClick={() => setMultiStoreModal(r)}
                    className="flex items-center gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-bold hover:bg-muted"
                  >
                    <Layers className="h-3 w-3 text-primary" />
                    <span>{assignedStores.length > 0 ? `${assignedStores.length} חנויות משויכות` : "שיוך חנויות"}</span>
                  </button>

                  {r.vendor_status !== "approved" && (
                    <button
                      onClick={() => void update([r.id], { vendor_status: "approved", active: true }, "אושר")}
                      className="rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                    >
                      אישור
                    </button>
                  )}
                  {r.vendor_status !== "rejected" && (
                    <button
                      onClick={() => void update([r.id], { vendor_status: "rejected", active: false }, "נדחה")}
                      className="rounded-xl bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                    >
                      דחייה
                    </button>
                  )}
                  <button
                    onClick={() =>
                      void update([r.id], { active: !r.active }, r.active ? "הוסתר" : "מוצג")
                    }
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

      {/* Multi-Store modal */}
      {multiStoreModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setMultiStoreModal(null)}
        >
          <div
            className="chrome-panel w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div>
                <h3 className="text-base font-bold">שיוך מוצר לחנויות</h3>
                <p className="text-xs text-muted-foreground">{multiStoreModal.name}</p>
              </div>
              <button
                onClick={() => setMultiStoreModal(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {stores.map((s) => {
                const assigned = (
                  multiStoreModal.store_ids || (multiStoreModal.store_id ? [multiStoreModal.store_id] : [])
                ).includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void toggleProductStore(multiStoreModal, s.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      assigned ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <span>{s.name}</span>
                    {assigned ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Check className="h-4 w-4" /> מוצג בחנות
                      </span>
                    ) : (
                      <span className="text-muted-foreground">+ הוסף</span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-xl">
              💡 המוצר יוצג בכל החנויות שנבחרו. כאשר המלאי יגיע ל-0, הוא יוסר אוטומטית מכל החנויות במקביל.
            </p>

            <button
              onClick={() => setMultiStoreModal(null)}
              className="btn-plastic w-full py-2 text-xs font-bold bg-primary text-primary-foreground"
            >
              סיום ושמירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
