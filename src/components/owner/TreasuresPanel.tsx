import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/owner/ImageUpload";

export type BoxReward = {
  type: "credits" | "xp" | "product" | "cosmetic" | "wheel_spin" | "clue";
  amount?: number;
  product_id?: string;
  cosmetic_id?: string;
  wheel_id?: string;
  clue_id?: string;
  label?: string;
};

type BoxRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  box_type: string;
  reward: BoxReward | null;
  require_mode: "all" | "any";
  required_level: number | null;
  required_role_id: string | null;
  required_character_id: string | null;
  require_all_clues: boolean;
  one_per_player: boolean;
  active: boolean;
};

const input = "mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1";

export function TreasuresPanel() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["own", "treasure_boxes"],
    queryFn: async () => ((await supabase.from("treasure_boxes").select("*").order("created_at")).data ?? []) as unknown as BoxRow[],
  });
  const { data: clueCounts = {} } = useQuery({
    queryKey: ["own", "clue-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("clues").select("box_id");
      const map: Record<string, number> = {};
      for (const c of (data ?? []) as Array<{ box_id: string | null }>) {
        if (c.box_id) map[c.box_id] = (map[c.box_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const editing = editingId === "new" ? null : rows.find((r) => r.id === editingId) ?? null;

  const del = async (id: string) => {
    if (!confirm("למחוק את התיבה? הרמזים המשוייכים יימחקו גם.")) return;
    const { error } = await supabase.from("treasure_boxes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("נמחק"); qc.invalidateQueries({ queryKey: ["own", "treasure_boxes"] }); }
  };

  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🧰 תיבות אוצר ({rows.length})</h2>
        <button onClick={() => setEditingId("new")} className="btn-plastic text-xs">+ תיבה חדשה</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        התיבות ממוקמות במפה בעורך המפות (כלי ״🧰 תיבת אוצר״). כאן קובעים מה יש בפנים ומה תנאי התצוגה.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="chrome-panel flex items-center gap-3 p-3">
            {r.image_url
              ? <img src={r.image_url} alt="" className="h-14 w-14 rounded object-contain" />
              : <div className="grid h-14 w-14 place-items-center rounded bg-muted text-2xl">🧰</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.box_type} · פרס: {r.reward?.type ?? "—"} · רמזים: {clueCounts[r.id] ?? 0}
                {r.required_level ? ` · רמה ${r.required_level}+` : ""} {r.active ? "· פעיל" : "· כבוי"}
              </div>
            </div>
            <button onClick={() => setEditingId(r.id)} className="chrome-panel px-2 py-1 text-xs">ערוך</button>
            <button onClick={() => del(r.id)} className="chrome-panel px-2 py-1 text-xs">🗑️</button>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded bg-muted p-3 text-xs text-muted-foreground">אין תיבות עדיין.</div>}
      </div>

      {editingId && (
        <BoxEditor
          row={editing}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["own", "treasure_boxes"] }); }}
        />
      )}
    </div>
  );
}

function BoxEditor({ row, onClose, onSaved }: { row: BoxRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BoxRow>(() => row ?? {
    id: "", name: "תיבת אוצר", description: "", image_url: null, box_type: "כללי",
    reward: { type: "credits", amount: 100 },
    require_mode: "all", required_level: null, required_role_id: null, required_character_id: null,
    require_all_clues: true, one_per_player: true, active: true,
  });
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["tb-products"],
    queryFn: async () => (await supabase.from("products").select("id,name").eq("active", true).order("name")).data ?? [],
  });
  const { data: cosmetics = [] } = useQuery({
    queryKey: ["tb-cosmetics"],
    queryFn: async () => (await supabase.from("cosmetics").select("id,name").eq("active", true).order("name")).data ?? [],
  });
  const { data: wheels = [] } = useQuery({
    queryKey: ["tb-wheels"],
    queryFn: async () => (await supabase.from("wheel_configs").select("id,name").eq("active", true).order("name")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["tb-roles"],
    queryFn: async () => (await supabase.from("character_roles").select("id,name").eq("active", true).order("display_order")).data ?? [],
  });
  const { data: characters = [] } = useQuery({
    queryKey: ["tb-characters"],
    queryFn: async () => (await supabase.from("characters").select("id,name").eq("active", true).order("display_order")).data ?? [],
  });
  const { data: clues = [] } = useQuery({
    queryKey: ["tb-clues"],
    queryFn: async () => (await supabase.from("clues").select("id,name").eq("active", true).order("name")).data ?? [],
  });

  const reward = form.reward ?? { type: "credits", amount: 0 };
  const setReward = (patch: Partial<BoxReward>) => setForm((f) => ({ ...f, reward: { ...(f.reward ?? { type: "credits" }), ...patch } as BoxReward }));

  const save = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      image_url: form.image_url,
      box_type: form.box_type || "כללי",
      reward: reward as unknown as never,
      require_mode: form.require_mode,
      required_level: form.required_level == null || Number.isNaN(form.required_level) ? null : Number(form.required_level),
      required_role_id: form.required_role_id || null,
      required_character_id: form.required_character_id || null,
      require_all_clues: form.require_all_clues,
      one_per_player: form.one_per_player,
      active: form.active,
    };
    const res = row?.id
      ? await supabase.from("treasure_boxes").update(payload).eq("id", row.id)
      : await supabase.from("treasure_boxes").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("נשמר"); onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">🧰 עורך תיבת אוצר</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs"><span className="font-semibold">שם</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} />
          </label>
          <label className="text-xs"><span className="font-semibold">סוג/קטגוריה (לסידור בלשונית משימות)</span>
            <input value={form.box_type} onChange={(e) => setForm((f) => ({ ...f, box_type: e.target.value }))} className={input} />
          </label>
          <label className="text-xs md:col-span-2"><span className="font-semibold">תיאור</span>
            <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={input} />
          </label>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold">תמונת תיבה</div>
            <ImageUpload value={form.image_url} folder="treasures" onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          </div>

          <div className="chrome-panel md:col-span-2 space-y-2 p-3">
            <div className="text-xs font-bold">🎁 מה יש בתיבה</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select value={reward.type} onChange={(e) => setReward({ type: e.target.value as BoxReward["type"], product_id: undefined, cosmetic_id: undefined, wheel_id: undefined, clue_id: undefined })} className="rounded border-2 border-border bg-input px-2 py-1">
                <option value="credits">💎 יהלומים</option>
                <option value="xp">⭐ XP</option>
                <option value="product">📦 מוצר מהמלאי</option>
                <option value="cosmetic">👕 קוסמטיקה</option>
                <option value="wheel_spin">🎡 סיבוב בגלגל</option>
                <option value="clue">🧩 רמז</option>
              </select>
              {(reward.type === "credits" || reward.type === "xp") && (
                <label className="flex items-center gap-1">כמות
                  <input type="number" value={reward.amount ?? 0} onChange={(e) => setReward({ amount: Number(e.target.value) })} className="w-24 rounded border-2 border-border bg-input px-2 py-1" />
                </label>
              )}
              {reward.type === "product" && (
                <select value={reward.product_id ?? ""} onChange={(e) => setReward({ product_id: e.target.value })} className="flex-1 rounded border-2 border-border bg-input px-2 py-1">
                  <option value="">— בחרו מוצר —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {reward.type === "cosmetic" && (
                <select value={reward.cosmetic_id ?? ""} onChange={(e) => setReward({ cosmetic_id: e.target.value })} className="flex-1 rounded border-2 border-border bg-input px-2 py-1">
                  <option value="">— בחרו קוסמטיקה —</option>
                  {cosmetics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {reward.type === "wheel_spin" && (
                <select value={reward.wheel_id ?? ""} onChange={(e) => setReward({ wheel_id: e.target.value })} className="flex-1 rounded border-2 border-border bg-input px-2 py-1">
                  <option value="">— בחרו גלגל —</option>
                  {wheels.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
              {reward.type === "clue" && (
                <select value={reward.clue_id ?? ""} onChange={(e) => setReward({ clue_id: e.target.value })} className="flex-1 rounded border-2 border-border bg-input px-2 py-1">
                  <option value="">— בחרו רמז —</option>
                  {clues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="chrome-panel md:col-span-2 space-y-2 p-3">
            <div className="text-xs font-bold">🔒 תנאי תצוגה</div>
            <label className="block text-xs">אופן החישוב
              <select value={form.require_mode} onChange={(e) => setForm((f) => ({ ...f, require_mode: e.target.value as "all" | "any" }))} className={input}>
                <option value="all">כל התנאים שסומנו (וגם וגם)</option>
                <option value="any">מספיק תנאי אחד</option>
              </select>
            </label>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="text-xs">רמת שחקן מינימלית
                <input type="number" value={form.required_level ?? ""} placeholder="ללא" onChange={(e) => setForm((f) => ({ ...f, required_level: e.target.value === "" ? null : Number(e.target.value) }))} className={input} />
              </label>
              <label className="text-xs">סוג דמות (תפקיד)
                <select value={form.required_role_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, required_role_id: e.target.value || null }))} className={input}>
                  <option value="">ללא</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="text-xs">דמות מסוימת
                <select value={form.required_character_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, required_character_id: e.target.value || null }))} className={input}>
                  <option value="">ללא</option>
                  {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.require_all_clues} onChange={(e) => setForm((f) => ({ ...f, require_all_clues: e.target.checked }))} /><span className="font-semibold">דרוש את כל הרמזים של התיבה</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.one_per_player} onChange={(e) => setForm((f) => ({ ...f, one_per_player: e.target.checked }))} /><span className="font-semibold">פעם אחת לשחקן</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /><span className="font-semibold">פעיל</span></label>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="chrome-panel px-4 py-1 text-xs">ביטול</button>
          <button onClick={save} disabled={saving} className="btn-plastic text-xs">{saving ? "שומר…" : "שמירה"}</button>
        </div>
      </div>
    </div>
  );
}

// ============================ clues ============================

type ClueRow = {
  id: string;
  box_id: string | null;
  name: string;
  step_order: number;
  body: string | null;
  image_url: string | null;
  price_credits: number;
  available_in_wheel: boolean;
  store_id: string | null;
  active: boolean;
};

export function CluesPanel() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["own", "clues"],
    queryFn: async () => ((await supabase.from("clues").select("*").order("step_order")).data ?? []) as unknown as ClueRow[],
  });
  const { data: boxes = [] } = useQuery({
    queryKey: ["own", "boxes-min"],
    queryFn: async () => (await supabase.from("treasure_boxes").select("id,name").order("name")).data ?? [],
  });
  const { data: stores = [] } = useQuery({
    queryKey: ["own", "stores-min"],
    queryFn: async () => (await supabase.from("stores").select("id,name").eq("active", true).order("name")).data ?? [],
  });

  const editing = editingId === "new" ? null : rows.find((r) => r.id === editingId) ?? null;

  const del = async (id: string) => {
    if (!confirm("למחוק את הרמז?")) return;
    const { error } = await supabase.from("clues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("נמחק"); qc.invalidateQueries({ queryKey: ["own", "clues"] }); }
  };

  const byBox = new Map<string, ClueRow[]>();
  for (const r of rows) {
    const key = r.box_id ?? "none";
    byBox.set(key, [...(byBox.get(key) ?? []), r]);
  }

  return (
    <div className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🧩 רמזים ({rows.length})</h2>
        <button onClick={() => setEditingId("new")} className="btn-plastic text-xs">+ רמז חדש</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        כל רמז מקושר לתיבת אוצר. בנו שרשרת רמזים (סדר שלב 1,2,3…) שהאחרון בה מגלה את מיקום התיבה.
      </p>

      <div className="space-y-3">
        {[...byBox.entries()].map(([boxId, list]) => (
          <div key={boxId} className="chrome-panel p-3">
            <div className="mb-2 text-xs font-bold">
              🧰 {boxId === "none" ? "ללא תיבה" : (boxes.find((b) => b.id === boxId)?.name ?? boxId)}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {list.sort((a, b) => a.step_order - b.step_order).map((r) => (
                <div key={r.id} className="chrome-panel flex items-center gap-2 p-2">
                  {r.image_url
                    ? <img src={r.image_url} alt="" className="h-10 w-10 rounded object-contain" />
                    : <div className="grid h-10 w-10 place-items-center rounded bg-muted">🧩</div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">#{r.step_order} {r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      💎 {r.price_credits} {r.available_in_wheel ? "· בגלגל" : ""}
                      {r.store_id ? ` · חנות: ${stores.find((s) => s.id === r.store_id)?.name ?? ""}` : ""}
                      {r.active ? "" : " · כבוי"}
                    </div>
                  </div>
                  <button onClick={() => setEditingId(r.id)} className="chrome-panel px-2 py-1 text-xs">ערוך</button>
                  <button onClick={() => del(r.id)} className="chrome-panel px-2 py-1 text-xs">🗑️</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded bg-muted p-3 text-xs text-muted-foreground">אין רמזים עדיין.</div>}
      </div>

      {editingId && (
        <ClueEditor
          row={editing}
          boxes={boxes as Array<{ id: string; name: string }>}
          stores={stores as Array<{ id: string; name: string }>}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["own", "clues"] }); }}
        />
      )}
    </div>
  );
}

function ClueEditor({
  row, boxes, stores, onClose, onSaved,
}: {
  row: ClueRow | null;
  boxes: Array<{ id: string; name: string }>;
  stores: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClueRow>(() => row ?? {
    id: "", box_id: boxes[0]?.id ?? null, name: "רמז 1", step_order: 1,
    body: "", image_url: null, price_credits: 0, available_in_wheel: false,
    store_id: null, active: true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = {
      box_id: form.box_id || null,
      name: form.name,
      step_order: Number(form.step_order) || 1,
      body: form.body,
      image_url: form.image_url,
      price_credits: Number(form.price_credits) || 0,
      available_in_wheel: form.available_in_wheel,
      store_id: form.store_id || null,
      active: form.active,
    };
    const res = row?.id
      ? await supabase.from("clues").update(payload).eq("id", row.id)
      : await supabase.from("clues").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("נשמר"); onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="chrome-panel max-h-[90vh] w-full max-w-xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">🧩 עורך רמז</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1">✕</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs"><span className="font-semibold">שם הרמז</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} />
          </label>
          <label className="text-xs"><span className="font-semibold">סדר שלב</span>
            <input type="number" value={form.step_order} onChange={(e) => setForm((f) => ({ ...f, step_order: Number(e.target.value) }))} className={input} />
          </label>
          <label className="text-xs"><span className="font-semibold">תיבת אוצר מקושרת</span>
            <select value={form.box_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, box_id: e.target.value || null }))} className={input}>
              <option value="">— ללא —</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-xs"><span className="font-semibold">מחיר ביהלומים (0 = חינם)</span>
            <input type="number" value={form.price_credits} onChange={(e) => setForm((f) => ({ ...f, price_credits: Number(e.target.value) }))} className={input} />
          </label>
          <label className="text-xs md:col-span-2"><span className="font-semibold">מלל הרמז</span>
            <textarea value={form.body ?? ""} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={3} className={input} placeholder="לדוגמה: הרמז הבא מחכה ליד…" />
          </label>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold">תמונת רמז</div>
            <ImageUpload value={form.image_url} folder="clues" onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          </div>
          <label className="text-xs"><span className="font-semibold">נמכר בחנות</span>
            <select value={form.store_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value || null }))} className={input}>
              <option value="">— ללא —</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-4 pt-5 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.available_in_wheel} onChange={(e) => setForm((f) => ({ ...f, available_in_wheel: e.target.checked }))} /><span className="font-semibold">זמין כפרס בגלגל</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /><span className="font-semibold">פעיל</span></label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="chrome-panel px-4 py-1 text-xs">ביטול</button>
          <button onClick={save} disabled={saving} className="btn-plastic text-xs">{saving ? "שומר…" : "שמירה"}</button>
        </div>
      </div>
    </div>
  );
}
