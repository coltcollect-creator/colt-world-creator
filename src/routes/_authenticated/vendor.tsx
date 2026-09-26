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
  const [showForm, setShowForm] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["vendor-products", vendor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, category, subcategory, description, set_name, tags, credit_price, stock, vendor_status, store_id, created_at")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendorProduct[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["vendor-categories"],
    queryFn: async () =>
      (await supabase.from("product_categories").select("name").eq("active", true).order("display_order")).data ?? [],
  });

  const existingNames = useMemo(() => new Set(products.map((p) => p.name.trim().toLowerCase())), [products]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["vendor-products", vendor.id] });

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

  const counts = {
    pending: products.filter((p) => p.vendor_status === "pending").length,
    approved: products.filter((p) => p.vendor_status === "approved").length,
    rejected: products.filter((p) => p.vendor_status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="chrome-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h1 className="text-lg font-black">🏪 {vendor.shop_name || "החנות שלי"}</h1>
          <p className="text-xs text-muted-foreground">
            ממתינים לאישור: {counts.pending} · מאושרים: {counts.approved} · נדחו: {counts.rejected}
          </p>
        </div>
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
      </div>

      {showForm && (
        <ProductForm
          vendorId={vendor.id}
          categories={categories.map((c) => c.name)}
          existingNames={existingNames}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}

      <div className="chrome-panel rounded-2xl p-4">
        <div className="mb-2 text-sm font-bold">המוצרים שלי</div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">טוען…</div>
        ) : !products.length ? (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            עדיין לא העליתם מוצרים. התחילו ב״העלאת מוצר״ או בייבוא מקובץ Excel.
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const st = STATUS_LABEL[p.vendor_status] ?? { label: p.vendor_status, cls: "bg-muted" };
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border-2 border-border bg-white/60 p-2">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" /> : <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">—</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{p.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {p.category ?? "—"}{p.set_name ? ` · ${p.set_name}` : ""} · 💎 {p.credit_price} · מלאי {p.stock ?? "∞"}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  {p.vendor_status === "pending" && (
                    <button onClick={() => void remove(p)} className="text-xs text-destructive underline">מחיקה</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
