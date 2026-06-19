import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StaffDirection } from "@/lib/staff-scope";

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
    const profileScope = await getProfileScope(supabaseAdmin, ctx.userId);
    const cityScope = roles.includes("admin") ? data.city_scope || profileScope : profileScope;
    if (!cityScope) throw new Error("Direction manquante");

    const { error } = await supabaseAdmin.from("staff_expenses").insert({
      reported_by: ctx.userId,
      city_scope: cityScope,
      amount_usd: Number(data.amount_usd ?? 0),
      amount_fcfa: Number(data.amount_fcfa ?? 0),
      note: data.note.trim(),
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
