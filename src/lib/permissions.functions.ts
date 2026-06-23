import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagerPermissions = {
  user_id: string;
  can_manage_products: boolean;
  can_manage_stock: boolean;
  can_manage_orders: boolean;
  can_manage_logistics: boolean;
  can_view_accounting: boolean;
  can_record_expenses: boolean;
  can_record_wholesale: boolean;
  can_manage_pos: boolean;
  can_manage_users: boolean;
  pos_ids: string[];
  notes: string | null;
  updated_at: string;
};

function normalizeManagerPermissions(input?: Record<string, boolean | undefined>) {
  const wholesale = !!input?.can_record_wholesale;
  const expenses = !!input?.can_record_expenses;
  const accounting = !!input?.can_view_accounting;
  return {
    can_manage_products: !!input?.can_manage_products,
    can_manage_stock: !!input?.can_manage_stock,
    can_manage_orders: !!input?.can_manage_orders,
    can_manage_logistics: !!input?.can_manage_logistics,
    can_manage_pos: !!input?.can_manage_pos,
    can_manage_users: !!input?.can_manage_users,
    can_record_wholesale: wholesale,
    can_record_expenses: expenses,
    can_view_accounting: accounting || wholesale || expenses,
  };
}

export const getMyManagerPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as { userId: string; supabase: any };
    const { data: roles } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
    const roleList = (roles ?? []).map((r: { role: string }) => r.role);
    if (!roleList.includes("manager") && !roleList.includes("admin")) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("manager_permissions")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ManagerPermissions | null) ?? null;
  });

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin requis");
}

export const adminUpdateManagerPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    user_id: string;
    permissions: Record<string, boolean | undefined>;
    pos_ids?: string[];
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const perms = normalizeManagerPermissions(data.permissions);
    const posIds = data.pos_ids ?? [];
    if (!posIds.length) throw new Error("Au moins un point de vente est requis pour un manager");
    const { error } = await supabaseAdmin.from("manager_permissions").upsert({
      user_id: data.user_id,
      ...perms,
      pos_ids: posIds,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { normalizeManagerPermissions };
