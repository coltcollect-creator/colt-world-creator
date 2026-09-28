import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { downloadTemplate, parseExcelFile } from "@/lib/excel";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({
    meta: [
      { title: "אזור הוונדורים · COLT Market World" },
      { name: "description", content: "הצטרפו כוונדורים ב-COLT Market World, העלו קלפים ואספנות ומכרו לשחקנים תמורת ג'מים." },
      { property: "og:title", content: "אזור הוונדורים · COLT Market World" },
      { property: "og:description", content: "העלו מוצרים למכירה בעולם COLT וקבלו ג'מים על כל מכירה." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VendorPage,
});

type Vendor = {
  id: string;
  shop_name: string | null;
  status: string;
  terms_accepted_at: string;
};

type VendorProduct = {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  set_name: string | null;
  tags: string[] | null;
  credit_price: number;
  stock: number | null;
  vendor_status: string;
  store_id: string | null;
  store_ids: string[] | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "ממתין לאישור", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "אושר ומוצג", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "נדחה", cls: "bg-red-100 text-red-700" },
};

function VendorPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["vendor-terms"],
    queryFn: async () =>
      (
        await supabase
          .from("game_settings")
          .select("vendor_terms_url, vendor_terms_text, vendor_program_enabled")
          .eq("id", 1)
          .maybeSingle()
      ).data,
  });

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["my-vendor", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, shop_name, status, terms_accepted_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as Vendor | null) ?? null;
    },
  });

  if (isLoading) {
    return <div className="chrome-panel rounded-2xl p-6 text-sm text-muted-foreground">טוען…</div>;
  }

  if (settings?.vendor_program_enabled === false && !vendor) {
    return (
      <div className="chrome-panel rounded-2xl p-6 text-sm">
        ההרשמה כוונדורים סגורה כרגע. נסו שוב מאוחר יותר 🙏
      </div>
    );
  }

  if (!vendor) {
    return (
      <JoinVendor
        termsUrl={settings?.vendor_terms_url ?? null}
        termsText={settings?.vendor_terms_text ?? null}
        defaultShopName={profile?.display_name ?? profile?.username ?? ""}
        onJoined={() => qc.invalidateQueries({ queryKey: ["my-vendor", user?.id] })}
      />
    );
  }

  return <VendorDashboard vendor={vendor} />;
}

/* ---------------------------------- join ---------------------------------- */

