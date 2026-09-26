import { createFileRoute } from "@tanstack/react-router";

function paypalIpnValidateUrl() {
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  return env === "live"
    ? "https://ipnpb.paypal.com/cgi-bin/webscr"
    : "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr";
}

function normalizeEmail(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

export const Route = createFileRoute("/api/public/paypal/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        // Step 1: verify authenticity with PayPal
        const verifyRes = await fetch(paypalIpnValidateUrl(), {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "astratego-ipn-verifier",
          },
          body: `cmd=_notify-validate&${rawBody}`,
        });
        const verifyText = (await verifyRes.text()).trim();
        if (verifyText !== "VERIFIED") {
          console.error("[paypal-ipn] not verified:", verifyText);
          return new Response("INVALID", { status: 200 });
        }

        // Step 2: parse fields from the raw body PayPal sent us
        const fields = new URLSearchParams(rawBody);
        const paymentStatus = fields.get("payment_status") ?? "";
        const receiverEmail = normalizeEmail(fields.get("receiver_email") ?? fields.get("business"));
        const custom = fields.get("custom") ?? "";
        const txnId = fields.get("txn_id") ?? "";
        const mcGross = Number(fields.get("mc_gross") ?? "0");
        const mcCurrency = (fields.get("mc_currency") ?? "").toUpperCase();

        // Step 3: check merchant identity
        const expectedEmail = normalizeEmail(process.env.PAYPAL_MERCHANT_EMAIL);
        if (!expectedEmail || receiverEmail !== expectedEmail) {
          console.error("[paypal-ipn] receiver mismatch", { receiverEmail });
          return new Response("EMAIL_MISMATCH", { status: 200 });
        }

        if (!custom) {
          console.error("[paypal-ipn] missing custom token");
          return new Response("NO_TOKEN", { status: 200 });
        }

        // Step 4: privileged DB access (verified webhook only)
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: if we already saw this txn_id, ack and stop.
        if (txnId) {
          const { data: existing } = await supabaseAdmin
            .from("orders")
            .select("id, payment_status")
            .eq("payment_reference", txnId)
            .maybeSingle();
          if (existing?.payment_status === "paid") {
            return new Response("OK_DUP", { status: 200 });
          }
        }

        const { data: order, error: oErr } = await supabaseAdmin
          .from("orders")
          .select("id, payment_status, credit_package_id, cash_amount, currency")
          .eq("payment_token", custom)
          .maybeSingle();
        if (oErr || !order) {
          console.error("[paypal-ipn] order not found", { custom, oErr });
          return new Response("NO_ORDER", { status: 200 });
        }

        // Amount / currency sanity: must match the pack we recorded
        const expectedAmount = Number(order.cash_amount ?? 0);
        const expectedCurrency = (order.currency ?? "ILS").toUpperCase();
        if (
          !Number.isFinite(mcGross) ||
          Math.abs(mcGross - expectedAmount) > 0.01 ||
          mcCurrency !== expectedCurrency
        ) {
          console.error("[paypal-ipn] amount/currency mismatch", {
            mcGross,
            expectedAmount,
            mcCurrency,
            expectedCurrency,
          });
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "failed", status: "failed" })
            .eq("id", order.id);
          return new Response("AMOUNT_MISMATCH", { status: 200 });
        }

        if (paymentStatus !== "Completed") {
          // Refunds/reversals/pending — record but do not credit.
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status:
                paymentStatus === "Pending"
                  ? "pending"
                  : paymentStatus === "Refunded" || paymentStatus === "Reversed"
                    ? "refunded"
                    : "failed",
              payment_reference: txnId || null,
            })
            .eq("id", order.id);
          return new Response(`OK_${paymentStatus}`, { status: 200 });
        }

        // Step 5: credit gems atomically via SECURITY DEFINER RPC
        const { error: rpcErr } = await supabaseAdmin.rpc("credit_gem_pack", {
          _order_id: order.id,
          _reference: txnId || "",
        });
        if (rpcErr) {
          console.error("[paypal-ipn] credit_gem_pack failed", rpcErr);
          return new Response("CREDIT_FAILED", { status: 500 });
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
