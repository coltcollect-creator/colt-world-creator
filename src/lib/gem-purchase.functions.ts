import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

const DEFAULT_PAYPAL_EMAIL = "info@astratego.com";
const DEFAULT_PAYPAL_ENV = "live";

function paypalBaseUrl() {
  const env = (process.env.PAYPAL_ENV ?? DEFAULT_PAYPAL_ENV).toLowerCase();
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

export const createGemPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { package_id: string; return_origin: string }) => {
    if (!input?.package_id) throw new Error("package_id required");
    if (!input?.return_origin) throw new Error("return_origin required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const origin = sanitizeOrigin(data.return_origin) || "https://ais-pre-lwecgyw2izqawzqb72q6uf-372886588343.europe-west2.run.app";

    // Lookup package directly from Firestore or through query
    let pkg: any = null;

    if (db && data.package_id) {
      try {
        const snap = await getDoc(doc(db, "credit_packages", data.package_id));
        if (snap.exists()) {
          pkg = { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("[createGemPurchase] direct getDoc failed:", err);
      }

      if (!pkg) {
        try {
          const snapAll = await getDocs(collection(db, "credit_packages"));
          for (const d of snapAll.docs) {
            if (d.id === data.package_id || String(d.id) === String(data.package_id)) {
              pkg = { id: d.id, ...d.data() };
              break;
            }
          }
        } catch (err) {
          console.warn("[createGemPurchase] getDocs failed:", err);
        }
      }
    }

    if (!pkg) {
      const { data: directPkg } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("id", data.package_id)
        .maybeSingle();

      if (directPkg) {
        pkg = directPkg;
      } else {
        // Search all packages
        const { data: allPacks } = await supabase.from("credit_packages").select("*");
        pkg = (allPacks || []).find((p: any) => String(p.id) === String(data.package_id));
      }
    }

    if (!pkg) {
      throw new Error("חבילת קרדיטים לא נמצאה");
    }

    const orderId = crypto.randomUUID();
    const token = randomToken();
    const effectiveUserId = userId || "anonymous-buyer";
    const orderNumber = Math.floor(100000 + Math.random() * 900000);

    const orderPayload = {
      id: orderId,
      user_id: effectiveUserId,
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

    const { error: oErr } = await supabase.from("orders").insert(orderPayload);
    if (oErr) {
      console.error("[createGemPurchase] order insert error", oErr);
    }

    const merchantEmail = process.env.PAYPAL_MERCHANT_EMAIL || DEFAULT_PAYPAL_EMAIL;

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
      return: `${origin}/api/public/paypal/return?order=${orderId}`,
      cancel_return: `${origin}/payment/cancel?order=${orderId}`,
      rm: "1",
    });

    return {
      order_id: orderId,
      paypal_url: `${paypalBaseUrl()}?${params.toString()}`,
    };
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => {
    if (!input?.order_id) throw new Error("order_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, payment_status, status, credit_package_id, cash_amount, currency")
      .eq("id", data.order_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) throw new Error("order not found");
    return order;
  });
