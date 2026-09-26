import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/payment/cancel")({
  component: PaymentCancel,
});

function PaymentCancel() {
  return (
    <div className="chrome-panel p-6 text-center">
      <div className="text-4xl">🛑</div>
      <h1 className="mt-2 text-lg font-bold">התשלום בוטל</h1>
      <p className="mt-1 text-sm text-muted-foreground">אפשר לנסות שוב בכל רגע.</p>
      <div className="mt-4 flex justify-center gap-2 text-xs">
        <Link to="/credits" className="btn-plastic">חזרה לחבילות</Link>
        <Link to="/play" className="chrome-panel px-3 py-1">חזרה למשחק</Link>
      </div>
    </div>
  );
}
