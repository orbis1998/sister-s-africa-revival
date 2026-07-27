import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPosSaleAccess(
  supabaseAdmin: any,
  userId: string,
  roles: string[],
  posId: string,
) {
  if (roles.includes("admin")) return;

  if (roles.includes("pos")) {
    const { data: assignment } = await supabaseAdmin
      .from("pos_accounts")
      .select("pos_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!assignment || assignment.pos_id !== posId) {
      throw new Error("Forbidden: point de vente non autorisé");
    }
    return;
  }

  if (roles.includes("manager")) {
    const { data: perms } = await supabaseAdmin
      .from("manager_permissions")
      .select("can_manage_pos, pos_ids")
      .eq("user_id", userId)
      .maybeSingle();
    if (!perms?.can_manage_pos) throw new Error("Forbidden: accès POS non autorisé");
    const allowed = (perms.pos_ids ?? []) as string[];
    if (!allowed.includes(posId)) throw new Error("Forbidden: point de vente non autorisé");
    return;
  }

  throw new Error("Forbidden");
}

export const createPosSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    pos_id: string;
    customer_name?: string;
    customer_phone?: string;
    payment_method?: string;
    total_fcfa: number;
    total_usd: number;
    items: Array<{
      product_id: string;
      slug?: string;
      name: string;
      variant_id?: string;
      variant_label?: string;
      qty: number;
      price_fcfa: number;
      price_usd: number;
    }>;
  }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    if (!roleList.some((r) => ["pos", "manager", "admin"].includes(r))) {
      throw new Error("Forbidden");
    }

    await assertPosSaleAccess(supabaseAdmin, ctx.userId, roleList, data.pos_id);

    const { data: saleId, error } = await supabaseAdmin.rpc("record_pos_sale", {
      p_pos_id: data.pos_id,
      p_sold_by: ctx.userId,
      p_customer_name: data.customer_name ?? "",
      p_customer_phone: data.customer_phone ?? "",
      p_payment_method: data.payment_method ?? "cash",
      p_total_fcfa: data.total_fcfa,
      p_total_usd: data.total_usd,
      p_items: data.items,
    });

    if (error) throw new Error(error.message);
    return { id: saleId as string };
  });
