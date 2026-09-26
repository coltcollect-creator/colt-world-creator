import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BroadcastInput = {
  user_ids: string[];
  title: string;
  body: string;
  link?: string | null;
};

export const sendSystemMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: BroadcastInput) => {
    if (!Array.isArray(data?.user_ids) || data.user_ids.length === 0) throw new Error("בחר/י לפחות משתמש אחד");
    if (data.user_ids.length > 5000) throw new Error("too many recipients");
    const title = String(data.title ?? "").trim();
    const body = String(data.body ?? "").trim();
    if (!title) throw new Error("נדרשת כותרת");
    if (title.length > 120) throw new Error("כותרת ארוכה מדי");
    if (!body) throw new Error("נדרש תוכן הודעה");
    if (body.length > 2000) throw new Error("ההודעה ארוכה מדי");
    const link = data.link ? String(data.link).trim().slice(0, 300) : null;
    return { user_ids: data.user_ids.map(String), title, body, link };
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Forbidden: owner role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = data.user_ids.map((uid) => ({
      user_id: uid,
      kind: "system",
      title: data.title,
      body: data.body,
      link: data.link,
      metadata: { from: "owner", one_way: true },
    }));

    const { error } = await supabaseAdmin.from("player_notifications").insert(rows);
    if (error) throw new Error(error.message);

    return { ok: true, sent: rows.length };
  });
