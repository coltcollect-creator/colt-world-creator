import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

type BoxState = {
  ok: boolean;
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  box_type: string;
  clues_total: number;
  clues_owned: number;
  require_mode: "all" | "any";
  require_all_clues: boolean;
  required_level: number | null;
  ok_level: boolean;
  ok_role: boolean;
  ok_character: boolean;
  ok_clues: boolean;
  visible: boolean;
  opened: boolean;
  one_per_player: boolean;
};

/** Player-facing treasure box: shows requirements progress and opens the box. */
export function TreasureView({ boxId, onClose }: { boxId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { refreshProfile } = useAuth();
  const [opening, setOpening] = useState(false);
  const [prize, setPrize] = useState<Record<string, unknown> | null>(null);

  const { data: state, isLoading } = useQuery({
    queryKey: ["treasure-state", boxId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_treasure_box_state", { _box_id: boxId });
      if (error) throw error;
      return data as unknown as BoxState;
    },
  });

  const open = async () => {
    setOpening(true);
    const { data, error } = await supabase.rpc("open_treasure_box", { _box_id: boxId });
    setOpening(false);
    if (error) { toast.error(error.message); return; }
    const res = data as unknown as { ok?: boolean; reward?: Record<string, unknown> };
    setPrize(res?.reward ?? {});
    toast.success("התיבה נפתחה! 🎉");
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["treasure-state", boxId] });
    qc.invalidateQueries({ queryKey: ["clue-progress"] });
    qc.invalidateQueries({ queryKey: ["inv"] });
    qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  const rewardLabel = (r: Record<string, unknown> | null) => {
    if (!r) return "";
    const type = String(r.type ?? "");
    if (type === "credits") return `💎 ${r.amount ?? 0} יהלומים`;
    if (type === "xp") return `⭐ ${r.amount ?? 0} XP`;
    if (type === "wheel_spin") return "🎡 סיבוב חינם בגלגל";
    if (type === "clue") return `🧩 רמז חדש: ${r.name ?? ""}`;
    return `🎁 ${r.name ?? "פרס"}`;
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="chrome-panel w-full max-w-lg overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 p-5">
          <button onClick={onClose} className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white shadow">✕</button>
          <div className="text-xs font-bold text-amber-700">🧰 תיבת אוצר</div>
          <h2 className="text-2xl font-black">{state?.name ?? "תיבת אוצר"}</h2>
          {state?.box_type && <div className="mt-1 text-xs font-bold text-amber-800">קטגוריה: {state.box_type}</div>}
        </div>

        <div className="space-y-3 p-5 text-sm">
          {isLoading && <div className="text-muted-foreground">טוען…</div>}

          {state && (
            <>
              {state.image_url && (
                <img src={state.image_url} alt={state.name} className="mx-auto max-h-40 w-auto object-contain" loading="lazy" />
              )}
              {state.description && <p className="text-muted-foreground">{state.description}</p>}

              <div className="chrome-panel space-y-1 p-3 text-xs">
                <div className="font-bold">תנאי פתיחה ({state.require_mode === "any" ? "מספיק אחד מהם" : "כולם נדרשים"})</div>
                {state.required_level != null && (
                  <div>{state.ok_level ? "✅" : "🔒"} רמה {state.required_level} ומעלה</div>
                )}
                {state.require_all_clues && (
                  <div>
                    {state.ok_clues ? "✅" : "🔒"} רמזים שנאספו: {state.clues_owned}/{state.clues_total}
                  </div>
                )}
                <div>{state.ok_role ? "✅" : "🔒"} סוג דמות מתאים</div>
                <div>{state.ok_character ? "✅" : "🔒"} דמות מתאימה</div>
              </div>

              {prize ? (
                <div className="chrome-panel bg-gradient-to-br from-emerald-100 to-lime-100 p-4 text-center">
                  <div className="text-3xl">🎉</div>
                  <div className="mt-1 font-black">{rewardLabel(prize)}</div>
                  {typeof prize.body === "string" && prize.body && (
                    <p className="mt-2 text-xs text-muted-foreground">{prize.body}</p>
                  )}
                </div>
              ) : state.opened && state.one_per_player ? (
                <div className="chrome-panel p-3 text-center text-xs font-bold">כבר פתחתם את התיבה הזו 💫</div>
              ) : state.visible ? (
                <button onClick={open} disabled={opening} className="btn-plastic w-full">
                  {opening ? "פותח…" : "🔓 פתחו את התיבה"}
                </button>
              ) : (
                <div className="chrome-panel p-3 text-center text-xs">
                  התיבה נעולה — השלימו את התנאים שלמעלה כדי לפתוח אותה.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
