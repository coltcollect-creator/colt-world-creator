import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Sparkles, ShoppingBag, Coins } from "lucide-react";

interface Props {
  npc: any;
  onClose: () => void;
}

export function MysteryVendorModal({ npc, onClose }: Props) {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadVendorItems() {
      try {
        setLoading(true);
        // Load vendor products configured on NPC
        const prodIds: string[] = npc?.vendor_product_ids || [];
        if (prodIds.length > 0) {
          const { data } = await supabase.from("products").select("*").in("id", prodIds);
          if (data && data.length > 0) {
            setProducts(data);
            setLoading(false);
            return;
          }
        }
        // Fallback: fetch general products marked or top featured
        const { data } = await supabase.from("products").select("*").eq("active", true).limit(6);
        setProducts(data || []);
      } catch (err) {
        console.error("Error loading mystery vendor items:", err);
      } finally {
        setLoading(false);
      }
    }
    loadVendorItems();
  }, [npc]);

  const handleBuy = async (prod: any) => {
    if (!user || buyingId) return;
    const price = Number(prod.credit_price || prod.sale_credit_price || 0);
    const userCredits = Number(profile?.credits || 0);

    if (userCredits < price) {
      toast.error(`אין לך מספיק ג׳מס! דרוש: ${price} 💎, יש לך: ${userCredits} 💎`);
      return;
    }

    try {
      setBuyingId(prod.id);
      // Deduct credits
      const { error } = await supabase
        .from("profiles")
        .update({ credits: userCredits - price } as never)
        .eq("id", user.id);

      if (error) throw error;

      // Create order entry
      await supabase.from("orders").insert({
        user_id: user.id,
        items: [{ id: prod.id, name: prod.name, price, quantity: 1 }],
        total_credits: price,
        status: "completed",
        notes: `רכישה מסוחר מסתורי (${npc?.name || "סוחר מסתורי"})`,
      } as never);

      toast.success(`רכשת את ${prod.name} בהצלחה מהסוחר המסתורי! 🎁`);
    } catch (err: any) {
      toast.error(err?.message || "שגיאה ברכישה");
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-2 border-amber-500/50 text-white rounded-3xl p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-2xl">
              🕵️
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-amber-300">
                {npc?.name || "הסוחר המסתורי"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                סוחר נודד המציע מוצרים נקודתיים ומיוחדים לאספנים אמיצים!
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold">
          <span className="text-muted-foreground">היתרה שלך:</span>
          <span className="flex items-center gap-1 text-amber-400">
            <Coins className="w-4 h-4" />
            {Number(profile?.credits || 0).toLocaleString()} 💎 ג׳מס
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">הסוחר בודק את המלאי בתיקו...</div>
        ) : products.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            הסוחר המסתורי אזל מהמלאי כרגע. חזרו מאוחר יותר!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 mt-2">
            {products.map((p) => {
              const price = Number(p.sale_credit_price || p.credit_price || 0);
              return (
                <div key={p.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col justify-between">
                  <div>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-24 object-contain rounded-xl bg-slate-950/40 p-1 mb-2" />
                    ) : (
                      <div className="w-full h-24 rounded-xl bg-slate-950/40 flex items-center justify-center text-3xl mb-2">
                        📦
                      </div>
                    )}
                    <h5 className="text-xs font-bold truncate text-white">{p.name}</h5>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{p.description || "מוצר מסתורי בלעדי"}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400">{price} 💎</span>
                    <Button
                      size="sm"
                      onClick={() => handleBuy(p)}
                      disabled={buyingId === p.id}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-2.5 py-1 h-7 rounded-lg"
                    >
                      {buyingId === p.id ? "קונה..." : "קנה"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
