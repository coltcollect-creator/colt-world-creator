import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_quests",
  title: "List my quests",
  description: "Return quests visible to the signed-in player with progress state.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const [{ data: quests, error: qErr }, { data: progress, error: pErr }] = await Promise.all([
      supabase.from("quests").select("id, title, description, xp_reward, credits_reward, gems_reward, target_count").eq("is_active", true),
      supabase.from("quest_progress").select("quest_id, progress, completed_at").eq("user_id", ctx.getUserId()),
    ]);
    if (qErr || pErr) return { content: [{ type: "text", text: (qErr ?? pErr)!.message }], isError: true };
    const map = new Map((progress ?? []).map((p) => [p.quest_id, p]));
    const merged = (quests ?? []).map((q) => ({ ...q, progress: map.get(q.id) ?? null }));
    return {
      content: [{ type: "text", text: JSON.stringify(merged) }],
      structuredContent: { quests: merged },
    };
  },
});
