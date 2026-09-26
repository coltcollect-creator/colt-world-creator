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

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LiveRipsPanel() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["own", "live_rips"],
    queryFn: async () =>
      ((await supabase.from("live_rips").select("*").order("scheduled_at", { ascending: false })).data ?? []) as unknown as Row[],
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-live-rip"],
    queryFn: async () =>
      (await supabase.from("stores").select("id,name,store_type").eq("store_type", "live_rip").order("name")).data ?? [],
  });
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [winnersId, setWinnersId] = useState<string | null>(null);
  const editing = editingId === "new" ? null : rows.find((r) => r.id === editingId) ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["own", "live_rips"] });

  const del = async (id: string) => {
    if (!confirm("למחוק את ה-Live Rip?")) return;
    const { error } = await supabase.from("live_rips").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("נמחק");
      invalidate();
    }
  };

  const close = async (id: string) => {
    if (!confirm("לסגור את ה-Live Rip ולשלוח התראה למשתתפים?")) return;
    const { error } = await supabase.rpc("close_live_rip", { _rip_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success("נסגר — המשתתפים קיבלו התראה");
      invalidate();
    }
  };

  const setVideo = async (r: Row) => {
    const url = prompt("קישור לסרטון היוטיוב של הפתיחה:", r.youtube_url ?? "");
    if (url === null) return;
    const { error } = await supabase.from("live_rips").update({ youtube_url: url || null }).eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("נשמר");
      invalidate();
    }
  };

  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">📦 Live Rip ({rows.length})</h2>
        <button onClick={() => setEditingId("new")} className="btn-plastic text-xs">+ חדש</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="chrome-panel flex items-center gap-3 p-3">
            {r.image_url ? (
              <img src={r.image_url} alt="" className="h-14 w-14 rounded object-contain" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded bg-muted text-2xl">📦</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                💎 {r.price_credits} לכניסה · {r.total_slots} מקומות · עד {r.max_slots_per_user} לשחקן ·{" "}
                {r.closed_at ? "סגור" : r.active ? "פעיל" : "כבוי"}
              </div>
              <div className="text-[11px] text-muted-foreground">פתיחה: {new Date(r.scheduled_at).toLocaleString("he-IL")}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditingId(r.id)} className="chrome-panel px-2 py-1 text-xs">ערוך</button>
              <button onClick={() => setWinnersId(r.id)} className="chrome-panel px-2 py-1 text-xs">משתתפים</button>
              {!r.closed_at && (
                <button onClick={() => close(r.id)} className="chrome-panel px-2 py-1 text-xs">סגור</button>
              )}
              <button onClick={() => setVideo(r)} className="chrome-panel px-2 py-1 text-xs">🎬 סרטון</button>
              <button onClick={() => del(r.id)} className="chrome-panel px-2 py-1 text-xs">🗑️</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">אין אירועי Live Rip עדיין.</div>}
      </div>
      {editingId && (
        <LiveRipEditor
          row={editing}
          stores={stores as Array<{ id: string; name: string }>}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            invalidate();
          }}
        />
      )}
      {winnersId && <ParticipantsModal ripId={winnersId} onClose={() => setWinnersId(null)} />}
    </div>
  );
}

