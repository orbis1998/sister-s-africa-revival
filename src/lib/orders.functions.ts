import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Status = "received" | "preparing" | "ready" | "en_route" | "delivered" | "cancelled";

async function getRoles(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: any) => r.role as string);
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: {
    customer_name: string; customer_phone: string;
    country_code: string; country_name: string;
    city: string; commune: string; address: string;
    notes?: string;
    items: Array<{ slug: string; name: string; variantId: string; variantLabel: string; qty: number; priceUsd: number; priceFcfa: number }>;
    total_fcfa: number; total_usd: number;
  }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("orders").insert({
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      country_code: data.country_code,
      country_name: data.country_name,
      city: data.city,
      commune: data.commune,
      address: data.address,
      notes: data.notes ?? null,
      items: data.items,
      total_fcfa: data.total_fcfa,
      total_usd: data.total_usd,
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
    let q = supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
    if (!roles.includes("admin") && !roles.includes("manager")) {
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
    const { data: ur } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "livreur");
    const ids = (ur ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, phone, badge_id").in("id", ids);
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
    if (!roles.some((r: string) => ["admin", "manager"].includes(r))) {
      // livreur: must be assigned
      const { data: o } = await supabaseAdmin.from("orders").select("assigned_to").eq("id", data.order_id).single();
      if (!o || o.assigned_to !== ctx.userId) throw new Error("Forbidden");
    }
    const patch: any = { status: data.status };
    if (data.status === "delivered") patch.delivered_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
