import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrderStatus } from "@/lib/gem-purchase.functions";

export const Route = createFileRoute("/_authenticated/payment/success")({
  component: PaymentSuccess,
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s.order === "string" ? s.order : "" }),
});

function PaymentSuccess() {
  const { order } = Route.useSearch();
  const fetchStatus = useServerFn(getOrderStatus);
  const [status, setStatus] = useState<string>("pending");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!order) return;
    let stopped = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await fetchStatus({ data: { order_id: order } });
        if (stopped) return;
        setStatus(res.payment_status ?? "pending");
        if (res.payment_status === "paid" || res.payment_status === "failed" || res.payment_status === "refunded") return;
      } catch {}
      attempts += 1;
      if (attempts < 180 && !stopped) setTimeout(poll, 2000);
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [order, tick, fetchStatus]);

  if (!order) {
    return (
      <div className="chrome-panel p-6">
        <h1 className="text-lg font-bold">חסר מספר הזמנה</h1>
        <Link to="/credits" className="underline text-sm">חזרה לחנות הקרדיטים</Link>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="chrome-panel p-6 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-2 text-xl font-bold">התשלום התקבל!</h1>
        <p className="mt-1 text-sm text-muted-foreground">הקרדיטים נוספו לחשבונך.</p>
        <div className="mt-4 flex justify-center gap-2 text-xs">
          <Link to="/play" className="btn-plastic">חזרה למשחק</Link>
          <Link to="/credits" className="chrome-panel px-3 py-1">רכישה נוספת</Link>
        </div>
      </div>
    );
  }

  if (status === "failed" || status === "refunded") {
    return (
      <div className="chrome-panel p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-2 text-lg font-bold">התשלום לא הושלם</h1>
        <p className="mt-1 text-sm text-muted-foreground">אם חויבת בטעות, פנה לתמיכה.</p>
        <div className="mt-4 flex justify-center gap-2 text-xs">
          <Link to="/credits" className="btn-plastic">נסה שוב</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="chrome-panel p-6 text-center">
      <div className="text-4xl animate-pulse">⏳</div>
      <h1 className="mt-2 text-lg font-bold">ממתינים לאישור התשלום…</h1>
      <p className="mt-1 text-xs text-muted-foreground">אל תסגור את החלון. ברגע ש־PayPal יאשרו — הקרדיטים יזוכו אוטומטית.</p>
      <p className="mt-2 text-[10px] text-muted-foreground">הזמנה: {order}</p>
      <button className="btn-plastic mt-4 text-xs" onClick={() => setTick((n) => n + 1)}>
        בדוק שוב עכשיו
      </button>
    </div>
  );
}