function JoinVendor({
  termsUrl,
  termsText,
  defaultShopName,
  onJoined,
}: {
  termsUrl: string | null;
  termsText: string | null;
  defaultShopName: string;
  onJoined: () => void;
}) {
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [shopName, setShopName] = useState(defaultShopName);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!agreed) return;
    setBusy(true);
    const { error } = await supabase.from("vendors").insert({
      user_id: user!.id,
      shop_name: shopName.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("ברוכים הבאים! אזור הוונדור נפתח 🎉");
    onJoined();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="chrome-panel rounded-2xl p-5">
        <h1 className="text-xl font-black">🏪 הפוך לוונדור</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          כוונדור אפשר להעלות קלפים ופריטי אספנות למכירה בעולם COLT, לקבוע מחיר בג׳מים ולקבל תשלום על כל מכירה.
        </p>
      </div>

      <div className="chrome-panel space-y-3 rounded-2xl p-5">
        <div className="text-sm font-bold">תקנון הוונדורים</div>
        <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded-xl border-2 border-border bg-white/60 p-3 text-[13px] leading-relaxed">
          {termsText?.trim()
            ? termsText
            : `1. הוונדור מצהיר שהפריטים שהוא מעלה נמצאים ברשותו, מקוריים ובמצב המתואר.
2. כל פריט חייב לכלול שם, תמונה אמיתית של הפריט, קטגוריה ומחיר בג׳מים.
3. אין להעלות אותו פריט פעמיים — פריט שקיים במספר יחידות יועלה פעם אחת עם כמות המלאי המתאימה.
4. פריט שנמכר יורד מהמלאי בכל המקומות שבהם הוא הוצג.
5. הפריטים עוברים אישור של צוות COLT לפני שהם מוצגים לשחקנים, וההנהלה יכולה לדחות פריט או להסירו.
6. אופן קבלת התשלום, העמלות ומועדי ההעברה מפורטים בתקנון המלא.
7. השימוש באזור הוונדורים כפוף לתקנון האתר ולמדיניות הפרטיות.`}
        </div>
        {termsUrl && (
          <a href={termsUrl} target="_blank" rel="noreferrer" className="inline-block text-xs font-bold text-primary underline">
            קריאת התקנון המלא ↗
          </a>
        )}

        <label className="block text-xs font-bold">
          שם החנות/הכינוי שיוצג לקונים
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal"
            placeholder="לדוגמה: COLT Cards"
          />
        </label>

        <label className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>קראתי, הבנתי ואני מאשר/ת את תקנון הוונדורים ואת האמור בו, כולל אופן קבלת התשלום.</span>
        </label>

        <button
          onClick={() => void join()}
          disabled={!agreed || busy}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow disabled:opacity-40"
        >
          {busy ? "מצטרף…" : "אני מאשר/ת ומצטרף/ת כוונדור"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- dashboard -------------------------------- */

const EXCEL_FIELDS = [
  { key: "name", label: "שם המוצר (חובה)", type: "text" },
  { key: "category", label: "קטגוריה (חובה)", type: "text" },
  { key: "credit_price", label: "מחיר בג׳מים (חובה)", type: "number" },
  { key: "image_url", label: "קישור לתמונה (חובה)", type: "text" },
  { key: "stock", label: "מלאי", type: "number" },
  { key: "description", label: "תיאור", type: "text" },
  { key: "set_name", label: "חלק מסט", type: "text" },
  { key: "tags", label: "תגיות (מופרדות בפסיק)", type: "text" },
];

function VendorDashboard({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [showForm, setShowForm] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["vendor-products", vendor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, category, subcategory, description, set_name, tags, credit_price, stock, vendor_status, store_id, store_ids, created_at")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendorProduct[];
    },
  });

  const { data: allStores = [] } = useQuery({
    queryKey: ["vendor-stores-lookup"],
    queryFn: async () => (await supabase.from("stores").select("id, name")).data ?? [],
  });

  const storeMap = useMemo(() => new Map(allStores.map((s: { id: string; name: string }) => [s.id, s.name])), [allStores]);

  const { data: vendorOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ["vendor-orders", vendor.id],
    queryFn: async () => {
      // Find orders of products that belong to this vendor
      const { data: myProducts } = await supabase
        .from("products")
        .select("id")
        .eq("vendor_id", vendor.id);
      
      const pIds = (myProducts ?? []).map((p) => p.id);
      if (!pIds.length) return [];

      const { data: ords } = await supabase
        .from("orders")
        .select("id, order_number, shipment_number, product_id, quantity, credits_charged, fulfillment_status, created_at, vendor_shipped, products(name, sku, image_url, category, set_name)")
        .in("product_id", pIds)
        .order("created_at", { ascending: false });

      return (ords ?? []) as any[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["vendor-categories"],
    queryFn: async () =>
      (await supabase.from("product_categories").select("name").eq("active", true).order("display_order")).data ?? [],
  });

  const existingNames = useMemo(() => new Set(products.map((p) => p.name.trim().toLowerCase())), [products]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vendor-products", vendor.id] });
    qc.invalidateQueries({ queryKey: ["vendor-orders", vendor.id] });
  };

  const remove = async (p: VendorProduct) => {
    if (p.vendor_status !== "pending") {
      toast.error("אפשר למחוק רק פריט שממתין לאישור. לפריט שאושר פנו אלינו בהודעות.");
      return;
    }
    if (!confirm(`למחוק את "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("נמחק");
    refresh();
  };

  const toggleVendorShipped = async (orderId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    const { error } = await supabase
      .from("orders")
      .update({ vendor_shipped: newVal })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(newVal ? "סומן כנשלח להנהלת COLT 📦" : "סומן כממתין למשלוח להנהלה");
    refresh();
  };

  const counts = {
    pending: products.filter((p) => p.vendor_status === "pending").length,
    approved: products.filter((p) => p.vendor_status === "approved").length,
    rejected: products.filter((p) => p.vendor_status === "rejected").length,
    orders: vendorOrders.length,
    ordersPendingShip: vendorOrders.filter((o) => !o.vendor_shipped).length,
  };

  return (
    <div className="space-y-4">
      <div className="chrome-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h1 className="text-lg font-black">🏪 {vendor.shop_name || "החנות שלי"}</h1>
          <p className="text-xs text-muted-foreground">
            מוצרים: {products.length} (מאושרים: {counts.approved}) · הזמנות שבוצעו: {counts.orders} {counts.ordersPendingShip > 0 && <span className="text-amber-600 font-bold">({counts.ordersPendingShip} ממתינות למשלוח להנהלה)</span>}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1 border border-border">
          <button
            onClick={() => setActiveTab("products")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "products" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📦 ניהול מוצרים ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "orders" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🧾 הזמנות למשלוח ({vendorOrders.length})
            {counts.ordersPendingShip > 0 && (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-destructive text-[10px] text-white">
                {counts.ordersPendingShip}
              </span>
            )}
          </button>
        </div>

        {activeTab === "products" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow">
              {showForm ? "סגירת הטופס" : "➕ העלאת מוצר"}
            </button>
            <button
              onClick={() =>
                downloadTemplate(
                  "vendor-products",
                  EXCEL_FIELDS.map((f) => f.key),
                  { name: "Charizard Base Set", category: "פוקימון", credit_price: 500, image_url: "https://…/card.jpg", stock: 1, description: "", set_name: "Base Set", tags: "holo,vintage" },
                )
              }
              className="chrome-panel px-2 py-1.5 text-xs"
            >
              📥 תבנית Excel
            </button>
            <ExcelImport vendorId={vendor.id} existingNames={existingNames} onDone={refresh} />
          </div>
        )}
      </div>

      {activeTab === "products" && showForm && (
        <ProductForm
          vendorId={vendor.id}
          categories={categories.map((c) => c.name)}
          existingNames={existingNames}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}

      {activeTab === "products" && (
        <div className="chrome-panel rounded-2xl p-4">
          <div className="mb-2 text-sm font-bold">המוצרים שלי</div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">טוען…</div>
          ) : !products.length ? (
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              עדיין לא העליתם מוצרים. התחילו ב״העלאת מוצר״ או בייבוא מקובץ Excel.
            </div>
          ) : (
            <div className="space-y-2.5">
              {products.map((p) => {
                const isApproved = p.vendor_status === "approved";
                const isPending = p.vendor_status === "pending";
                const isRejected = p.vendor_status === "rejected";

                const assignedStoreIds = Array.from(
                  new Set([
                    ...(p.store_id ? [p.store_id] : []),
                    ...(Array.isArray(p.store_ids) ? p.store_ids : []),
                  ])
                );
                const assignedStoreNames = assignedStoreIds
                  .map((sid) => storeMap.get(sid))
                  .filter(Boolean) as string[];

                return (
                  <div
                    key={p.id}
                    className={`flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-2xl border-2 p-3 transition-all ${
                      isApproved
                        ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20"
                        : isPending
                        ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
                        : "border-red-500/40 bg-red-500/5 dark:bg-red-950/20"
                    }`}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">—</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-black text-foreground">{p.name}</span>
                        {isApproved && (
                          <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                            <span>✅</span> מאושר ביריד
                          </span>
                        )}
                        {isPending && (
                          <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                            <span>⏳</span> ממתין לאישור הנהלה
                          </span>
                        )}
                        {isRejected && (
                          <span className="rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                            <span>❌</span> לא אושר
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {p.category ?? "—"}{p.set_name ? ` · סט: ${p.set_name}` : ""} · 💎 מחיר: <span className="font-bold text-primary">{p.credit_price}</span> · מלאי: <span className="font-bold">{p.stock ?? "∞"}</span>
                      </div>

                      {/* Store placement info */}
                      {isApproved && (
                        <div className="text-xs mt-1">
                          {assignedStoreNames.length > 0 ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              <span>🏪</span> מוצג בחנויות:{" "}
                              <span className="font-bold text-foreground">{assignedStoreNames.join(", ")}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-lg">
                              <span>⏳</span> מאושר, ממתין לשיבוץ בחנות ע"י ההנהלה
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <button
                        onClick={() => void remove(p)}
                        className="rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold px-2.5 py-1 transition-all"
                      >
                        מחיקה
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -------------------- VENDOR ORDERS PORTAL -------------------- */}
      {activeTab === "orders" && (
        <div className="chrome-panel space-y-4 rounded-2xl p-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <span>📦</span> הוראות שילוח והספקה להנהלת COLT:
            </div>
            <p>
              כאשר לקוח רוכש קלף שלכם ביריד, פרטי הרכישה מופיעים כאן. **למען פרטיות הלקוח**, פרטי המזמין אינם מוצגים. עליכם לשלוח את הקלף למחסן הנהלת COLT בצירוף מספר ההזמנה, וההנהלה תספק אותו ללקוח. לאחר ששלחתם, סמנו בצ׳קבוקס ״נשלח להנהלה״ כדי לעקוב אחר הטיפול.
            </p>
          </div>

          {isLoadingOrders ? (
            <div className="text-sm text-muted-foreground text-center py-6">טוען הזמנות…</div>
          ) : !vendorOrders.length ? (
            <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              עדיין אין הזמנות עבור הקלפים והמוצרים שלכם.
            </div>
          ) : (
            <div className="space-y-3">
              {vendorOrders.map((ord) => {
                const prod = ord.products;
                const isShipped = !!ord.vendor_shipped;
                return (
                  <div
                    key={ord.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition-all ${
                      isShipped
                        ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20"
                        : "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
                        {prod?.image_url ? (
                          <img src={prod.image_url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">🃏</div>
                        )}
                      </div>
                      <div className="min-w-0 text-start">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground truncate">{prod?.name || "קלף מבוקש"}</span>
                          <span className="rounded-full bg-primary/15 text-primary text-[10px] font-black px-2 py-0.5">
                            הזמנה #{ord.order_number || ord.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {prod?.category ? `${prod.category} · ` : ""}{prod?.set_name ? `${prod.set_name} · ` : ""}
                          כמות: <span className="font-bold text-foreground">{ord.quantity || 1}</span> · 
                          תמורה: <span className="font-bold text-primary">💎 {ord.credits_charged} ג'מים</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          תאריך קנייה: {new Date(ord.created_at).toLocaleDateString("he-IL")} {new Date(ord.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleVendorShipped(ord.id, isShipped)}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 ${
                          isShipped
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-amber-500 text-white hover:bg-amber-600 animate-pulse"
                        }`}
                      >
                        <span>{isShipped ? "✅ נשלח להנהלת COLT" : "⏳ לסמן כנשלח להנהלה"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ manual upload ------------------------------ */

function ProductForm({
  vendorId,
  categories,
  existingNames,
  onSaved,
}: {
  vendorId: string;
  categories: string[];
  existingNames: Set<string>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [cardSet, setCardSet] = useState("");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState<number>(100);
  const [stock, setStock] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("חובה למלא שם מוצר"); return; }
    if (!image) { toast.error("חובה להוסיף תמונה למוצר"); return; }
    if (!category.trim()) { toast.error("חובה לבחור קטגוריה"); return; }
    if (!price || price <= 0) { toast.error("חובה לקבוע מחיר בג׳מים"); return; }
    if (existingNames.has(name.trim().toLowerCase())) {
      toast.error("כבר העליתם מוצר בשם הזה — עדכנו את המלאי שלו במקום להעלות שוב");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      vendor_id: vendorId,
      vendor_status: "pending",
      active: false,
      name: name.trim(),
      image_url: image,
      category: category.trim(),
      description: description.trim() || null,
      set_name: cardSet.trim() || null,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      credit_price: Math.round(price),
      stock: Math.max(1, Math.round(stock)),
      product_type: "physical",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("products_vendor_unique_name") ? "המוצר הזה כבר קיים אצלכם" : error.message);
      return;
    }
    toast.success("המוצר נשלח לאישור ההנהלה ✅");
    onSaved();
  };

  return (
    <div className="chrome-panel space-y-3 rounded-2xl p-4">
      <div className="text-sm font-bold">העלאת מוצר חדש</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">
          שם המוצר *
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold">
          קטגוריה *
          <input
            list="vendor-cats"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="פוקימון / וואן פיס / …"
            className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal"
          />
          <datalist id="vendor-cats">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="text-xs font-bold">
          מחיר בג׳מים *
          <input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold">
          מלאי (כמה יחידות יש לכם)
          <input type="number" min={1} value={stock} onChange={(e) => setStock(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold">
          חלק מסט (אופציונלי)
          <input value={cardSet} onChange={(e) => setCardSet(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold">
          תגיות (אופציונלי, מופרדות בפסיק)
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal" />
        </label>
        <label className="text-xs font-bold sm:col-span-2">
          תיאור (אופציונלי)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm font-normal" />
        </label>
        <div className="sm:col-span-2">
          <ImageUpload value={image} onChange={setImage} folder="vendor-products" label="תמונת המוצר *" />
        </div>
      </div>
      <button onClick={() => void save()} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow disabled:opacity-40">
        {busy ? "שולח…" : "שליחה לאישור"}
      </button>
    </div>
  );
}

/* ------------------------------ excel import ------------------------------ */

function ExcelImport({ vendorId, existingNames, onDone }: { vendorId: string; existingNames: Set<string>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseExcelFile(file);
      const seen = new Set<string>();
      const valid: {
        vendor_id: string;
        vendor_status: string;
        active: boolean;
        name: string;
        category: string;
        image_url: string;
        credit_price: number;
        stock: number;
        description: string | null;
        set_name: string | null;
        tags: string[];
        product_type: string;
      }[] = [];
      let dupes = 0;
      let invalid = 0;
      for (const r of rows) {
        const name = String(r.name ?? "").trim();
        const category = String(r.category ?? "").trim();
        const image = String(r.image_url ?? "").trim();
        const price = Number(r.credit_price ?? 0);
        if (!name || !category || !image || !price || price <= 0) { invalid++; continue; }
        const key = name.toLowerCase();
        if (existingNames.has(key) || seen.has(key)) { dupes++; continue; }
        seen.add(key);
        valid.push({
          vendor_id: vendorId,
          vendor_status: "pending",
          active: false,
          name,
          category,
          image_url: image,
          credit_price: Math.round(price),
          stock: Math.max(1, Math.round(Number(r.stock ?? 1) || 1)),
          description: String(r.description ?? "").trim() || null,
          set_name: String(r.set_name ?? "").trim() || null,
          tags: String(r.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          product_type: "physical",
        });
      }
      if (!valid.length) {
        toast.error(`לא נוספו מוצרים · כפילויות: ${dupes} · שורות חסרות שם/קטגוריה/תמונה/מחיר: ${invalid}`);
        return;
      }
      for (let i = 0; i < valid.length; i += 200) {
        const { error } = await supabase.from("products").insert(valid.slice(i, i + 200));
        if (error) { toast.error(error.message); return; }
      }
      toast.success(`נוספו ${valid.length} מוצרים לאישור · כפילויות שדולגו: ${dupes} · שורות לא תקינות: ${invalid}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייבוא נכשל");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <label className="chrome-panel cursor-pointer px-2 py-1.5 text-xs">
      {busy ? "מייבא…" : "📤 ייבוא Excel"}
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }}
      />
    </label>
  );
}
