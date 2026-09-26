// Server-only WooCommerce gateway helpers.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/woocommerce";

function creds() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const wooKey = process.env.WOOCOMMERCE_API_KEY;
  if (!lovableKey || !wooKey) {
    throw new Error("WooCommerce connection is not configured (missing LOVABLE_API_KEY / WOOCOMMERCE_API_KEY)");
  }
  return { lovableKey, wooKey };
}

export async function wooFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | number> },
): Promise<T> {
  const { lovableKey, wooKey } = creds();
  const qs = init?.query
    ? "?" + new URLSearchParams(Object.entries(init.query).map(([k, v]) => [k, String(v)])).toString()
    : "";
  const res = await fetch(`${GATEWAY_URL}${path}${qs}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": wooKey,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[woocommerce] ${init?.method ?? "GET"} ${path} failed [${res.status}]: ${text}`);
    throw new Error(`WooCommerce request failed [${res.status}]: ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

export type WooProduct = {
  id: number;
  name: string;
  sku: string;
  permalink: string;
  description: string;
  short_description: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  categories: { name: string }[];
  tags: { name: string }[];
  brands?: { name: string }[];
  images: { src: string }[];
};

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

/** A Woo product is importable only when it is actually in stock. */
export function wooInStock(p: WooProduct): boolean {
  if (p.stock_status !== "instock") return false;
  if (p.manage_stock) return (p.stock_quantity ?? 0) > 0;
  return true;
}

export async function fetchAllWooProducts(maxPages = 20): Promise<WooProduct[]> {
  const all: WooProduct[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await wooFetch<WooProduct[]>("/products", {
      query: { per_page: 100, page, status: "publish", stock_status: "instock" },
    });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}
