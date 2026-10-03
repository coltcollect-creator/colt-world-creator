import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, setDoc } from "firebase/firestore";
import { supabase, cleanForFirestore } from "@/integrations/supabase/client";

const DEFAULT_PAYPAL_EMAIL = "info@astratego.com";
const DEFAULT_PAYPAL_ENV = "live";

export function paypalBaseUrl() {
  const env = (typeof process !== "undefined" && process.env?.PAYPAL_ENV ? process.env.PAYPAL_ENV : DEFAULT_PAYPAL_ENV).toLowerCase();
  return env === "live"
    ? "https://www.paypal.com/cgi-bin/webscr"
    : "https://www.sandbox.paypal.com/cgi-bin/webscr";
}

function sanitizeOrigin(input: string | undefined): string {
  if (!input) return "";
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Client-safe order creation that works anywhere (Static Firebase Hosting, Dev, SSR)
export async function initiateGemPurchase(packageId: string): Promise<{ order_id: string; paypal_url: string }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gen-lang-client-0990466400.web.app";

  let pkg: any = null;

  if (db && packageId) {
    try {
      const snap = await getDoc(doc(db, "credit_packages", packageId));
      if (snap.exists()) {
        pkg = { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.warn("Direct package lookup error", e);
    }

    if (!pkg) {
      try {
        const snapAll = await getDocs(collection(db, "credit_packages"));
        for (const d of snapAll.docs) {
          if (d.id === packageId || String(d.id) === String(packageId)) {
            pkg = { id: d.id, ...d.data() };
            break;
          }
        }
      } catch (e) {
        console.warn("Collection package lookup error", e);
      }
    }
  }

  if (!pkg) {
    const { data: allPacks } = await supabase.from("credit_packages").select("*");
    pkg = (allPacks || []).find((p: any) => String(p.id) === String(packageId));
  }

  if (!pkg) {
    throw new Error("חבילת קרדיטים לא נמצאה");
  }

  let userId = "guest";
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) userId = authData.user.id;
  } catch {}

  const orderId = crypto.randomUUID();
  const token = randomToken();
  const orderNumber = Math.floor(100000 + Math.random() * 900000);

  const orderPayload = {
    id: orderId,
    user_id: userId,
    order_number: orderNumber,
    order_type: "gem_pack",
    status: "pending",
    credit_package_id: pkg.id,
    credits_charged: 0,
    cash_amount: Number(pkg.price || 0),
    currency: (pkg.currency || "ILS").toUpperCase(),
    payment_provider: "paypal",
    payment_status: "pending",
    payment_token: token,
    created_at: new Date().toISOString(),
  };

  if (db) {
    try {
      await setDoc(doc(db, "orders", orderId), cleanForFirestore(orderPayload));
    } catch (e) {
      console.warn("Firestore order setDoc error", e);
    }
  }

  await supabase.from("orders").insert(orderPayload);

  const merchantEmail = DEFAULT_PAYPAL_EMAIL;
  const params = new URLSearchParams({
    cmd: "_xclick",
    business: merchantEmail,
    item_name: pkg.name || `חבילת ${pkg.credit_amount} קרדיטים`,
    item_number: orderId,
    amount: Number(pkg.price).toFixed(2),
    currency_code: (pkg.currency ?? "ILS").toUpperCase(),
    quantity: "1",
    custom: token,
    no_shipping: "1",
    no_note: "1",
    charset: "utf-8",
    notify_url: `${origin}/api/public/paypal/ipn`,
    return: `${origin}/payment/success?order=${orderId}`,
    cancel_return: `${origin}/payment/cancel?order=${orderId}`,
    rm: "1",
  });

  return {
    order_id: orderId,
    paypal_url: `${paypalBaseUrl()}?${params.toString()}`,
  };
}

export async function fetchClientOrderStatus(orderId: string): Promise<any> {
  if (db && orderId) {
    try {
      const snap = await getDoc(doc(db, "orders", orderId));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch {}
  }

  const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  return data;
}

export const createGemPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { package_id: string; return_origin: string }) => {
    if (!input?.package_id) throw new Error("package_id required");
    if (!input?.return_origin) throw new Error("return_origin required");
    return input;
  })
  .handler(async ({ data, context }) => {
    return await initiateGemPurchase(data.package_id);
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => {
    if (!input?.order_id) throw new Error("order_id required");
    return input;
  })
  .handler(async ({ data }) => {
    const order = await fetchClientOrderStatus(data.order_id);
    if (!order) throw new Error("order not found");
    return order;
  });
