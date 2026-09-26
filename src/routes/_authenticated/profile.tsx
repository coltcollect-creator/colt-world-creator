import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({ component: ProfilePage });

function ProfilePage() {
  const { profile, user } = useAuth();
  const { data: cos = [] } = useQuery({
    queryKey: ["my-cos", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("player_cosmetics").select("cosmetic_id, cosmetics(name, layer_type)").eq("user_id", user!.id)).data ?? [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("orders").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  if (!profile) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="chrome-panel p-6 lg:col-span-1">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary text-4xl text-primary-foreground">👤</div>
        <h1 className="mt-3 text-center text-2xl font-bold">{profile.username}</h1>
        <p className="text-center text-xs text-muted-foreground">Level {profile.level} · {profile.xp} XP</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-xl bg-muted p-2">💎 {profile.credits}</div>
          <div className="rounded-xl bg-muted p-2">🎨 {cos.length} items</div>
        </div>
      </div>
      <div className="chrome-panel p-6 lg:col-span-2">
        <h2 className="mb-2 font-bold">Recent orders</h2>
        <ul className="space-y-1 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex justify-between border-b border-border py-1">
              <span>{o.order_type}</span>
              <span className="text-muted-foreground">{o.status}</span>
            </li>
          ))}
          {!orders.length && <li className="text-xs text-muted-foreground">No orders yet.</li>}
        </ul>
      </div>
    </div>
  );
}
