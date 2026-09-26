import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { RewardsEditor, type Reward } from "@/components/owner/RewardsEditor";

type Row = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_credits: number;
  active: boolean;
  stock: number | null;
  unlimited_stock: boolean;
  store_id: string | null;
  rewards: Reward[] | null;
};

export function MysteryPanel() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["own", "mystery_boxes"],
    queryFn: async () => (await supabase.from("mystery_boxes").select("*").order("created_at")).data as unknown as Row[] ?? [],
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-mystery"],
    queryFn: async () => (await supabase.from("stores").select("id,name,store_type").eq("store_type", "mystery_box").order("name")).data ?? [],
  });
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const editing = editingId === "new" ? null : rows.find((r) => r.id === editingId) ?? null;

  const del = async (id: string) => {
    if (!confirm("למחוק?")) return;
    const { error } = await supabase.from("mystery_boxes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["own", "mystery_boxes"] }); }
  };

  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🎁 קופסאות מסתורין ({rows.length})</h2>
        <button onClick={() => setEditingId("new")} className="btn-plastic text-xs">+ חדש</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="chrome-panel flex items-center gap-3 p-3">
            {r.image_url ? <img src={r.image_url} alt="" className="h-14 w-14 rounded object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded bg-muted text-2xl">🎁</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">💎 {r.price_credits} · {(r.rewards ?? []).length} פרסים · {r.unlimited_stock ? "מלאי ∞" : `מלאי ${r.stock ?? 0}`} {r.active ? "· פעיל" : "· כבוי"}</div>
            </div>
            <button onClick={() => setEditingId(r.id)} className="chrome-panel px-2 py-1 text-xs">ערוך</button>
            <button onClick={() => del(r.id)} className="chrome-panel px-2 py-1 text-xs">🗑️</button>
          </div>
        ))}
      </div>
      {editingId && (
        <MysteryEditor
          row={editing}
          stores={stores as Array<{ id: string; name: string }>}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["own", "mystery_boxes"] }); }}
        />
      )}
    </div>
  );
}

function MysteryEditor({ row, stores, onClose, onSaved }: { row: Row | null; stores: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Row>(() => row ?? {
    id: "", name: "Mystery Box", description: "", image_url: null,
    price_credits: 100, active: true, stock: null, unlimited_stock: true,
    store_id: null, rewards: [],
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const payload = {
      name: form.name, description: form.description, image_url: form.image_url,
      price_credits: Number(form.price_credits) || 0,
      active: form.active, store_id: form.store_id || null,
      stock: form.unlimited_stock ? null : (Number(form.stock) || 0),
      unlimited_stock: form.unlimited_stock,
      rewards: (form.rewards ?? []) as unknown as never,
    };
    const res = row?.id
      ? await supabase.from("mystery_boxes").update(payload).eq("id", row.id)
      : await supabase.from("mystery_boxes").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("נשמר"); onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">🎁 עורך קופסת מסתורין</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs"><span className="font-semibold">שם</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
          </label>
          <label className="text-xs"><span className="font-semibold">מחיר חבילה (💎)</span>
            <input type="number" value={form.price_credits} onChange={(e) => setForm((f) => ({ ...f, price_credits: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
          </label>
          <label className="text-xs md:col-span-2"><span className="font-semibold">תיאור</span>
            <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
          </label>
          <label className="text-xs"><span className="font-semibold">חנות משוייכת (סוג "mystery_box")</span>
            <select value={form.store_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1">
              <option value="">— ללא —</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="text-xs flex items-center gap-3 pt-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /><span className="font-semibold">פעיל</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.unlimited_stock} onChange={(e) => setForm((f) => ({ ...f, unlimited_stock: e.target.checked }))} /><span className="font-semibold">מלאי לא מוגבל</span></label>
          </div>
          {!form.unlimited_stock && (
            <label className="text-xs"><span className="font-semibold">מלאי</span>
              <input type="number" value={form.stock ?? 0} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1" />
            </label>
          )}
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold">תמונת חבילה</div>
            <ImageUpload value={form.image_url} folder="mystery" onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-semibold">🎁 פרסים אפשריים ויחסים</div>
            <p className="mb-2 text-[11px] text-muted-foreground">כל פתיחה בוחרת פרס באופן רנדומלי לפי היחסים. שינוי של אחד מעדכן את השאר.</p>
            <RewardsEditor value={form.rewards ?? []} onChange={(v) => setForm((f) => ({ ...f, rewards: v }))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="chrome-panel px-4 py-2 text-sm">ביטול</button>
          <button onClick={save} disabled={saving} className="btn-plastic">{saving ? "…" : "שמור"}</button>
        </div>
      </div>
    </div>
  );
}
