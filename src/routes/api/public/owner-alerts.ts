import { createFileRoute } from "@tanstack/react-router";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

// Called only by internal database triggers (new user / new message / new order).
// Authenticated with a random token stored in a service-role-only table.

type Payload = { type?: string; id?: string };

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "";

export const Route = createFileRoute("/api/public/owner-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-token");
        if (!token) return new Response("Unauthorized", { status: 401 });

        let payload: Payload = {};
        try {
          payload = (await request.json()) as Payload;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const { type, id } = payload;
        if (!type || !id) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("internal_cron_tokens")
          .select("token")
          .eq("name", "owner_alerts")
          .maybeSingle();
        const expected = (row as { token?: string } | null)?.token;
        if (!expected || expected.length !== token.length || expected !== token) {
          return new Response("Unauthorized", { status: 401 });
        }

        let heading = "";
        const lines: string[] = [];

        if (type === "new_user") {
          const { data: p } = await supabaseAdmin
            .from("profiles")
            .select("username, display_name, created_at")
            .eq("id", id)
            .maybeSingle();
          heading = "משתמש חדש נרשם 🎉";
          lines.push(`שם משתמש: ${p?.username ?? "—"}`);
          if (p?.display_name) lines.push(`שם תצוגה: ${p.display_name}`);
          lines.push(`מועד הרשמה: ${fmt(p?.created_at)}`);
        } else if (type === "message") {
          const { data: m } = await supabaseAdmin
            .from("conversation_messages")
            .select("body, sender_id, conversation_id, created_at")
            .eq("id", id)
            .maybeSingle();
          let sender = "—";
          if (m?.sender_id) {
            const { data: p } = await supabaseAdmin
              .from("profiles")
              .select("username")
              .eq("id", m.sender_id)
              .maybeSingle();
            sender = p?.username ?? "—";
          }
          heading = "הודעה חדשה מלקוח 💬";
          lines.push(`מאת: ${sender}`);
          lines.push(`תוכן: ${String(m?.body ?? "").slice(0, 500)}`);
          lines.push(`מועד: ${fmt(m?.created_at)}`);
        } else if (type === "order") {
          const { data: o } = await supabaseAdmin
            .from("orders")
            .select(
              "order_number, order_type, quantity, credits_charged, cash_amount, currency, status, user_id, product_id, created_at",
            )
            .eq("id", id)
            .maybeSingle();
          let buyer = "—";
          if (o?.user_id) {
            const { data: p } = await supabaseAdmin
              .from("profiles")
              .select("username")
              .eq("id", o.user_id)
              .maybeSingle();
            buyer = p?.username ?? "—";
          }
          let product = "";
          if (o?.product_id) {
            const { data: pr } = await supabaseAdmin
              .from("products")
              .select("name, sku")
              .eq("id", o.product_id)
              .maybeSingle();
            if (pr?.name) product = pr.sku ? `${pr.name} (${pr.sku})` : pr.name;
          }
          heading = `הזמנה חדשה #${o?.order_number ?? "—"} 📦`;
          lines.push(`מבצע ההזמנה: ${buyer}`);
          lines.push(`סוג: ${o?.order_type ?? "—"}`);
          if (product) lines.push(`פריט: ${product}`);
          if (o?.quantity) lines.push(`כמות: ${o.quantity}`);
          if (o?.credits_charged) lines.push(`עלות בג'מים: ${o.credits_charged}`);
          if (o?.cash_amount) lines.push(`תשלום: ${o.cash_amount} ${o.currency ?? ""}`);
          lines.push(`מועד: ${fmt(o?.created_at)}`);
        } else {
          return new Response("ok", { status: 200 });
        }

        try {
          await sendTemplateEmail("owner-alert", "coltcollect@gmail.com", {
            templateData: {
              heading,
              lines,
              footerNote: "התראה אוטומטית מ-COLT Market World.",
            },
            idempotencyKey: `owner-alert-${type}-${id}`,
          });
        } catch (err) {
          console.error("owner-alert send failed", (err as Error)?.message);
          return new Response("send failed", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
