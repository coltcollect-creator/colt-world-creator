import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paypal/return")({
  server: {
    handlers: {
      // PayPal may use GET or POST depending on the "rm" setting
      GET: async ({ request }) => redirectToSuccess(request),
      POST: async ({ request }) => redirectToSuccess(request),
    },
  },
});

async function redirectToSuccess(request: Request) {
  const url = new URL(request.url);
  let order = url.searchParams.get("order") ?? "";
  if (!order && request.method === "POST") {
    try {
      const body = await request.text();
      const fields = new URLSearchParams(body);
      order = fields.get("item_number") ?? "";
    } catch {}
  }
  const dest = new URL("/payment/success", url.origin);
  if (order) dest.searchParams.set("order", order);
  return Response.redirect(dest.toString(), 303);
}
