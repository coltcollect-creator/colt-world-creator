import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: Inventory });

type OrderRow = {
  id: string;
  order_number: number;
  shipment_number: number | null;
  product_id: string | null;
  status: string;
  fulfillment_status: string;
  credits_charged: number;
  shipping_method: string | null;
  delivery_address: string | null;
  delivered_at: string | null;
  created_at: string;
  products: { name: string; sku: string | null; image_url: string | null } | null;
};

function Inventory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"pickup" | "shipping" | null>(null);
  const [address, setAddress] = useState("");

  const { data: cosm = [] } = useQuery({
    queryKey: ["inv", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("player_cosmetics").select("acquired_at, source, cosmetics(name, layer_type, image_url, thumbnail_url)").eq("user_id", user!.id)).data ?? [],
  });

  const { data: orders = [] } = useQuery<OrderRow[]>({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("orders").select("id, order_number, shipment_number, product_id, status, fulfillment_status, credits_charged, shipping_method, delivery_address, delivered_at, created_at, products(name, sku, image_url)").eq("user_id", user!.id).in("order_type", ["product", "wheel", "mystery_box", "auction", "live_rip"]).not("product_id", "is", null).order("created_at", { ascending: false })).data as unknown as OrderRow[] ?? [],
  });

  const { data: settings } = useQuery({
    queryKey: ["shipping-settings"],
    queryFn: async () => (await supabase.from("game_settings").select("pickup_address, shipping_gems_cost").eq("id", 1).maybeSingle()).data,
  });

  const awaiting = orders.filter((o) => o.fulfillment_status === "awaiting_request");
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(awaiting.map((o) => o.id)));
  const clearSel = () => setSelected(new Set());

  const openBulk = (method: "pickup" | "shipping") => {
    if (selected.size === 0) { toast.error("בחרו לפחות פריט אחד"); return; }
    setBulkMode(method);
    setAddress(method === "pickup" ? settings?.pickup_address ?? "" : "");
  };

  const submitBulk = async () => {
    if (!bulkMode) return;
    const ids = Array.from(selected);
    const { data, error } = await supabase.rpc("request_bulk_delivery" as never, { _order_ids: ids, _method: bulkMode, _address: address } as never);
    if (error) { toast.error(error.message); return; }
    const updated = (data as { updated?: number } | null)?.updated ?? ids.length;
    toast.success(bulkMode === "pickup" ? `${updated} פריטים מוכנים לאיסוף` : `${updated} פריטים יצאו במשלוח אחד`);
    qc.invalidateQueries({ queryKey: ["my-orders"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    setBulkMode(null);
    clearSel();
  };

  const statusLabel = (s: string) =>
    s === "awaiting_request" ? "ממתין לבקשה" :
    s === "in_transit" ? "נשלח / באיסוף" :
    s === "delivered" ? "נמסר" : s;

  const statusColor = (s: string) =>
    s === "delivered" ? "bg-green-500" :
    s === "in_transit" ? "bg-amber-500" : "bg-slate-400";

  return (
    <div className="space-y-4">
      <div className="chrome-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">📦 המוצרים שלי</h1>
          {awaiting.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-foreground">נבחרו {selected.size}/{awaiting.length}</span>
              <button onClick={selectAll} className="chrome-panel px-2 py-1">בחרו הכל</button>
              {selected.size > 0 && <button onClick={clearSel} className="chrome-panel px-2 py-1">נקו</button>}
              <button onClick={() => openBulk("pickup")} disabled={selected.size === 0} className="chrome-panel px-2 py-1 disabled:opacity-40">🏬 איסוף לנבחרים</button>
              <button onClick={() => openBulk("shipping")} disabled={selected.size === 0} className="chrome-panel px-2 py-1 disabled:opacity-40">
                📮 משלוח לנבחרים {settings?.shipping_gems_cost ? `(💎 ${settings.shipping_gems_cost})` : ""}
              </button>
            </div>
          )}
        </div>
        {orders.length === 0 ? (
          <div className="text-sm text-muted-foreground">עדיין לא רכשת מוצרים. עברו לחנות במפה.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((o) => {
              const isAwaiting = o.fulfillment_status === "awaiting_request";
              const isSel = selected.has(o.id);
              return (
              <div key={o.id} className={`chrome-panel flex gap-3 p-3 ${isSel ? "ring-2 ring-primary" : ""}`}>
                {isAwaiting && (
                  <input type="checkbox" checked={isSel} onChange={() => toggle(o.id)} className="mt-2 h-5 w-5 shrink-0 accent-pink-500" />
                )}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-pink-100 to-purple-100">
                  {o.products?.image_url ? <img src={o.products.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" /> : <div className="grid h-full w-full place-items-center text-2xl">📦</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-bold">{o.products?.name ?? "מוצר שהוסר מהחנות"}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${statusColor(o.fulfillment_status)}`}>
                      {statusLabel(o.fulfillment_status)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono font-bold text-primary">הזמנה #{o.order_number}</span>
                    {o.shipment_number != null && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-bold text-amber-800">משלוח #{o.shipment_number}</span>
                    )}
                    {o.products?.sku && <span className="text-muted-foreground">מק״ט: <span className="font-mono">{o.products.sku}</span></span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    💎 {o.credits_charged} · {new Date(o.created_at).toLocaleDateString()}
                    {o.shipping_method && <> · {o.shipping_method === "pickup" ? "איסוף עצמי" : "משלוח"}</>}
                  </div>
                  {o.fulfillment_status === "in_transit" && o.delivery_address && (
                    <div className="mt-1 text-[11px] text-muted-foreground">כתובת: {o.delivery_address}</div>
                  )}
                  {o.delivered_at && <div className="mt-1 text-[11px] text-green-700">נמסר: {new Date(o.delivered_at).toLocaleDateString()}</div>}
                </div>
              </div>
            );})}
          </div>
        )}
        {awaiting.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 p-2 text-[11px] text-amber-800">
            טיפ: סמנו כמה פריטים בבת אחת ובחרו איסוף אחד או משלוח משותף – משלוח נגבה פעם אחת עבור הבקשה.
          </div>
        )}
      </div>

      <div className="chrome-panel p-4">
        <h2 className="mb-3 text-lg font-bold">👕 קוסמטיקות שלי</h2>
        {cosm.length === 0 ? (
          <div className="text-sm text-muted-foreground">אין פריטים. עברו להתאמה אישית.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {cosm.map((row: { acquired_at: string; source: string; cosmetics: { name: string; layer_type: string; thumbnail_url?: string | null; image_url?: string | null } | null }, i: number) => (
              <div key={i} className="chrome-panel p-3 text-sm">
                {(row.cosmetics?.thumbnail_url || row.cosmetics?.image_url) && (
                  <img src={(row.cosmetics.thumbnail_url ?? row.cosmetics.image_url) as string} alt="" loading="lazy" decoding="async" className="mb-2 h-16 w-full object-contain" />
                )}
                <div className="font-semibold">{row.cosmetics?.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{row.cosmetics?.layer_type} · {row.source}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bulkMode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setBulkMode(null)}>
          <div className="chrome-panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">{bulkMode === "pickup" ? "🏬 איסוף עצמי" : "📮 משלוח"}</h3>
            <div className="mb-3 text-xs text-muted-foreground">{selected.size} פריטים ייכללו בבקשה</div>
            {bulkMode === "pickup" ? (
              <div className="rounded-xl bg-muted p-3 text-sm">
                <div className="mb-1 font-semibold">כתובת האיסוף:</div>
                <div>{settings?.pickup_address ?? "כתובת האיסוף תישלח לאחר האישור."}</div>
              </div>
            ) : (
              <label className="block text-xs">
                <span className="mb-1 block font-semibold">כתובת למשלוח</span>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm" placeholder="רחוב, מספר, עיר, מיקוד" />
                {(settings?.shipping_gems_cost ?? 0) > 0 && <div className="mt-1 text-[11px] text-muted-foreground">עלות משלוח: 💎 {settings?.shipping_gems_cost} (פעם אחת עבור הבקשה)</div>}
              </label>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setBulkMode(null)} className="chrome-panel px-4 py-2 text-sm">ביטול</button>
              <button onClick={submitBulk} disabled={bulkMode === "shipping" && !address.trim()} className="btn-plastic disabled:opacity-40">אשרו</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
