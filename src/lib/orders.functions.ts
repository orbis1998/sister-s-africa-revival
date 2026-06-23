import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { directionFromCity } from "@/lib/staff-scope";
import { resolvePosForOrder } from "@/lib/pos-scope";
import { assertOrderStockAvailable } from "@/lib/stock.functions";

type Status = "received" | "preparing" | "ready" | "en_route" | "delivered" | "cancelled";

async function getRoles(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: any) => r.role as string);
}

async function getProfileScope(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("city_scope")
    .eq("id", userId)
    .maybeSingle();
  return data?.city_scope ?? null;
}

async function ensureManagerOrderAccess(supabaseAdmin: any, roles: string[], userId: string) {
  if (!roles.includes("manager") || roles.includes("admin")) return;
  const { data } = await supabaseAdmin
    .from("manager_permissions")
    .select("can_manage_orders, can_manage_logistics")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.can_manage_orders && !data?.can_manage_logistics) throw new Error("Forbidden: accès commandes non autorisé");
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: {
    customer_name: string; customer_phone: string;
    country_code: string; country_name: string;
    city: string; commune: string; address: string;
    delivery_zone?: string;
    delivery_date?: string; delivery_time?: string;
    notes?: string;
    items: Array<{ slug: string; name: string; variantId: string; variantLabel: string; qty: number; priceUsd: number; priceFcfa: number }>;
    total_fcfa: number; total_usd: number;
    delivery_fee_fcfa?: number; delivery_fee_usd?: number;
  }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const city_scope = directionFromCity(data.city, data.country_code);
    const pos_id = await resolvePosForOrder(supabaseAdmin, city_scope);
    await assertOrderStockAvailable(supabaseAdmin, pos_id, data.items);
    const { data: row, error } = await supabaseAdmin.from("orders").insert({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      country_code: data.country_code,
      country_name: data.country_name,
      city: data.city,
      city_scope,
      pos_id,
      commune: data.commune,
      delivery_zone: data.delivery_zone ?? "",
      address: data.address,
      delivery_date: data.delivery_date ?? null,
      delivery_time: data.delivery_time ?? null,
      notes: data.notes ?? null,
      items: data.items,
      total_fcfa: data.total_fcfa,
      total_usd: data.total_usd,
      delivery_fee_fcfa: data.delivery_fee_fcfa ?? 0,
      delivery_fee_usd: data.delivery_fee_usd ?? 0,
    }).select("order_number, id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createStaffOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    customer_name: string; customer_phone: string;
    country_code: string; country_name: string;
    city: string; commune: string; address: string;
    delivery_zone?: string;
    delivery_date?: string; delivery_time?: string;
    notes?: string; assigned_to?: string | null;
    items?: Array<{ slug?: string; name: string; variantId?: string; variantLabel?: string; qty: number; priceUsd?: number; priceFcfa?: number }>;
    total_fcfa: number; total_usd: number;
    delivery_fee_fcfa?: number; delivery_fee_usd?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((r: string) => ["admin", "manager"].includes(r))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureManagerOrderAccess(supabaseAdmin, roles, ctx.userId);
    const city_scope = directionFromCity(data.city, data.country_code);
    const pos_id = await resolvePosForOrder(supabaseAdmin, city_scope, ctx.userId);

    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      if (!scope || city_scope !== scope) throw new Error("Forbidden: commande hors direction");
      if (data.assigned_to) {
        const { data: driver } = await supabaseAdmin.from("profiles").select("city_scope").eq("id", data.assigned_to).maybeSingle();
        if (driver?.city_scope !== scope) throw new Error("Forbidden: livreur hors direction");
      }
    }

    await assertOrderStockAvailable(supabaseAdmin, pos_id, data.items?.length ? data.items : []);

    const { data: row, error } = await supabaseAdmin.from("orders").insert({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      country_code: data.country_code,
      country_name: data.country_name,
      city: data.city,
      city_scope,
      pos_id,
      commune: data.commune,
      delivery_zone: data.delivery_zone ?? "",
      address: data.address,
      delivery_date: data.delivery_date ?? null,
      delivery_time: data.delivery_time ?? null,
      notes: data.notes ?? null,
      assigned_to: data.assigned_to || null,
      items: data.items?.length ? data.items : [{ name: "Commande manuelle", qty: 1 }],
      total_fcfa: data.total_fcfa,
      total_usd: data.total_usd,
      delivery_fee_fcfa: data.delivery_fee_fcfa ?? 0,
      delivery_fee_usd: data.delivery_fee_usd ?? 0,
    }).select("order_number, id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((r: string) => ["admin", "manager", "livreur"].includes(r))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureManagerOrderAccess(supabaseAdmin, roles, ctx.userId);
    let q = supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
    if (!roles.includes("admin") && roles.includes("manager")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      q = scope ? q.eq("city_scope", scope) : q.eq("id", "00000000-0000-0000-0000-000000000000");
    } else if (!roles.includes("admin")) {
      q = q.eq("assigned_to", ctx.userId);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const driverIds = Array.from(new Set((data ?? []).map((o: any) => o.assigned_to).filter(Boolean)));
    let drivers: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (driverIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", driverIds);
      drivers = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, phone: p.phone }]));
    }
    return (data ?? []).map((o: any) => ({ ...o, driver: o.assigned_to ? drivers[o.assigned_to] ?? null : null }));
  });

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((r: string) => ["admin", "manager"].includes(r))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureManagerOrderAccess(supabaseAdmin, roles, ctx.userId);
    const { data: ur } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "livreur");
    const ids = (ur ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    let q = supabaseAdmin.from("profiles").select("id, full_name, phone, badge_id, city_scope").in("id", ids);
    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      q = scope ? q.eq("city_scope", scope) : q.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    const { data: profs } = await q;
    return profs ?? [];
  });

export const assignOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; driver_id: string | null }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((r: string) => ["admin", "manager"].includes(r))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureManagerOrderAccess(supabaseAdmin, roles, ctx.userId);
    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      const { data: order } = await supabaseAdmin.from("orders").select("city_scope").eq("id", data.order_id).maybeSingle();
      if (!scope || order?.city_scope !== scope) throw new Error("Forbidden: commande hors direction");
      if (data.driver_id) {
        const { data: driver } = await supabaseAdmin.from("profiles").select("city_scope").eq("id", data.driver_id).maybeSingle();
        if (driver?.city_scope !== scope) throw new Error("Forbidden: livreur hors direction");
      }
    }
    const { error } = await supabaseAdmin.from("orders").update({ assigned_to: data.driver_id }).eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; status: Status }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureManagerOrderAccess(supabaseAdmin, roles, ctx.userId);
    if (roles.includes("manager") && !roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      const { data: o } = await supabaseAdmin.from("orders").select("city_scope").eq("id", data.order_id).single();
      if (!scope || o?.city_scope !== scope) throw new Error("Forbidden");
    } else if (!roles.some((r: string) => ["admin", "manager"].includes(r))) {
      // livreur: must be assigned
      const { data: o } = await supabaseAdmin.from("orders").select("assigned_to").eq("id", data.order_id).single();
      if (!o || o.assigned_to !== ctx.userId) throw new Error("Forbidden");
    }
    const patch: any = { status: data.status };
    if (data.status === "delivered") patch.delivered_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.order_id);
    if (error) throw new Error(error.message);
    if (data.status === "delivered") {
      const { error: stockErr } = await supabaseAdmin.rpc("record_order_delivery_stock", {
        p_order_id: data.order_id,
        p_actor: ctx.userId,
      });
      if (stockErr) throw new Error(stockErr.message);
    }
    return { ok: true };
  });
