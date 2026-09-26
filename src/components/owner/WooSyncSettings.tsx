import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WooRules = {
  price_multiplier: number;
  rounding: "ceil" | "round" | "nearest10";
  default_store_id: string | null;
  extra_tags: string[];
  default_category: string | null;
  auto_deactivate_out_of_stock: boolean;
};

export const DEFAULT_WOO_RULES: WooRules = {
  price_multiplier: 10,
  rounding: "ceil",
  default_store_id: null,
  extra_tags: ["colt marketplace"],
  default_category: null,
  auto_deactivate_out_of_stock: true,
};

export function parseWooRules(extra: unknown): WooRules {
  const raw = (extra as Record<string, unknown> | null)?.["woo_rules"] as Partial<WooRules> | undefined;
  return { ...DEFAULT_WOO_RULES, ...(raw ?? {}) };
}

export function WooSyncSettings() {
  const qc = useQueryClient();
  const [rules, setRules] = useState<WooRules>(DEFAULT_WOO_RULES);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["game-settings-woo"],
    queryFn: async () => (await supabase.from("game_settings").select("id, extra").eq("id", 1).maybeSingle()).data,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["own", "stores"],
    queryFn: async () => (await supabase.from("stores").select("id, name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (settings) setRules(parseWooRules(settings.extra));
  }, [settings]);

  const save = async () => {
    setSaving(true);
    const extra = { ...((settings?.extra as Record<string, unknown> | null) ?? {}), woo_rules: rules };
    const { error } = await supabase.from("game_settings").update({ extra: extra as never }).eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("חוקי הסנכרון נשמרו");
    qc.invalidateQueries({ queryKey: ["game-settings-woo"] });
  };

  return (
    <div className="chrome-panel mb-4 p-4">
      <div className="mb-2 text-sm font-black">⚙️ חוקי סנכרון WooCommerce</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs">
          <span className="mb-1 block font-bold">מכפיל מחיר (יהלומים = מחיר בווקומרס × מכפיל)</span>
          <input
            type="number"
            min={0.01}
            step={0.5}
            value={rules.price_multiplier}
            onChange={(e) => setRules({ ...rules, price_multiplier: Number(e.target.value) || 1 })}
            className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
          />
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-bold">עיגול מחיר</span>
          <select
            value={rules.rounding}
            onChange={(e) => setRules({ ...rules, rounding: e.target.value as WooRules["rounding"] })}
            className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
          >
            <option value="ceil">מעלה (10.1 → 11)</option>
            <option value="round">לשלם הקרוב</option>
            <option value="nearest10">לעשרת הקרובה מעלה</option>
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-bold">חנות ברירת מחדל לשיוך</span>
          <select
            value={rules.default_store_id ?? ""}
            onChange={(e) => setRules({ ...rules, default_store_id: e.target.value || null })}
            className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
          >
            <option value="">— ללא —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-bold">תגיות שיתווספו (מופרד בפסיק)</span>
          <input
            value={rules.extra_tags.join(", ")}
            onChange={(e) =>
              setRules({ ...rules, extra_tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })
            }
            placeholder="colt marketplace"
            className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
          />
        </label>

        <label className="text-xs">
          <span className="mb-1 block font-bold">קטגוריה כברירת מחדל (אם אין בווקומרס)</span>
          <input
            value={rules.default_category ?? ""}
            onChange={(e) => setRules({ ...rules, default_category: e.target.value || null })}
            className="w-full rounded-xl border-2 border-border bg-input px-3 py-1"
          />
        </label>

        <label className="flex items-end gap-2 text-xs">
          <input
            type="checkbox"
            checked={rules.auto_deactivate_out_of_stock}
            onChange={(e) => setRules({ ...rules, auto_deactivate_out_of_stock: e.target.checked })}
            className="h-4 w-4"
          />
          <span className="font-bold">כבה מוצר אוטומטית כשהמלאי נגמר</span>
        </label>
      </div>

      <button onClick={save} disabled={saving} className="btn-plastic mt-3 text-xs disabled:opacity-50">
        {saving ? "…" : "💾 שמירת חוקים"}
      </button>
      <div className="mt-1 text-[11px] text-muted-foreground">
        החוקים חלים על כל ייבוא/סנכרון עתידי מווקומרס.
      </div>
    </div>
  );
}
