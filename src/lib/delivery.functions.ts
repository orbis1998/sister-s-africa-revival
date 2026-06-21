import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CommuneDeliveryFee = {
  id: string;
  country_code: string;
  city: string;
  commune: string;
  city_scope: string | null;
  fee_fcfa: number;
  fee_usd: number;
};

export const listCommuneDeliveryFees = createServerFn({ method: "GET" })
  .inputValidator((d: { country_code?: string; city?: string; city_scope?: string }) => d ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("commune_delivery_fees").select("*").order("city").order("commune");
    if (data.country_code) q = q.eq("country_code", data.country_code);
    if (data.city) q = q.eq("city", data.city);
    if (data.city_scope) q = q.eq("city_scope", data.city_scope);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CommuneDeliveryFee[];
  });

export const lookupCommuneDeliveryFee = createServerFn({ method: "GET" })
  .inputValidator((d: { country_code: string; city: string; commune: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("commune_delivery_fees")
      .select("fee_fcfa, fee_usd")
      .eq("country_code", data.country_code)
      .eq("city", data.city)
      .eq("commune", data.commune)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      fee_fcfa: row?.fee_fcfa ?? 0,
      fee_usd: Number(row?.fee_usd ?? 0),
    };
  });

async function getProfileScope(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("city_scope").eq("id", userId).maybeSingle();
  return data?.city_scope ?? null;
}

export const upsertCommuneDeliveryFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    fees: Array<{ id?: string; country_code: string; city: string; commune: string; fee_fcfa: number; fee_usd: number }>;
  }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const isAdmin = roleList.includes("admin");
    const isManager = roleList.includes("manager");
    if (!isAdmin && !isManager) throw new Error("Forbidden");

    const scope = isAdmin ? null : await getProfileScope(supabaseAdmin, ctx.userId);
    if (!isAdmin && !scope) throw new Error("Forbidden: direction non définie");

    for (const fee of data.fees) {
      const city_scope = (await import("@/lib/staff-scope")).directionFromCity(fee.city, fee.country_code);
      if (!isAdmin && city_scope !== scope) throw new Error(`Forbidden: commune hors direction (${fee.commune})`);
      const feeFcfa = Number.isFinite(Number(fee.fee_fcfa)) ? Math.max(0, Math.round(Number(fee.fee_fcfa))) : 0;
      const feeUsd = Number.isFinite(Number(fee.fee_usd)) ? Math.max(0, Number(fee.fee_usd)) : 0;
      const { error } = await supabaseAdmin.from("commune_delivery_fees").upsert(
        {
          id: fee.id,
          country_code: fee.country_code,
          city: fee.city,
          commune: fee.commune,
          city_scope,
          fee_fcfa: feeFcfa,
          fee_usd: feeUsd,
          updated_by: ctx.userId,
        },
        { onConflict: "country_code,city,commune" },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
