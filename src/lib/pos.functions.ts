import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    if (!roleList.includes("pos") && !roleList.includes("admin")) {
      throw new Error("Forbidden");
    }

    if (!roleList.includes("admin")) {
      const { data: assignment } = await supabaseAdmin
        .from("pos_accounts")
        .select("pos_id")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!assignment || assignment.pos_id !== data.pos_id) {
        throw new Error("Forbidden: point de vente non autorisé");
      }
    }

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
