import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = (data as { redirect_url?: string; redirect_to?: string } | null)?.redirect_url
      ?? (data as { redirect_url?: string; redirect_to?: string } | null)?.redirect_to;
    if (immediate && !(data as { client?: unknown } | null)?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="chrome-panel max-w-md p-6 text-center">
        <h1 className="text-lg font-bold">שגיאה בטעינת בקשת ההרשאה</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as {
    client?: { name?: string; client_name?: string };
    scope?: string;
    scopes?: string[];
  } | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "אפליקציה חיצונית";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(" ") : []);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id)
      : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = (data as { redirect_url?: string; redirect_to?: string } | null)?.redirect_url
      ?? (data as { redirect_url?: string; redirect_to?: string } | null)?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("שרת האישור לא החזיר יעד להפניה.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="chrome-panel max-w-md w-full p-6">
        <h1 className="text-xl font-bold">חיבור {clientName} לחשבון שלך</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} יוכל לפעול ב-COLT-A-CON בשמך ולהשתמש בכלים המחוברים.
        </p>
        {scopes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {scopes.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          זה לא עוקף את הרשאות האפליקציה או את מדיניות הנתונים.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button disabled={busy} onClick={() => decide(true)} className="btn-plastic flex-1">
            {busy ? "רגע…" : "אישור"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="btn-plastic flex-1"
            style={{ background: "var(--color-secondary)", color: "var(--color-secondary-foreground)" }}
          >
            ביטול
          </button>
        </div>
      </div>
    </main>
  );
}
