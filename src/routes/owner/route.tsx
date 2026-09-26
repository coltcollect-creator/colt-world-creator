import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const [{ data: roles }, { data: admin }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
      supabase.from("admins").select("id").eq("user_id", userData.user.id).maybeSingle(),
    ]);
    const isOwner = (roles ?? []).some((r) => r.role === "owner") || !!admin;
    if (!isOwner) throw redirect({ to: "/play" });
  },
  component: () => <Outlet />,
});
