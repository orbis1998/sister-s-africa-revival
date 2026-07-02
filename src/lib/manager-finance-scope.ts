import type { StaffDirection } from "@/lib/staff-scope";
import { posDirection } from "@/lib/staff-scope";
import { normalizeManagerPermissions } from "@/lib/permissions.functions";

export type ManagerPermRow = {
  can_manage_products?: boolean;
  can_manage_stock?: boolean;
  can_manage_orders?: boolean;
  can_manage_logistics?: boolean;
  can_view_accounting?: boolean;
  can_record_expenses?: boolean;
  can_record_wholesale?: boolean;
  can_manage_pos?: boolean;
  can_manage_users?: boolean;
  pos_ids?: string[] | null;
};

export function effectiveManagerPermissions(row: ManagerPermRow | null | undefined) {
  if (!row) return null;
  return { ...row, ...normalizeManagerPermissions(row) };
}

export async function resolveManagerCityScope(supabaseAdmin: any, userId: string): Promise<StaffDirection | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("city_scope")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.city_scope) return profile.city_scope as StaffDirection;

  const { data: perms } = await supabaseAdmin
    .from("manager_permissions")
    .select("pos_ids")
    .eq("user_id", userId)
    .maybeSingle();

  const posIds = ((perms?.pos_ids ?? []) as string[]).filter(Boolean);
  if (!posIds.length) return null;

  const { data: posRows } = await supabaseAdmin
    .from("points_of_sale")
    .select("id, city, city_scope")
    .in("id", posIds);

  for (const pos of posRows ?? []) {
    const scope = posDirection(pos);
    if (scope) {
      await supabaseAdmin.from("profiles").update({ city_scope: scope }).eq("id", userId);
      return scope;
    }
  }

  return null;
}

export async function loadManagerPermissions(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("manager_permissions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return effectiveManagerPermissions(data ?? null);
}
