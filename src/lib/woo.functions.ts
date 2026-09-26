import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Import every in-stock WooCommerce product into the game catalog.
 * Products that already exist in the game (same name, case-insensitive) are skipped.
 */
export const importWooProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Forbidden: owner role required");

    const { fetchAllWooProducts, wooInStock, stripHtml } = await import("./woo.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Owner-configurable sync rules (game_settings.extra.woo_rules)
    const { data: settings } = await supabaseAdmin.from("game_settings").select("extra").eq("id", 1).maybeSingle();
    const rules = {
      price_multiplier: 10,
      rounding: "ceil" as "ceil" | "round" | "nearest10",
      default_store_id: null as string | null,
      extra_tags: ["colt marketplace"] as string[],
      default_category: null as string | null,
      ...(((settings?.extra as Record<string, unknown> | null)?.["woo_rules"] as Record<string, unknown>) ?? {}),
    };
    const toGems = (value: number): number => {
      const raw = value * (Number(rules.price_multiplier) || 1);
      const rounded =
        rules.rounding === "round"
          ? Math.round(raw)
          : rules.rounding === "nearest10"
            ? Math.ceil(raw / 10) * 10
            : Math.ceil(raw);
      return Math.max(1, rounded);
    };

    const wooProducts = (await fetchAllWooProducts()).filter(wooInStock);

    const { data: existing } = await supabaseAdmin.from("products").select("name, woo_product_id");
    const existingNames = new Set((existing ?? []).map((p) => (p.name ?? "").trim().toLowerCase()));
    const existingWooIds = new Set(
      (existing ?? []).map((p) => p.woo_product_id).filter((v): v is number => v != null),
    );

    const rows: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const p of wooProducts) {
      const key = p.name.trim().toLowerCase();
      if (existingNames.has(key) || existingWooIds.has(p.id)) {
        skipped++;
        continue;
      }
      existingNames.add(key);
      const price = Number(p.price || p.regular_price || 0);
      const regular = p.regular_price ? Number(p.regular_price) : null;
      const sale = p.sale_price ? Number(p.sale_price) : null;
      rows.push({
        name: p.name.trim(),
        sku: p.sku || null,
        description: stripHtml(p.short_description) ?? stripHtml(p.description),
        category: p.categories?.[0]?.name ?? rules.default_category ?? null,
        subcategory: p.categories?.[1]?.name ?? null,
        brand: p.brands?.[0]?.name ?? null,
        store_id: rules.default_store_id ?? null,
        tags: Array.from(new Set([...(p.tags ?? []).map((t) => t.name), ...(rules.extra_tags ?? [])])),
        product_type: "physical",
        credit_price: toGems(price),
        sale_credit_price: sale ? toGems(sale) : null,
        regular_price: regular,
        sale_price: sale,
        external_url: p.permalink,
        image_url: p.images?.[0]?.src ?? null,
        gallery: (p.images ?? []).slice(1).map((i) => i.src),
        stock: p.manage_stock ? (p.stock_quantity ?? 0) : null,
        unlimited_stock: !p.manage_stock,
        woo_product_id: p.id,
        woo_synced_at: new Date().toISOString(),
        active: true,
      });
    }

    let imported = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabaseAdmin.from("products").insert(chunk as never);
      if (error) throw new Error(error.message);
      imported += chunk.length;
    }

    return { ok: true, imported, skipped, scanned: wooProducts.length };
  });

/**
 * Push the game's current stock for a product back to WooCommerce.
 * Called after a purchase / wheel / mystery-box win so the website stays in sync.
 * When stock hits 0 the product is marked out of stock on the website and
 * deactivated in the game so nobody can buy or win it again.
 */
export const syncWooStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { product_id: string }) => {
    if (!data?.product_id) throw new Error("product_id required");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, stock, unlimited_stock, woo_product_id, active")
      .eq("id", data.product_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product?.woo_product_id) return { ok: true, synced: false };

    const stock = product.unlimited_stock ? null : Math.max(0, product.stock ?? 0);
    const outOfStock = stock !== null && stock <= 0;

    if (outOfStock && product.active) {
      await supabaseAdmin.from("products").update({ active: false }).eq("id", product.id);
    }

    const { wooFetch } = await import("./woo.server");
    await wooFetch(`/products/${product.woo_product_id}`, {
      method: "PUT",
      body: product.unlimited_stock
        ? { manage_stock: false, stock_status: "instock" }
        : { manage_stock: true, stock_quantity: stock, stock_status: outOfStock ? "outofstock" : "instock" },
    });

    await supabaseAdmin
      .from("products")
      .update({ woo_synced_at: new Date().toISOString() })
      .eq("id", product.id);

    return { ok: true, synced: true, stock, out_of_stock: outOfStock };
  });
