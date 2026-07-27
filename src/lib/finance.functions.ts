import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StaffDirection } from "@/lib/staff-scope";
import { directionCurrency } from "@/lib/staff-scope";
import { assertWholesaleAccess, resolvePosForOrder } from "@/lib/pos-scope";

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

async function assertExpenseAccess(supabaseAdmin: any, userId: string, roles: string[]) {
  if (roles.includes("admin")) return;
  const { data } = await supabaseAdmin
    .from("manager_permissions")
    .select("can_view_accounting, can_record_expenses")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.can_view_accounting || !data?.can_record_expenses) {
    throw new Error("Forbidden: enregistrement des dépenses non autorisé");
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
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((role: string) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertExpenseAccess(supabaseAdmin, ctx.userId, roles);
    const profileScope = await getProfileScope(supabaseAdmin, ctx.userId);
    const cityScope = roles.includes("admin") ? data.city_scope || profileScope : profileScope;
    if (!cityScope) throw new Error("Direction manquante — contactez l'administrateur");

    const note = data.note?.trim();
    if (!note) throw new Error("Note / justification requise");

    const { error } = await supabaseAdmin.from("staff_expenses").insert({
      reported_by: ctx.userId,
      city_scope: cityScope,
      amount_usd: Number(data.amount_usd ?? 0),
      amount_fcfa: Number(data.amount_fcfa ?? 0),
      note,
      spent_at: data.spent_at ?? new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStaffExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((role: string) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!roles.includes("admin")) await assertExpenseAccess(supabaseAdmin, ctx.userId, roles);
    let q = supabaseAdmin
      .from("staff_expenses")
      .select("*, profiles:reported_by(full_name, badge_id)")
      .order("spent_at", { ascending: false });

    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      q = scope ? q.eq("city_scope", scope) : q.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateStaffExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    amount_usd?: number;
    amount_fcfa?: number;
    note: string;
    spent_at?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((role: string) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertExpenseAccess(supabaseAdmin, ctx.userId, roles);

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("staff_expenses")
      .select("id, reported_by, city_scope")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Dépense introuvable");

    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      if (existing.city_scope !== scope) throw new Error("Forbidden: dépense hors direction");
      if (existing.reported_by !== ctx.userId) throw new Error("Forbidden: vous ne pouvez modifier que vos propres dépenses");
    }

    const note = data.note?.trim();
    if (!note) throw new Error("Note / justification requise");

    const { error } = await supabaseAdmin.from("staff_expenses").update({
      amount_usd: Number(data.amount_usd ?? 0),
      amount_fcfa: Number(data.amount_fcfa ?? 0),
      note,
      spent_at: data.spent_at ?? existing.spent_at,
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStaffExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((role: string) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertExpenseAccess(supabaseAdmin, ctx.userId, roles);

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("staff_expenses")
      .select("reported_by, city_scope")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Dépense introuvable");

    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      if (existing.city_scope !== scope) throw new Error("Forbidden: dépense hors direction");
      if (existing.reported_by !== ctx.userId) throw new Error("Forbidden: vous ne pouvez supprimer que vos propres dépenses");
    }

    const { error } = await supabaseAdmin.from("staff_expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((role: string) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertWholesaleAccess(supabaseAdmin, ctx.userId, roles);
    const profileScope = await getProfileScope(supabaseAdmin, ctx.userId);
    const cityScope = roles.includes("admin") ? data.city_scope || profileScope : profileScope;
    if (!cityScope) throw new Error("Direction manquante — contactez l'administrateur");

    const quantity = Math.max(1, Number(data.quantity || 1));
    const isFcfa = directionCurrency(cityScope) === "FCFA";
    const unitUsd = isFcfa ? 0 : Number(data.unit_price_usd ?? 0);
    const unitFcfa = isFcfa ? Number(data.unit_price_fcfa ?? 0) : 0;
    let pos_id = data.pos_id ?? null;
    if (!pos_id) {
      pos_id = await resolvePosForOrder(supabaseAdmin, cityScope, roles.includes("admin") ? null : ctx.userId);
    }
    if (!pos_id) throw new Error("Aucun point de vente configuré pour cette direction");

    const { data: saleId, error } = await supabaseAdmin.rpc("record_wholesale_sale", {
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
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: saleId as string };
  });

export const listWholesaleSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    const roles = await getRoles(ctx);
    if (!roles.some((role: string) => ["admin", "manager"].includes(role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!roles.includes("admin")) await assertWholesaleAccess(supabaseAdmin, ctx.userId, roles);
    let q = supabaseAdmin
      .from("wholesale_sales")
      .select("*, profiles:created_by(full_name, badge_id)")
      .order("sold_at", { ascending: false });

    if (!roles.includes("admin")) {
      const scope = await getProfileScope(supabaseAdmin, ctx.userId);
      q = scope ? q.eq("city_scope", scope) : q.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });
