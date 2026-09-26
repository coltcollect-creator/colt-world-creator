import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n";
import { QuestCompletionToast } from "@/components/game/QuestCompletionToast";
import { NotificationListener } from "@/components/NotificationListener";
import { TourProvider } from "@/lib/tour";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="chrome-panel max-w-md p-8 text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-2 text-xl font-semibold">Off the map</h2>
        <p className="mt-2 text-sm text-muted-foreground">This corner of COLT doesn't exist yet.</p>
        <a href="/" className="btn-plastic mt-6 inline-block">Return to Plaza</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="chrome-panel max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Something popped a bubble</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try refreshing to jump back in.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="btn-plastic">Try again</button>
          <a href="/" className="btn-plastic" style={{ background: "var(--color-secondary)", color: "var(--color-secondary-foreground)", borderColor: "transparent", boxShadow: "none" }}>Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "COLT-A-CON — Collect. Trade. Play." },
      { name: "description", content: "COLT-A-CON. LIVE CONVENTION FOR TRADING CARDS AND COLLECTORS NATION-WIDE" },
      { property: "og:title", content: "COLT-A-CON — Collect. Trade. Play." },
      { property: "og:description", content: "COLT-A-CON. LIVE CONVENTION FOR TRADING CARDS AND COLLECTORS NATION-WIDE" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "COLT-A-CON — Collect. Trade. Play." },
      { name: "twitter:description", content: "COLT-A-CON. LIVE CONVENTION FOR TRADING CARDS AND COLLECTORS NATION-WIDE" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ApGcr0qPDnQ5CViOmYW51jTwlmo1/social-images/social-1784383097448-לוגו-colt-e1774968981891.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ApGcr0qPDnQ5CViOmYW51jTwlmo1/social-images/social-1784383097448-לוגו-colt-e1774968981891.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body suppressHydrationWarning>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Fire-and-forget bootstrap of the astratego owner account (once per browser session).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("colt.bootstrap") === "1") return;
      sessionStorage.setItem("colt.bootstrap", "1");
    } catch { /* ignore storage errors */ }
    fetch("/api/public/bootstrap-owner", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.invalidate();
        queryClient.clear();
      } else if (event === "USER_UPDATED") {
        // Only refresh identity-scoped data, not the whole cache.
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
      // SIGNED_IN / TOKEN_REFRESHED: do nothing — cached data stays valid.
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <TourProvider>
          <Outlet />
          </TourProvider>
          <QuestCompletionToast />
          <NotificationListener />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
