import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MarketCountry } from "@/lib/market";
import { resolvePosForOrder } from "@/lib/pos-scope";
import { directionFromCity, type StaffDirection } from "@/lib/staff-scope";

export type StockMap = Record<string, number>;

export function marketCountryToScope(country: MarketCountry): StaffDirection {
  return country === "CG" ? "brazzaville" : "kinshasa";
}

type OrderStockItem = {
  slug?: string;
  name?: string;
  variantId?: string;
  qty: number;
};

async function resolveVariantId(
  supabaseAdmin: any,
  item: OrderStockItem,
): Promise<{ variantId: string; productId: string; label: string } | null> {
  const variantId = item.variantId?.trim();
  if (variantId) {
    const { data: variant } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id")
      .eq("id", variantId)
      .maybeSingle();
    if (variant?.id) {
      return {
        variantId: variant.id,
        productId: variant.product_id,
        label: item.name ?? "Produit",
      };
    }
  }
  if (item.slug) {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("slug", item.slug)
      .maybeSingle();
    if (!product?.id) return null;
    const { data: variant } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id")
      .eq("product_id", product.id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (variant?.id) {
      return {
        variantId: variant.id,
        productId: variant.product_id,
        label: item.name ?? "Produit",
      };
    }
  }
  return null;
}

export async function fetchStockForScope(
  supabaseAdmin: any,
  cityScope: StaffDirection | string | null,
  managerUserId?: string | null,
): Promise<StockMap> {
  const posId = await resolvePosForOrder(supabaseAdmin, cityScope, managerUserId);
  if (!posId) return {};
  const { data, error } = await supabaseAdmin
    .from("stock")
    .select("variant_id, quantity")
    .eq("pos_id", posId);
  if (error) throw new Error(error.message);
  const map: StockMap = {};
  for (const row of data ?? []) {
    if (row.variant_id) map[row.variant_id] = Number(row.quantity ?? 0);
  }
  return map;
}

export async function assertOrderStockAvailable(
  supabaseAdmin: any,
  posId: string | null,
  items: OrderStockItem[],
) {
  if (!posId) throw new Error("Aucun point de vente configuré pour cette ville — stock indisponible");
  if (!items.length) return;

  const needed = new Map<string, { qty: number; label: string }>();
  for (const item of items) {
    const resolved = await resolveVariantId(supabaseAdmin, item);
    if (!resolved) throw new Error(`Produit introuvable : ${item.name ?? "article"}`);
    const prev = needed.get(resolved.variantId);
    needed.set(resolved.variantId, {
      qty: (prev?.qty ?? 0) + Math.max(1, Number(item.qty ?? 1)),
      label: item.name ?? prev?.label ?? resolved.label,
    });
  }

  for (const [variantId, { qty, label }] of needed) {
    const { data: stock } = await supabaseAdmin
      .from("stock")
      .select("quantity")
      .eq("variant_id", variantId)
      .eq("pos_id", posId)
      .maybeSingle();
    const available = Number(stock?.quantity ?? 0);
    if (available <= 0) {
      throw new Error(`${label} — fini en stock`);
    }
    if (available < qty) {
      throw new Error(`${label} — stock insuffisant (disponible : ${available})`);
    }
  }
}

export const getPublicStockForMarket = createServerFn({ method: "GET" })
  .inputValidator((d: { countryCode: MarketCountry }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = marketCountryToScope(data.countryCode);
    return fetchStockForScope(supabaseAdmin, scope);
  });

export const getStaffStockForCity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { country_code: string; city: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = directionFromCity(data.city, data.country_code);
    return fetchStockForScope(supabaseAdmin, scope);
  });

export function stockLabel(available: number) {
  if (available <= 0) return "Fini en stock";
  if (available <= 5) return `Plus que ${available} en stock`;
  return `${available} en stock`;
}

export function isInStock(available: number | undefined) {
  return Number(available ?? 0) > 0;
}
