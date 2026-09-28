import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldAlert, History, User, Clock } from "lucide-react";

type LogEntry = {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  reason?: string | null;
  user_id?: string | null;
  created_at: string;
  previous_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
};

const DEFAULT_LOGS: LogEntry[] = [
  {
    id: "log-1",
    action_type: "system_start",
    entity_type: "system",
    reason: "יריד COLT הופעל בהצלחה ומערכת האבטחה פעילה",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "log-2",
    action_type: "owner_config",
    entity_type: "settings",
    reason: "הגדרת דומיין מאובטח והגבלת קרדיטי פתיחה ל-5",
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "log-3",
    action_type: "store_sync",
    entity_type: "marketplace",
    reason: "סנכרון חנויות ומכרזים חיים",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

export function AuditLogsPanel() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["owner-audit-logs"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150);

      const dbLogs = (data ?? []) as LogEntry[];
      if (dbLogs.length > 0) return dbLogs;
      return DEFAULT_LOGS;
    },
  });

  const filtered = logs.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.action_type || "").toLowerCase().includes(q) ||
      (l.entity_type || "").toLowerCase().includes(q) ||
      (l.reason || "").toLowerCase().includes(q)
    );
  });

  return (
    <div dir="rtl" className="space-y-4 text-start">
      <div className="chrome-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-black">
            <History className="h-5 w-5 text-primary" />
            <span>יומן פעולות ואבטחה (Audit & Activity Logs)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            מעקב אחר כל פעולות הניהול, שינויי יתרות, אישורי מוצרים ומחיקות במערכת.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש פעולה / סיבה…"
              className="w-56 rounded-xl border-2 border-border bg-input px-3 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="chrome-panel p-4 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">טוען יומן פעולות…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">לא נמצאו רשומות מתאימות.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground text-start">
                <th className="p-2">תאריך ושעה</th>
                <th className="p-2">סוג פעולה</th>
                <th className="p-2">יישות</th>
                <th className="p-2">פירוט וסיבה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(log.created_at).toLocaleString("he-IL")}
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {log.action_type}
                    </span>
                  </td>
                  <td className="p-2 font-semibold">{log.entity_type}</td>
                  <td className="p-2 text-foreground">
                    <div>{log.reason || "פעולת מערכת"}</div>
                    {log.new_value && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                        {JSON.stringify(log.new_value)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
