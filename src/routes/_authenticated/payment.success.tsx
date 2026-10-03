import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchClientOrderStatus } from "@/lib/gem-purchase.functions";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export const Route = createFileRoute("/_authenticated/payment/success")({
  component: PaymentSuccess,
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s.order === "string" ? s.order : "" }),
});

function PaymentSuccess() {
  const { order } = Route.useSearch();
  const [status, setStatus] = useState<string>("pending");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!order) return;
    let stopped = false;

    // Real-time listener on Firestore document for instant feedback
    let unsub: (() => void) | null = null;
    if (db) {
      try {
        unsub = onSnapshot(
          doc(db, "orders", order),
          (snap) => {
            if (snap.exists()) {
              const d = snap.data();
              const s = d.payment_status || d.status || "pending";
              setStatus(s);
            }
          },
          (err) => console.warn("Firestore snapshot error", err),
        );
      } catch (e) {
        console.warn("Firestore listen failed", e);
      }
    }

    // Polling fallback
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await fetchClientOrderStatus(order);
        if (stopped) return;
        if (res?.payment_status) {
          setStatus(res.payment_status);
          if (res.payment_status === "paid" || res.payment_status === "failed" || res.payment_status === "refunded") return;
        }
      } catch {}
      attempts += 1;
      if (attempts < 180 && !stopped) setTimeout(poll, 2500);
    };

    poll();

    return () => {
      stopped = true;
      if (unsub) unsub();
    };
  }, [order, tick]);

  if (!order) {
    return (
      <div className="chrome-panel p-6">
        <h1 className="text-lg font-bold">חסר מספר הזמנה</h1>
        <Link to="/credits" className="underline text-sm">חזרה לחנות הקרדיטים</Link>
      </div>
    );
  }

  if (status === "paid" || status === "completed") {
    return (
      <div className="chrome-panel p-6 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-2 text-xl font-bold">התשלום התקבל!</h1>
        <p className="mt-1 text-sm text-muted-foreground">הקרדיטים נוספו לחשבונך.</p>
        <div className="mt-4 flex justify-center gap-2 text-xs">
          <Link to="/play" className="btn-plastic">חזרה למשחק</Link>
          <Link to="/credits" className="chrome-panel px-3 py-1">חנות הקרדיטים</Link>
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
          <Link to="/credits" className="btn-plastic">חזרה לחבילות</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="chrome-panel p-6 text-center">
      <div className="text-4xl animate-pulse">⏳</div>
      <h1 className="mt-2 text-lg font-bold">ממתינים לאישור התשלום…</h1>
      <p className="mt-1 text-xs text-muted-foreground">ברגע ש־PayPal יאשרו את התשלום — הקרדיטים יזוכו אוטומטית.</p>
      <p className="mt-2 text-[10px] text-muted-foreground">הזמנה: {order}</p>
      <button className="btn-plastic mt-4 text-xs" onClick={() => setTick((n) => n + 1)}>
        בדוק שוב עכשיו
      </button>
    </div>
  );
}
