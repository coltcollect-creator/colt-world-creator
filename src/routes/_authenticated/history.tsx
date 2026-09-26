import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/history")({ component: History });

function History() {
  const { user } = useAuth();
  const { data: tx = [] } = useQuery({
    queryKey: ["ct", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("credit_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  return (
    <div className="chrome-panel p-6">
      <h1 className="mb-3 text-xl font-bold">Credit history</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th><th>Description</th></tr>
        </thead>
        <tbody>
          {tx.map((t) => (
            <tr key={t.id} className="border-t border-border">
              <td className="py-1">{new Date(t.created_at).toLocaleString()}</td>
              <td>{t.transaction_type}</td>
              <td className={t.amount >= 0 ? "text-emerald-600" : "text-destructive"}>{t.amount >= 0 ? "+" : ""}{t.amount}</td>
              <td>{t.balance_after}</td>
              <td className="text-xs text-muted-foreground">{t.description}</td>
            </tr>
          ))}
          {!tx.length && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No transactions.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
