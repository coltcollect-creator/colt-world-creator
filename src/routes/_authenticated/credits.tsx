import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createGemPurchase } from "@/lib/gem-purchase.functions";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/credits")({ component: CreditsShop });

function CreditsShop() {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const create = useServerFn(createGemPurchase);
  const { data: packs = [] } = useQuery({
    queryKey: ["packs"],
    queryFn: async () =>
      (await supabase.from("credit_packages").select("*").eq("active", true).order("display_order")).data ?? [],
  });

  async function buy(id: string) {
    try {
      setBusy(id);
      const res = await create({ data: { package_id: id, return_origin: window.location.origin } });
      // Open PayPal in a new tab and navigate this tab to the waiting screen
      window.open(res.paypal_url, "_blank", "noopener,noreferrer");
      window.location.href = `/payment/success?order=${res.order_id}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="chrome-panel p-6">
      <h1 className="text-xl font-bold">{t("credits.title") ?? "Buy credits"}</h1>
      <p className="text-xs text-muted-foreground">
        {t("credits.hint") ??
          "התשלום מבוצע ב־PayPal בכרטיסייה חדשה. לאחר סיום התשלום, הקרדיטים מזוכים אוטומטית."}
      </p>
      <div data-tour="credit-packs" className="mt-4 grid gap-3 md:grid-cols-2">
        {packs.map((p) => {
          const price = Number(p.price ?? 0);
          const perCredit = p.credit_amount > 0 ? price / p.credit_amount : 0;
          return (
            <div key={p.id} className={`chrome-panel p-4 ${p.featured ? "ring-4 ring-primary" : ""}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <span className="text-primary text-2xl font-black">💎 {p.credit_amount}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                ₪{perCredit.toFixed(3)} לכל קרדיט
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm font-bold">{price.toFixed(2)} ₪</div>
                <button
                  className="btn-plastic text-xs disabled:opacity-50"
                  disabled={busy === p.id}
                  onClick={() => buy(p.id)}
                >
                  {busy === p.id ? "..." : t("credits.buy") ?? "רכישה"}
                </button>
              </div>
            </div>
          );
        })}
        {packs.length === 0 && (
          <div className="text-sm text-muted-foreground">אין חבילות זמינות כרגע.</div>
        )}
      </div>
      <div className="mt-4 text-xs">
        <Link to="/play" className="underline">
          ← חזרה למשחק
        </Link>
      </div>
    </div>
  );
}
