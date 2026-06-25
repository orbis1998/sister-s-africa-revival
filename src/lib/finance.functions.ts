import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StaffDirection } from "@/lib/staff-scope";
import { directionCurrency } from "@/lib/staff-scope";
import { resolvePosForOrder } from "@/lib/pos-scope";
import {
  loadManagerPermissions,
  resolveManagerCityScope,
} from "@/lib/manager-finance-scope";

async function getRoles(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function requireStaffFinanceAccess(
  supabaseAdmin: any,
  userId: string,
  roles: string[],
  mode: "expense_write" | "expense_read" | "wholesale_write" | "wholesale_read",
) {
  if (roles.includes("admin")) return;
  const perms = await loadManagerPermissions(supabaseAdmin, userId);
  if (!perms) throw new Error("Forbidden: permissions manager introuvables");

  if (mode === "expense_write" && !perms.can_record_expenses) {
    throw new Error("Forbidden: enregistrement des dépenses non autorisé");
  }
  if (mode === "expense_read" && !perms.can_record_expenses && !perms.can_view_accounting) {
    throw new Error("Forbidden: consultation des dépenses non autorisée");
  }
  if (mode === "wholesale_write" && !perms.can_record_wholesale) {
    throw new Error("Forbidden: vente en gros non autorisée");
  }
  if (mode === "wholesale_read" && !perms.can_record_wholesale && !perms.can_view_accounting) {
    throw new Error("Forbidden: consultation ventes en gros non autorisée");
  }
}

export const createStaffExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    amount_usd?: number;
    amount_fcfa?: number;
    note: string;
    city_scope?: StaffDirection | "";
    spent_at?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles = await getRoles(supabaseAdmin, ctx.userId);
    if (!roles.some((role) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");

    await requireStaffFinanceAccess(supabaseAdmin, ctx.userId, roles, "expense_write");

    const cityScope = roles.includes("admin")
      ? (data.city_scope || (await resolveManagerCityScope(supabaseAdmin, ctx.userId)))
      : await resolveManagerCityScope(supabaseAdmin, ctx.userId);
    if (!cityScope) throw new Error("Direction manquante — l'administrateur doit configurer votre ville ou POS");

    const note = data.note?.trim();
    if (!note) throw new Error("Note / justification requise");

    const row = {
      reported_by: ctx.userId,
      city_scope: cityScope,
      amount_usd: Number(data.amount_usd ?? 0),
      amount_fcfa: Number(data.amount_fcfa ?? 0),
      note,
      spent_at: data.spent_at ?? new Date().toISOString(),
    };

    const { error: userError } = await ctx.supabase.from("staff_expenses").insert(row);
    if (!userError) return { ok: true };

    const { error: adminError } = await supabaseAdmin.from("staff_expenses").insert(row);
    if (adminError) throw new Error(adminError.message || userError.message);
    return { ok: true };
  });

export const listStaffExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles = await getRoles(supabaseAdmin, ctx.userId);
    if (!roles.some((role) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");

    const isAdmin = roles.includes("admin");
    if (!isAdmin) await requireStaffFinanceAccess(supabaseAdmin, ctx.userId, roles, "expense_read");

    const cityScope = isAdmin ? null : await resolveManagerCityScope(supabaseAdmin, ctx.userId);
    if (!isAdmin && !cityScope) return [];

    let q = supabaseAdmin
      .from("staff_expenses")
      .select("*")
      .order("spent_at", { ascending: false });
    if (cityScope) q = q.eq("city_scope", cityScope);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createWholesaleSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    customer_name: string;
    customer_phone?: string;
    product_id?: string | null;
    variant_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price_usd?: number;
    unit_price_fcfa?: number;
    payment_status?: string;
    notes?: string;
    sold_at?: string;
    city_scope?: StaffDirection | "";
    pos_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles = await getRoles(supabaseAdmin, ctx.userId);
    if (!roles.some((role) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");

    await requireStaffFinanceAccess(supabaseAdmin, ctx.userId, roles, "wholesale_write");

    const cityScope = roles.includes("admin")
      ? (data.city_scope || (await resolveManagerCityScope(supabaseAdmin, ctx.userId)))
      : await resolveManagerCityScope(supabaseAdmin, ctx.userId);
    if (!cityScope) throw new Error("Direction manquante — l'administrateur doit configurer votre ville ou POS");

    const perms = await loadManagerPermissions(supabaseAdmin, ctx.userId);
    const allowedPosIds = new Set((perms?.pos_ids ?? []) as string[]);

    const quantity = Math.max(1, Number(data.quantity || 1));
    const isFcfa = directionCurrency(cityScope) === "FCFA";
    const unitUsd = isFcfa ? 0 : Number(data.unit_price_usd ?? 0);
    const unitFcfa = isFcfa ? Number(data.unit_price_fcfa ?? 0) : 0;

    let pos_id = data.pos_id ?? null;
    if (!pos_id) {
      pos_id = await resolvePosForOrder(supabaseAdmin, cityScope, roles.includes("admin") ? null : ctx.userId);
    }
    if (!pos_id) throw new Error("Aucun point de vente configuré pour cette direction");
    if (!roles.includes("admin") && allowedPosIds.size > 0 && !allowedPosIds.has(pos_id)) {
      throw new Error("Ce point de vente ne vous est pas assigné");
    }

    const rpcArgs = {
      p_created_by: ctx.userId,
      p_city_scope: cityScope,
      p_pos_id: pos_id,
      p_customer_name: data.customer_name.trim(),
      p_customer_phone: data.customer_phone?.trim() || null,
      p_product_id: data.product_id || null,
      p_variant_id: data.variant_id || null,
      p_product_name: data.product_name.trim(),
      p_quantity: quantity,
      p_unit_price_usd: unitUsd,
      p_unit_price_fcfa: unitFcfa,
      p_payment_status: data.payment_status ?? "pending",
      p_notes: data.notes?.trim() || null,
      p_sold_at: data.sold_at ?? new Date().toISOString(),
    };

    const { data: saleId, error: userRpcError } = await ctx.supabase.rpc("record_wholesale_sale", rpcArgs);
    if (!userRpcError && saleId) return { ok: true, id: saleId as string };

    const { data: adminSaleId, error: adminRpcError } = await supabaseAdmin.rpc("record_wholesale_sale", rpcArgs);
    if (adminRpcError) throw new Error(adminRpcError.message || userRpcError?.message || "Enregistrement impossible");
    return { ok: true, id: adminSaleId as string };
  });

export const listWholesaleSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as { userId: string; supabase: any };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles = await getRoles(supabaseAdmin, ctx.userId);
    if (!roles.some((role) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");

    const isAdmin = roles.includes("admin");
    if (!isAdmin) await requireStaffFinanceAccess(supabaseAdmin, ctx.userId, roles, "wholesale_read");

    const cityScope = isAdmin ? null : await resolveManagerCityScope(supabaseAdmin, ctx.userId);
    if (!isAdmin && !cityScope) return [];

    let q = supabaseAdmin
      .from("wholesale_sales")
      .select("*")
      .order("sold_at", { ascending: false });
    if (cityScope) q = q.eq("city_scope", cityScope);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });
