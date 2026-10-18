import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Globe, RefreshCw, CheckCircle2, AlertCircle, Sparkles, ArrowRight, Check, X, FileText } from "lucide-react";

export type ParsedWooProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceILS: number;
  creditPrice: number;
  stock: number;
  imageUrl: string;
  category: string;
  isExisting?: boolean;
  selected?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  existingProductNames: Set<string>;
  onSyncComplete: () => void;
};

export function WooCatalogSyncModal({
  open,
  onOpenChange,
  vendorId,
  existingProductNames,
  onSyncComplete,
}: Props) {
  const [feedUrl, setFeedUrl] = useState(() => {
    return localStorage.getItem(`woo_feed_url_${vendorId}`) || "";
  });
  const [ratio, setRatio] = useState<number>(() => {
    const saved = localStorage.getItem(`woo_ratio_${vendorId}`);
    return saved ? parseFloat(saved) || 10 : 10;
  });
  const [customRatioInput, setCustomRatioInput] = useState<string>("10");
  const [rawXml, setRawXml] = useState("");
  const [showRawPaste, setShowRawPaste] = useState(false);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [parsedProducts, setParsedProducts] = useState<ParsedWooProduct[]>([]);
  const [saving, setSaving] = useState(false);

  // Parse XML text into structured product objects
  const parseXmlFeed = (xmlText: string, currentRatio: number): ParsedWooProduct[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item, entry"));
    const results: ParsedWooProduct[] = [];

    for (const item of items) {
      // Helper to query with or without namespace (e.g. g:title or title)
      const getVal = (...tags: string[]): string => {
        for (const t of tags) {
          const el = item.querySelector(t) || item.getElementsByTagName(t)[0];
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return "";
      };

      const title = getVal("g\\:title", "title", "name");
      if (!title) continue;

      const id = getVal("g\\:id", "id", "g\\:mpn", "sku") || `woo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const description = getVal("g\\:description", "description", "summary");
      const image = getVal("g\\:image_link", "image_link", "image", "enclosure");
      const category = getVal("g\\:product_type", "g\\:category", "category") || "ווקומרס";
      const availability = getVal("g\\:availability", "availability").toLowerCase();
      const rawQuantity = getVal("g\\:quantity", "quantity");

      // Parse price in ILS
      const rawPrice = getVal("g\\:price", "price", "g\\:sale_price");
      let priceILS = 0;
      if (rawPrice) {
        const numMatch = rawPrice.replace(/,/g, "").match(/[\d.]+/);
        if (numMatch) priceILS = parseFloat(numMatch[0]) || 0;
      }

      // Calculate credit price using selected ratio
      const creditPrice = Math.max(1, Math.round(priceILS * currentRatio));

      // Determine stock quantity
      let stock = 1;
      if (rawQuantity && !Number.isNaN(parseInt(rawQuantity, 10))) {
        stock = parseInt(rawQuantity, 10);
      } else if (availability.includes("out of stock") || availability.includes("outofstock")) {
        stock = 0;
      } else {
        stock = 1;
      }

      const isExisting = existingProductNames.has(title.trim().toLowerCase());

      results.push({
        id,
        sku: id,
        name: title,
        description,
        priceILS,
        creditPrice,
        stock,
        imageUrl: image,
        category,
        isExisting,
        selected: stock > 0, // auto select in-stock items
      });
    }

    return results;
  };

  const handleFetchFeed = async () => {
    if (!feedUrl.trim() && !rawXml.trim()) {
      toast.error("נא להזין קישור לקטלוג או להדביק את תוכן ה-XML");
      return;
    }

    setLoading(true);
    let xmlContent = rawXml.trim();

    if (!xmlContent && feedUrl.trim()) {
      try {
        const res = await fetch(feedUrl.trim());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        xmlContent = await res.text();
      } catch (err) {
        console.warn("Direct fetch failed (likely CORS on WordPress host):", err);
        // Fallback: try public CORS proxies or ask user to paste XML
        try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl.trim())}`;
          const pRes = await fetch(proxyUrl);
          if (pRes.ok) {
            xmlContent = await pRes.text();
          }
        } catch {}

        if (!xmlContent) {
          toast.error("שרת וורדפרס חסם קריאה ישירה (CORS). נא להעתיק את תוכן ה-XML ולהדביק בתיבת הטקסט.");
          setShowRawPaste(true);
          setLoading(false);
          return;
        }
      }
    }

    try {
      const items = parseXmlFeed(xmlContent, ratio);
      if (!items.length) {
        toast.error("לא נמצאו מוצרים בקובץ ה-XML. ודאו שמדובר בפיד תקין של Google Shopping / Meta.");
        return;
      }

      // Save preference for next time
      if (feedUrl.trim()) {
        localStorage.setItem(`woo_feed_url_${vendorId}`, feedUrl.trim());
      }
      localStorage.setItem(`woo_ratio_${vendorId}`, String(ratio));

      setParsedProducts(items);
      setStep("review");
      toast.success(`נמשכו בהצלחה ${items.length} מוצרים מהקטלוג!`);
    } catch (err: any) {
      toast.error("שגיאה בפענוח הפיד: " + (err.message || "קובץ לא תקין"));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setParsedProducts((prev) => prev.map((p) => ({ ...p, selected: select })));
  };

  const toggleProduct = (index: number) => {
    setParsedProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleConfirmImport = async () => {
    const selected = parsedProducts.filter((p) => p.selected);
    if (!selected.length) {
      toast.error("נא לבחור לפחות מוצר אחד לסנכרון");
      return;
    }

    setSaving(true);
    let createdCount = 0;
    let updatedCount = 0;

    try {
      // Fetch current vendor products from database to update or insert
      const { data: existingRows } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("vendor_id", vendorId);

      const existingByName = new Map((existingRows ?? []).map((r) => [r.name.trim().toLowerCase(), r.id]));
      const existingBySku = new Map((existingRows ?? []).map((r) => [r.sku, r.id]));

      for (const item of selected) {
        const existingId = existingByName.get(item.name.trim().toLowerCase()) || (item.sku ? existingBySku.get(item.sku) : null);

        if (existingId) {
          // Update existing product stock, price, image, description
          await supabase
            .from("products")
            .update({
              stock: item.stock,
              credit_price: item.creditPrice,
              image_url: item.imageUrl || undefined,
              description: item.description || undefined,
            })
            .eq("id", existingId);
          updatedCount++;
        } else {
          // Create new product awaiting Super Admin approval
          await supabase.from("products").insert({
            vendor_id: vendorId,
            name: item.name,
            sku: item.sku || null,
            description: item.description || null,
            category: item.category || "ווקומרס",
            image_url: item.imageUrl || null,
            credit_price: item.creditPrice,
            stock: item.stock,
            active: true,
            vendor_status: "pending", // Waiting for Super Admin approval before placing in booth
          });
          createdCount++;
        }
      }

      toast.success(
        `הסנכרון הושלם! ${createdCount} מוצרים חדשים נשלחו לאישור הנהלה, ו-${updatedCount} מוצרים עודכנו במלאי 🎉`
      );
      onSyncComplete();
      onOpenChange(false);
      setStep("configure");
    } catch (err: any) {
      toast.error("שגיאה בשמירת המוצרים: " + (err.message || "נסו שוב"));
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = parsedProducts.filter((p) => p.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 font-sans">
        <DialogHeader className="border-b border-border pb-3 text-right">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Globe className="h-6 w-6 text-primary" />
            <span>סנכרון קטלוג WooCommerce (Google Shopping / Meta Feed)</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            חברו את קטלוג הווקומרס שלכם ישירות ל-COLT Market. המערכת תמשוך תמונות, תיאורים, מלאי ותמיר שקלים לקרדיטים לפי היחס שתבחרו.
          </p>
        </DialogHeader>

        {step === "configure" ? (
          <div className="space-y-5 pt-3">
            {/* Step 1: Feed URL */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground">
                קישור לפיד קטלוג מוצרים (XML URL של Google Shopping / Meta)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://yourstore.co.il/wp-content/uploads/google-product-feed.xml"
                  dir="ltr"
                  className="flex-1 rounded-xl border-2 border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground text-left"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                זהו הקישור הרגיל שאתם מפיקים מווקומרס (ע"י תוסף Product Feed PRO, WooCommerce Google Feed וכד').
              </p>
            </div>

            {/* Step 2: Exchange Ratio */}
            <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground">יחס המרה: שקל (₪) לקרדיטים / ג'מים (💎)</span>
                <span className="rounded-full bg-primary text-primary-foreground font-mono font-bold px-2 py-0.5 text-xs">
                  1 ₪ = {ratio} קרדיטים
                </span>
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10, 20].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRatio(r);
                      setCustomRatioInput(String(r));
                    }}
                    className={`rounded-xl py-2 text-xs font-bold transition-all border ${
                      ratio === r
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-muted text-foreground border-border"
                    }`}
                  >
                    1 : {r}
                  </button>
                ))}
              </div>

              {/* Custom ratio input */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-muted-foreground">או יחס מותאם:</span>
                <span className="font-bold">1 ₪ =</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={customRatioInput}
                  onChange={(e) => {
                    setCustomRatioInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val) && val > 0) setRatio(val);
                  }}
                  className="w-20 rounded-lg border-2 border-border bg-input px-2 py-1 text-xs text-center font-bold"
                />
                <span className="text-muted-foreground">קרדיטים</span>
              </div>

              {/* Live Interactive Example Box */}
              <div className="rounded-xl bg-card border border-primary/30 p-3 text-xs space-y-1">
                <div className="font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>דוגמה לתמחור:</span>
                </div>
                <p className="text-muted-foreground">
                  מוצר שעולה <strong className="text-foreground">100 ₪</strong> בחנות הווקומרס שלך יימכר ביריד ב-
                  <strong className="text-primary text-sm font-black mx-1">
                    {(100 * ratio).toLocaleString()} קרדיטים
                  </strong>
                  (ביחס של 1 ל-{ratio}).
                </p>
              </div>
            </div>

            {/* Optional Manual XML Paste for CORS bypass */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowRawPaste(!showRawPaste)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{showRawPaste ? "הסתר הדבקת XML ידנית" : "האתר חוסם קריאה? לחצו להדבקת תוכן ה-XML ידנית"}</span>
              </button>

              {showRawPaste && (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={4}
                    value={rawXml}
                    onChange={(e) => setRawXml(e.target.value)}
                    placeholder="הדביקו כאן את תוכן קובץ ה-XML ישירות..."
                    dir="ltr"
                    className="w-full rounded-xl border-2 border-border bg-input p-2.5 text-xs font-mono text-left"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    פתחו את קישור ה-XML בדפדפן, לחצו Ctrl+A כדי להעתיק את הכל והדביקו כאן.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="chrome-panel px-4 py-2 text-xs font-bold"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={loading || (!feedUrl.trim() && !rawXml.trim())}
                onClick={handleFetchFeed}
                className="btn-plastic flex items-center gap-2 px-5 py-2.5 text-xs font-bold disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>מושך נתונים ומפענח קטלוג...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>סנכרן ומשוך מוצרים מהקטלוג ←</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Review & Confirmation Table */
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2 rounded-xl bg-muted/60 p-3 text-xs">
              <div>
                <span className="font-bold">נמצאו {parsedProducts.length} מוצרים</span>
                <span className="text-muted-foreground mx-1.5">|</span>
                <span className="text-primary font-bold">{selectedCount} מסומנים לעדכון</span>
                <span className="text-muted-foreground mx-1.5">|</span>
                <span className="font-mono text-[11px]">יחס: 1 ₪ = {ratio} קרדיטים</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="rounded-lg bg-card border border-border px-2.5 py-1 text-[11px] font-bold hover:bg-muted"
                >
                  סמן הכל
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="rounded-lg bg-card border border-border px-2.5 py-1 text-[11px] font-bold hover:bg-muted"
                >
                  נקה בחירה
                </button>
                <button
                  type="button"
                  onClick={() => setStep("configure")}
                  className="rounded-lg bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-bold hover:bg-primary/20"
                >
                  שנה הגדרות/יחס ↺
                </button>
              </div>
            </div>

            {/* Products review list */}
            <div className="max-h-[50vh] overflow-y-auto space-y-2 border rounded-2xl p-2 bg-card">
              {parsedProducts.map((p, idx) => (
                <div
                  key={p.id + idx}
                  onClick={() => toggleProduct(idx)}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all cursor-pointer ${
                    p.selected
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "border-border/60 bg-muted/20 opacity-60 hover:opacity-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(p.selected)}
                    onChange={() => toggleProduct(idx)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                  />

                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">—</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-black text-foreground">{p.name}</span>
                      {p.isExisting ? (
                        <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.2 text-[9px] font-bold shrink-0">
                          מוצר קיים (יעודכן מלאי)
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.2 text-[9px] font-bold shrink-0">
                          חדש (לאישור)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>מחיר מקורי: {p.priceILS} ₪</span>
                      <span>·</span>
                      <span className="text-primary font-bold">מחיר ביריד: 💎 {p.creditPrice}</span>
                      <span>·</span>
                      <span>מלאי: {p.stock}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              ℹ️ <strong>שימו לב:</strong> לאחר שתאשרו, המוצרים החדשים יעלו לסטטוס ״ממתין לאישור הנהלה״.
              הסופר אדמין יאשר את המוצרים וישבץ אותם בדוכנים שלכם ביריד. מוצרים קיימים יתעדכנו מיידית במלאי ובמחיר.
            </div>

            {/* Confirm buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStep("configure")}
                className="chrome-panel px-4 py-2 text-xs font-bold"
              >
                ← חזרה להגדרות
              </button>
              <button
                type="button"
                disabled={saving || selectedCount === 0}
                onClick={handleConfirmImport}
                className="btn-plastic flex items-center gap-2 px-6 py-2.5 text-xs font-bold disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>שומר ומעלה לאישור הנהלה...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>אשר והעלה {selectedCount} מוצרים לאישור הנהלת COLT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
