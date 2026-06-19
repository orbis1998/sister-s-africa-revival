import { createServerFn } from "@tanstack/react-start";

const STAFF_ROLES = new Set(["manager", "livreur", "pos"]);

export const resolveStaffBadgeLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { badge_id: string }) => d)
  .handler(async ({ data }) => {
    const badge = data.badge_id.trim();
    if (!badge) throw new Error("Badge requis");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, badge_id")
      .ilike("badge_id", badge)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Badge introuvable");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id);
    const staffRoles = (roles ?? []).map((r: any) => r.role).filter((role: string) => STAFF_ROLES.has(role));
    if (staffRoles.length === 0) throw new Error("Ce badge n'est pas autorisé pour un accès staff");

    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (userError || !user.user?.email) throw new Error(userError?.message ?? "Email introuvable pour ce badge");

    return { email: user.user.email, roles: staffRoles };
  });
