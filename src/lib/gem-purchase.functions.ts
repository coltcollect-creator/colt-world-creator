import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function paypalBaseUrl() {
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
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
    const origin = sanitizeOrigin(data.return_origin);
    if (!origin) throw new Error("invalid return_origin");

    const { data: pkg, error: pErr } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", data.package_id)
      .eq("active", true)
      .maybeSingle();
    if (pErr || !pkg) throw new Error("package not found");

    const token = randomToken();

    // Privileged insert: RLS on orders restricts INSERT to owners, but this
    // is a verified authenticated purchase — the caller is `userId` (from
    // requireSupabaseAuth) and we write only their own row.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        order_type: "gem_pack",
        status: "pending",
        credit_package_id: pkg.id,
        credits_charged: 0,
        cash_amount: pkg.price,
        currency: pkg.currency ?? "ILS",
        payment_provider: "paypal",
        payment_status: "pending",
        payment_token: token,
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "order create failed");

    const merchantEmail = process.env.PAYPAL_MERCHANT_EMAIL;
    if (!merchantEmail) throw new Error("paypal not configured");

    const params = new URLSearchParams({
      cmd: "_xclick",
      business: merchantEmail,
      item_name: pkg.name,
      item_number: order.id,
      amount: Number(pkg.price).toFixed(2),
      currency_code: (pkg.currency ?? "ILS").toUpperCase(),
      quantity: "1",
      custom: token,
      no_shipping: "1",
      no_note: "1",
      charset: "utf-8",
      notify_url: `${origin}/api/public/paypal/ipn`,
      return: `${origin}/api/public/paypal/return?order=${order.id}`,
      cancel_return: `${origin}/payment/cancel?order=${order.id}`,
      rm: "1",
    });

    return {
      order_id: order.id,
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
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, payment_status, status, credit_package_id, cash_amount, currency")
      .eq("id", data.order_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("order not found");
    return order;
  });
