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
  variant_id?: string;
  qty: number;
};

export async function resolveVariantId(
  supabaseAdmin: any,
  item: OrderStockItem,
): Promise<{ variantId: string; productId: string; label: string } | null> {
  const rawId = (item.variantId ?? item.variant_id)?.trim();
  if (rawId) {
    const { data: variant } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id")
      .eq("id", rawId)
      .maybeSingle();
    if (variant?.id) {
      return {
        variantId: variant.id,
        productId: variant.product_id,
        label: item.name ?? "Produit",
      };
    }
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("id", rawId)
      .maybeSingle();
    if (product?.id) {
      const { data: fallbackVariant } = await supabaseAdmin
        .from("product_variants")
        .select("id, product_id")
        .eq("product_id", product.id)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (fallbackVariant?.id) {
        return {
          variantId: fallbackVariant.id,
          productId: product.id,
          label: item.name ?? "Produit",
        };
      }
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

type DeliveryLine = {
  variantId: string;
  productId: string;
  qty: number;
  label: string;
};

async function hasDeliveryStockMovements(supabaseAdmin: any, orderNumber: string) {
  const { count, error } = await supabaseAdmin
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .or(`reason.like.Livraison commande ${orderNumber}%,reason.like.Rattrapage livraison ${orderNumber}%`);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function resolveDeliveryLines(supabaseAdmin: any, items: OrderStockItem[]) {
  const lines: DeliveryLine[] = [];
  for (const item of items) {
    const qty = Math.max(0, Number(item.qty ?? 0));
    if (qty <= 0) continue;
    const resolved = await resolveVariantId(supabaseAdmin, item);
    if (!resolved) throw new Error(`Produit introuvable : ${item.name ?? "article"}`);
    lines.push({ ...resolved, qty });
  }
  return lines;
}

/** Déduit le stock et marque la commande livrée — même logique pour manager et livreur. */
export async function deliverOrderWithStock(
  supabaseAdmin: any,
  orderId: string,
  actorId: string,
) {
  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!order) throw new Error("Commande introuvable");
  if (order.status === "cancelled") throw new Error("Impossible de livrer une commande annulée");

  let posId = order.pos_id as string | null;
  if (!posId && order.city_scope) {
    posId = await resolvePosForOrder(supabaseAdmin, order.city_scope);
    if (posId) {
      const { error: posErr } = await supabaseAdmin.from("orders").update({ pos_id: posId }).eq("id", orderId);
      if (posErr) throw new Error(posErr.message);
    }
  }
  if (!posId) throw new Error("Aucun POS associé à cette commande");

  let needsDecrement = !order.stock_decremented;
  if (order.stock_decremented) {
    const hasMovements = await hasDeliveryStockMovements(supabaseAdmin, order.order_number);
    if (hasMovements) {
      needsDecrement = false;
    } else {
      const { error: resetErr } = await supabaseAdmin
        .from("orders")
        .update({ stock_decremented: false })
        .eq("id", orderId);
      if (resetErr) throw new Error(resetErr.message);
      needsDecrement = true;
    }
  }

  const items = (Array.isArray(order.items) ? order.items : []) as OrderStockItem[];

  if (needsDecrement) {
    if (items.length === 0) {
      const { error: flagErr } = await supabaseAdmin
        .from("orders")
        .update({ stock_decremented: true })
        .eq("id", orderId);
      if (flagErr) throw new Error(flagErr.message);
    } else {
      const lines = await resolveDeliveryLines(supabaseAdmin, items);

      for (const line of lines) {
        const { data: stock, error: stockErr } = await supabaseAdmin
          .from("stock")
          .select("quantity")
          .eq("variant_id", line.variantId)
          .eq("pos_id", posId)
          .maybeSingle();
        if (stockErr) throw new Error(stockErr.message);
        const available = Number(stock?.quantity ?? 0);
        if (!stock) throw new Error(`Stock POS non configuré pour ${line.label}`);
        if (available < line.qty) {
          throw new Error(`${line.label} — stock insuffisant (disponible : ${available})`);
        }
      }

      for (const line of lines) {
        const { data: stock, error: stockErr } = await supabaseAdmin
          .from("stock")
          .select("quantity")
          .eq("variant_id", line.variantId)
          .eq("pos_id", posId)
          .maybeSingle();
        if (stockErr) throw new Error(stockErr.message);
        let available = Number(stock?.quantity ?? 0);
        if (!stock) {
          const { error: insertErr } = await supabaseAdmin.from("stock").insert({
            product_id: line.productId,
            variant_id: line.variantId,
            pos_id: posId,
            quantity: 0,
            low_stock_threshold: 5,
          });
          if (insertErr) throw new Error(insertErr.message);
          available = 0;
        }
        const nextQty = available - line.qty;

        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("stock")
          .update({ quantity: nextQty, updated_at: new Date().toISOString() })
          .eq("variant_id", line.variantId)
          .eq("pos_id", posId)
          .select("quantity")
          .maybeSingle();
        if (updateErr) throw new Error(updateErr.message);
        if (!updated || Number(updated.quantity) !== nextQty) {
          throw new Error(`Échec déduction stock pour ${line.label}`);
        }

        const { error: moveErr } = await supabaseAdmin.from("stock_movements").insert({
          product_id: line.productId,
          variant_id: line.variantId,
          pos_id: posId,
          delta: -line.qty,
          reason: `Livraison commande ${order.order_number}`,
          created_by: actorId,
        });
        if (moveErr) throw new Error(moveErr.message);
      }

      const { error: flagErr } = await supabaseAdmin
        .from("orders")
        .update({ stock_decremented: true })
        .eq("id", orderId);
      if (flagErr) throw new Error(flagErr.message);
    }
  }

  if (order.status !== "delivered") {
    const { error: statusErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "delivered",
        delivered_at: order.delivered_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (statusErr) throw new Error(statusErr.message);
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