function ParticipantsModal({ ripId, onClose }: { ripId: string; onClose: () => void }) {
  const { data: slots = [] } = useQuery({
    queryKey: ["live-rip-slots", ripId],
    queryFn: async () =>
      ((
        await supabase
          .from("live_rip_slots")
          .select("id,user_id,slot_number,credits_paid,order_id,created_at")
          .eq("rip_id", ripId)
          .order("slot_number")
      ).data ?? []) as Array<{ id: string; user_id: string; slot_number: number; credits_paid: number; order_id: string | null }>,
  });

  const { data: names = {} } = useQuery({
    queryKey: ["live-rip-names", ripId, slots.length],
    enabled: slots.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(slots.map((s) => s.user_id)));
      const { data } = await supabase.rpc("get_public_profiles", { _ids: ids });
      const map: Record<string, string> = {};
      for (const p of (data ?? []) as Array<{ id: string; username: string; display_name: string | null }>)
        map[p.id] = p.display_name || p.username;
      return map;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["live-rip-orders", ripId, slots.length],
    enabled: slots.some((s) => s.order_id),
    queryFn: async () => {
      const ids = slots.map((s) => s.order_id).filter(Boolean) as string[];
      return ((await supabase.from("orders").select("id,fulfillment_status,shipping_method,delivery_address,order_number").in("id", ids)).data ??
        []) as Array<{ id: string; fulfillment_status: string; shipping_method: string | null; delivery_address: string | null; order_number: number }>;
    },
  });
  const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">🎟️ משתתפים ({slots.length})</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>
        <div className="space-y-1 text-xs">
          {slots.map((s) => {
            const o = s.order_id ? orderById[s.order_id] : undefined;
            return (
              <div key={s.id} className="chrome-panel flex flex-wrap items-center gap-2 p-2">
                <span className="font-black">#{s.slot_number}</span>
                <span className="font-bold">{names[s.user_id] ?? "שחקן"}</span>
                <span className="text-muted-foreground">💎 {s.credits_paid}</span>
                {o && (
                  <>
                    <span className="text-muted-foreground">הזמנה #{o.order_number}</span>
                    <span className="font-semibold">
                      {o.shipping_method === "shipping"
                        ? `משלוח: ${o.delivery_address ?? "—"}`
                        : o.shipping_method === "pickup"
                          ? "איסוף עצמי"
                          : "עדיין לא בחר"}
                    </span>
                    <span className="text-muted-foreground">({o.fulfillment_status})</span>
                  </>
                )}
              </div>
            );
          })}
          {slots.length === 0 && <div className="text-muted-foreground">אין משתתפים עדיין.</div>}
        </div>
      </div>
    </div>
  );
}

function LiveRipEditor({
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
        name: "Live Rip חדש",
        description: "",
        image_url: null,
        store_id: null,
        product_id: null,
        scheduled_at: new Date().toISOString(),
        total_slots: 10,
        price_credits: 100,
        max_slots_per_user: 1,
        status: "scheduled",
        youtube_url: null,
        closed_at: null,
        active: true,
      },
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["live-rip-picker-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,sku,image_url,stock,unlimited_stock").eq("active", true).limit(50);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      return (await q).data ?? [];
    },
  });

  const save = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      image_url: form.image_url,
      store_id: form.store_id || null,
      product_id: form.product_id || null,
      scheduled_at: form.scheduled_at,
      total_slots: Math.max(1, Number(form.total_slots) || 1),
      price_credits: Math.max(0, Number(form.price_credits) || 0),
      max_slots_per_user: Math.max(1, Number(form.max_slots_per_user) || 1),
      youtube_url: form.youtube_url || null,
      active: form.active,
    };
    const res = row?.id
      ? await supabase.from("live_rips").update(payload).eq("id", row.id)
      : await supabase.from("live_rips").insert(payload);
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
          <h3 className="text-lg font-bold">📦 עורך Live Rip</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <span className="font-semibold">שם האירוע</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">חנות משוייכת (סוג "live_rip")</span>
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
            <span className="font-semibold">תיאור</span>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">מספר מקומות (חפיסות)</span>
            <input
              type="number"
              value={form.total_slots}
              onChange={(e) => setForm((f) => ({ ...f, total_slots: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">מחיר לכניסה (💎)</span>
            <input
              type="number"
              value={form.price_credits}
              onChange={(e) => setForm((f) => ({ ...f, price_credits: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">מקסימום כניסות לשחקן</span>
            <input
              type="number"
              value={form.max_slots_per_user}
              onChange={(e) => setForm((f) => ({ ...f, max_slots_per_user: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="font-semibold">שעת פתיחה</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.scheduled_at)}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: new Date(e.target.value).toISOString() }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1"
            />
          </label>
          <label className="text-xs md:col-span-2">
            <span className="font-semibold">קישור סרטון יוטיוב (לאחר הסגירה)</span>
            <input
              value={form.youtube_url ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))}
              placeholder="https://youtube.com/watch?v=…"
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
            <div className="mb-1 text-xs font-semibold">תמונת האירוע</div>
            <ImageUpload value={form.image_url ?? ""} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">המוצר שכל מקום מקבל</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש מוצר…"
                className="rounded-xl border-2 border-border bg-input px-3 py-1 text-xs"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border-2 border-border p-2">
              {products.map((p) => {
                const prod = p as { id: string; name: string; image_url: string | null; stock: number | null; unlimited_stock: boolean };
                return (
                  <label key={prod.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted">
                    <input
                      type="radio"
                      name="live-rip-product"
                      checked={form.product_id === prod.id}
                      onChange={() => setForm((f) => ({ ...f, product_id: prod.id }))}
                    />
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
