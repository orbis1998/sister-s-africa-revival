import type { StaffDirection } from "@/lib/staff-scope";

export async function resolvePosForOrder(
  supabaseAdmin: any,
  cityScope: StaffDirection | string | null,
  managerUserId?: string | null,
) {
  if (!cityScope) return null;

  let preferred: string[] = [];
  if (managerUserId) {
    const { data: perms } = await supabaseAdmin
      .from("manager_permissions")
      .select("pos_ids")
      .eq("user_id", managerUserId)
      .maybeSingle();
    preferred = (perms?.pos_ids ?? []) as string[];
  }

  const { data, error } = await supabaseAdmin.rpc("resolve_pos_for_scope", {
    p_scope: cityScope,
    p_preferred: preferred.length ? preferred : null,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function getManagerPosIds(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("manager_permissions")
    .select("pos_ids")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.pos_ids ?? []) as string[]).filter(Boolean);
}

export async function assertWholesaleAccess(supabaseAdmin: any, userId: string, roles: string[]) {
  if (roles.includes("admin")) return;
  const { data } = await supabaseAdmin
    .from("manager_permissions")
    .select("can_record_wholesale")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.can_record_wholesale) {
    throw new Error("Forbidden: vente en gros non autorisée");
  }
}
