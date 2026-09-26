import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quests")({
  component: Quests,
  head: () => ({
    meta: [
      { title: "משימות ורמזים | COLT Market World" },
      { name: "description", content: "עקבו אחרי המשימות היומיות, אספו פרסים וראו אילו רמזים אספתם לכל תיבת אוצר." },
      { property: "og:title", content: "משימות ורמזים | COLT Market World" },
      { property: "og:description", content: "משימות יומיות, שבועיות ורמזים לתיבות האוצר — הכל במקום אחד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function periodKey(quest_type: string) {
  const d = new Date();
  if (quest_type === "daily") return d.toISOString().slice(0, 10);
  if (quest_type === "weekly") {
    const start = new Date(d); start.setDate(d.getDate() - d.getDay());
    return start.toISOString().slice(0, 10) + "-w";
  }
  return "once";
}

type ClueRow = { id: string; name: string; body: string | null; image_url: string | null; step_order: number };
type ClueProgress = {
  box_id: string;
  box_name: string;
  box_type: string;
  box_image: string | null;
  clues_total: number;
  clues_owned: number;
  opened: boolean;
  owned_clues: ClueRow[];
};

function Quests() {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const { data: quests = [] } = useQuery({
    queryKey: ["quests"],
    queryFn: async () => (await supabase.from("quests").select("*").eq("active", true).order("sort_order")).data ?? [],
  });
  const { data: progress = [] } = useQuery({
    queryKey: ["my-quests", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("player_quests").select("*").eq("user_id", user!.id)).data ?? [],
  });
  const { data: clueProgress = [] } = useQuery({
    queryKey: ["clue-progress", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_clue_progress");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as ClueProgress[];
    },
  });
  const progMap = new Map((Array.isArray(progress) ? progress : []).map((p) => [p.quest_id + ":" + (p.period_key ?? "once"), p]));

  const claim = useMutation({
    mutationFn: async ({ id, key }: { id: string; key: string }) => {
      const { error } = await supabase.rpc("claim_quest_reward", { _quest_id: id, _period_key: key });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("הפרס נאסף!"); refreshProfile(); qc.invalidateQueries({ queryKey: ["my-quests"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const byType = new Map<string, ClueProgress[]>();
  const cluesList = Array.isArray(clueProgress) ? clueProgress : [];
  for (const c of cluesList) {
    const list = byType.get(c.box_type) ?? [];
    list.push(c);
    byType.set(c.box_type, list);
  }

  return (
    <div className="space-y-3">
      <div data-tour="quests" className="chrome-panel p-4">
        <h1 className="mb-3 text-xl font-bold">מרכז המשימות</h1>
        <div className="grid gap-2">
          {quests.map((q) => {
            const key = periodKey(q.quest_type);
            const p = progMap.get(q.id + ":" + key);
            const prog = p?.progress ?? 0;
            const done = prog >= q.target_amount;
            const claimed = !!p?.claimed_at;
            return (
              <div key={q.id} className="chrome-panel flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">{q.name} <span className="rounded bg-muted px-2 py-0.5 text-xs">{q.quest_type}</span></div>
                  <div className="text-xs text-muted-foreground">{q.description}</div>
                  <div className="text-xs">התקדמות: {prog}/{q.target_amount} · פרס: 💎 {q.credit_reward} · {q.xp_reward} XP</div>
                </div>
                <button
                  className="btn-plastic text-xs"
                  disabled={!done || claimed || claim.isPending}
                  onClick={() => claim.mutate({ id: q.id, key })}
                >{claimed ? "נאסף" : done ? "איסוף פרס" : "בתהליך"}</button>
              </div>
            );
          })}
          {quests.length === 0 && <div className="text-sm text-muted-foreground">אין משימות פעילות כרגע.</div>}
        </div>
      </div>

      <div data-tour="clues" className="chrome-panel p-4">
        <h2 className="text-lg font-bold">🧩 הרמזים שלי</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          כאן רואים אילו רמזים אספתם לכל תיבת אוצר וכמה עוד חסר — בלי לחשוף את המיקום.
        </p>

        {clueProgress.length === 0 && (
          <div className="text-sm text-muted-foreground">עוד לא אספתם רמזים. חפשו אותם בחנויות, בגלגל המזל ובתיבות המסתורין.</div>
        )}

        <div className="space-y-4">
          {Array.from(byType.entries()).map(([type, boxes]) => (
            <div key={type}>
              <div className="mb-2 text-sm font-black text-primary">קטגוריה: {type}</div>
              <div className="grid gap-2 md:grid-cols-2">
                {boxes.map((b) => {
                  const pct = b.clues_total ? Math.round((b.clues_owned / b.clues_total) * 100) : 0;
                  return (
                    <div key={b.box_id} className="chrome-panel p-3">
                      <div className="flex items-center gap-2">
                        {b.box_image
                          ? <img src={b.box_image} alt={b.box_name} loading="lazy" className="h-10 w-10 object-contain" />
                          : <span className="text-2xl">🧰</span>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold">{b.box_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.clues_owned}/{b.clues_total} רמזים {b.opened && "· נפתחה ✅"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 space-y-1">
                        {(b.owned_clues ?? []).map((c) => (
                          <details key={c.id} className="rounded-xl bg-muted/50 px-2 py-1 text-xs">
                            <summary className="cursor-pointer font-bold">רמז {c.step_order}: {c.name}</summary>
                            {c.image_url && <img src={c.image_url} alt={c.name} loading="lazy" className="mt-1 max-h-40 w-auto object-contain" />}
                            {c.body && <p className="mt-1 text-muted-foreground">{c.body}</p>}
                          </details>
                        ))}
                        {(b.owned_clues ?? []).length === 0 && (
                          <div className="text-xs text-muted-foreground">אין רמזים שנאספו לתיבה הזו.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
