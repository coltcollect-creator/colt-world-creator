import { createFileRoute } from "@tanstack/react-router";

// One-shot bootstrap: creates the owner astratego account if no owner exists yet.
// Requires SUPABASE_SERVICE_ROLE_KEY. On Lovable Cloud that key is not available,
// so this endpoint silently no-ops instead of returning 500.
export const Route = createFileRoute("/api/public/bootstrap-owner")({
  server: {
    handlers: {
      POST: async () => {
        try {
          if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(
              JSON.stringify({ ok: true, skipped: "no service role key" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: existingOwners, error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("role", "owner")
            .limit(1);

          if (roleErr) {
            return new Response(JSON.stringify({ ok: false, error: roleErr.message }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (existingOwners && existingOwners.length > 0) {
            return new Response(JSON.stringify({ ok: true, alreadyBootstrapped: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          const ownerEmail = "astratego@colt.market";
          const ownerPassword = "Astratego1!";
          const ownerUsername = "astratego";

          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: ownerEmail,
            password: ownerPassword,
            email_confirm: true,
            user_metadata: { username: ownerUsername },
          });
          if (createErr || !created.user) {
            return new Response(
              JSON.stringify({ ok: false, error: createErr?.message ?? "createUser failed" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          const uid = created.user.id;

          await supabaseAdmin
            .from("profiles")
            .update({ username: ownerUsername, display_name: "Owner" })
            .eq("id", uid);
          await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "owner" });

          return new Response(JSON.stringify({ ok: true, bootstrapped: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: (err as Error)?.message ?? "unknown" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
