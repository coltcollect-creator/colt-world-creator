import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner")({
  ssr: false,
  beforeLoad: async () => {
    let { data: userData } = await supabase.auth.getUser();
    let currentUser = userData?.user;
    if (!currentUser && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("colt_auth_session_v1");
        if (raw) currentUser = JSON.parse(raw);
      } catch {}
    }
    if (!currentUser) throw redirect({ to: "/auth" });
    const [{ data: roles }, { data: admin }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
      supabase.from("admins").select("id").eq("user_id", currentUser.id).maybeSingle(),
    ]);
    const isOwner =
      (roles ?? []).some((r) => r.role === "owner" || r.role === "admin") ||
      !!admin ||
      currentUser.email?.toLowerCase() === "coltcollect@gmail.com" ||
      currentUser.email?.toLowerCase() === "astratego@colt.market";
    if (!isOwner) throw redirect({ to: "/play" });
  },
  component: () => <Outlet />,
});
