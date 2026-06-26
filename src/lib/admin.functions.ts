import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeManagerPermissions } from "@/lib/permissions.functions";
import type { StaffDirection } from "@/lib/staff-scope";

type Role = "admin" | "manager" | "livreur" | "pos";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin requis");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    email: string; password: string; full_name: string; phone?: string;
    badge_id?: string; role: Role; city_scope?: StaffDirection | ""; permissions?: Record<string, boolean>; pos_ids?: string[]; pos_id?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.role === "manager" && !(data.pos_ids?.length)) {
      throw new Error("Un manager doit être associé à au moins un point de vente");
    }
    if (data.role === "livreur" && !data.pos_id) {
      throw new Error("Un livreur doit être associé à un point de vente");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone },
    });
    if (error || !created.user) throw new Error(error?.message || "Création échouée");
    const uid = created.user.id;
    // Profile (upsert; trigger may have created it)
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      phone: data.phone,
      badge_id: data.badge_id?.trim() || null,
      city_scope: data.city_scope || null,
      pos_id: data.role === "livreur" ? data.pos_id || null : null,
    });
    // Remove default 'client' role assigned by trigger, then add target role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (data.role === "manager") {
      const perms = normalizeManagerPermissions(data.permissions);
      const { error: permErr } = await supabaseAdmin.from("manager_permissions").upsert({
        user_id: uid,
        ...perms,
        pos_ids: data.pos_ids ?? [],
      }, { onConflict: "user_id" });
      if (permErr) throw new Error(`Permissions manager : ${permErr.message}`);
    }
    if (data.role === "pos" && data.pos_id) {
      await supabaseAdmin.from("pos_accounts").upsert({ user_id: uid, pos_id: data.pos_id });
    }
    return { ok: true, user_id: uid };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    user_id: string;
    email?: string;
    password?: string;
    full_name?: string;
    phone?: string;
    badge_id?: string;
    city_scope?: StaffDirection | "";
    role?: Role;
    permissions?: Record<string, boolean>;
    pos_ids?: string[];
    pos_id?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.user_id;

    const authPatch: { email?: string; password?: string; user_metadata?: Record<string, string> } = {};
    if (data.email?.trim()) authPatch.email = data.email.trim();
    if (data.password?.trim()) authPatch.password = data.password.trim();
    if (data.full_name !== undefined || data.phone !== undefined) {
      authPatch.user_metadata = {
        ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? "" } : {}),
      };
    }
    if (Object.keys(authPatch).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, authPatch);
      if (error) throw new Error(error.message);
    }

    const profilePatch: Record<string, unknown> = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.phone !== undefined) profilePatch.phone = data.phone || null;
    if (data.badge_id !== undefined) profilePatch.badge_id = data.badge_id?.trim() || null;
    if (data.city_scope !== undefined) profilePatch.city_scope = data.city_scope || null;
    if (Object.keys(profilePatch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", uid);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      if (data.role === "manager" && !(data.pos_ids?.length)) {
        throw new Error("Un manager doit être associé à au moins un point de vente");
      }
      if (data.role === "livreur" && !data.pos_id) {
        throw new Error("Un livreur doit être associé à un point de vente");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
      if (roleErr) throw new Error(roleErr.message);

      await supabaseAdmin.from("manager_permissions").delete().eq("user_id", uid);
      await supabaseAdmin.from("pos_accounts").delete().eq("user_id", uid);

      if (data.role === "manager") {
        const perms = normalizeManagerPermissions(data.permissions);
        const { error: permErr } = await supabaseAdmin.from("manager_permissions").upsert({
          user_id: uid,
          ...perms,
          pos_ids: data.pos_ids ?? [],
        }, { onConflict: "user_id" });
        if (permErr) throw new Error(`Permissions manager : ${permErr.message}`);
        await supabaseAdmin.from("profiles").update({ pos_id: null }).eq("id", uid);
      } else if (data.role === "livreur") {
        await supabaseAdmin.from("profiles").update({ pos_id: data.pos_id || null }).eq("id", uid);
      } else if (data.role === "pos") {
        if (data.pos_id) {
          await supabaseAdmin.from("pos_accounts").upsert({ user_id: uid, pos_id: data.pos_id });
        }
        await supabaseAdmin.from("profiles").update({ pos_id: null }).eq("id", uid);
      } else {
        await supabaseAdmin.from("profiles").update({ pos_id: null }).eq("id", uid);
      }
    } else if (data.permissions !== undefined || data.pos_ids !== undefined) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid);
      const isManager = (roles ?? []).some((r) => r.role === "manager");
      if (isManager) {
        if (!(data.pos_ids?.length)) throw new Error("Au moins un point de vente est requis pour un manager");
        const perms = normalizeManagerPermissions(data.permissions);
        const { error: permErr } = await supabaseAdmin.from("manager_permissions").upsert({
          user_id: uid,
          ...perms,
          pos_ids: data.pos_ids ?? [],
        }, { onConflict: "user_id" });
        if (permErr) throw new Error(`Permissions manager : ${permErr.message}`);
      }
    }

    if (data.role === undefined && data.pos_id !== undefined) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid);
      const roleList = (roles ?? []).map((r) => r.role as Role);
      if (roleList.includes("livreur")) {
        await supabaseAdmin.from("profiles").update({ pos_id: data.pos_id || null }).eq("id", uid);
      }
      if (roleList.includes("pos")) {
        await supabaseAdmin.from("pos_accounts").delete().eq("user_id", uid);
        if (data.pos_id) await supabaseAdmin.from("pos_accounts").upsert({ user_id: uid, pos_id: data.pos_id });
      }
    }

    return { ok: true };
  });

export const adminListPosSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pos_id: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sales, error } = await supabaseAdmin
      .from("pos_sales")
      .select("*")
      .eq("pos_id", data.pos_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    const sellerIds = [...new Set((sales ?? []).map((s: any) => s.sold_by).filter(Boolean))];
    const { data: profiles } = sellerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, badge_id, phone").in("id", sellerIds)
      : { data: [] as any[] };
    return (sales ?? []).map((sale: any) => ({
      ...sale,
      seller: profiles?.find((p: any) => p.id === sale.sold_by) ?? null,
    }));
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const ids = users?.users.map((u) => u.id) ?? [];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("*").in("id", ids);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
    const { data: posAccounts } = await supabaseAdmin.from("pos_accounts").select("user_id, pos_id, points_of_sale(name)").in("user_id", ids);
    const { data: managerPerms } = await supabaseAdmin.from("manager_permissions").select("*").in("user_id", ids);
    return users?.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      profile: profiles?.find((p) => p.id === u.id) ?? null,
      roles: roles?.filter((r) => r.user_id === u.id).map((r) => r.role) ?? [],
      pos_account: posAccounts?.find((p) => p.user_id === u.id) ?? null,
      manager_permissions: managerPerms?.find((p) => p.user_id === u.id) ?? null,
    })) ?? [];
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    return { ok: true };
  });

async function assertProductEditor(ctx: { supabase: any; userId: string }) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: perms } = await ctx.supabase
    .from("manager_permissions")
    .select("can_manage_products")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!perms?.can_manage_products) throw new Error("Forbidden: gestion produits non autorisée");
}

async function assertStockEditor(ctx: { supabase: any; userId: string }, posId: string | null) {
  if (!posId) throw new Error("Le stock se gère par point de vente — sélectionnez un POS");
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: perms } = await ctx.supabase
    .from("manager_permissions")
    .select("can_manage_stock, pos_ids")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!perms?.can_manage_stock) throw new Error("Forbidden: gestion stock non autorisée");
  const allowed = (perms.pos_ids ?? []) as string[];
  if (!allowed.includes(posId)) throw new Error("Forbidden: point de vente non autorisé");
}

type VariantInput = {
  id?: string;
  weight_value: number;
  weight_unit: "g" | "kg";
  price_usd: number;
  price_fcfa: number;
  price_cdf?: number;
  rdc_price_currency?: "usd" | "cdf";
  sort_order?: number;
  is_active?: boolean;
};

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; slug: string; name: string; description?: string; content_html?: string;
    seo_title?: string; seo_description?: string;
    price_usd: number; price_fcfa: number; price_cdf?: number; rdc_price_currency?: "usd" | "cdf";
    quantity?: number; image_url?: string;
    is_active?: boolean; is_bestseller?: boolean;
    variants?: VariantInput[];
  }) => d)
  .handler(async ({ data, context }) => {
    await assertProductEditor(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { variants, ...productPayload } = data;
    const activeVariants = (variants ?? []).filter((v) => v.weight_value > 0);
    if (activeVariants.length) {
      const sorted = [...activeVariants].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      productPayload.price_usd = sorted[0].price_usd;
      productPayload.price_fcfa = sorted[0].price_fcfa;
      productPayload.price_cdf = sorted[0].price_cdf ?? 0;
      productPayload.rdc_price_currency = sorted[0].rdc_price_currency ?? productPayload.rdc_price_currency ?? "usd";
    }
    const { error } = await supabaseAdmin.from("products").upsert(productPayload, { onConflict: "slug" });
    if (error) throw new Error(error.message);

    const { data: saved, error: fetchErr } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("slug", productPayload.slug)
      .single();
    if (fetchErr || !saved) throw new Error(fetchErr?.message || "Produit introuvable après enregistrement");

    if (variants) {
      const { data: existing } = await supabaseAdmin.from("product_variants").select("id").eq("product_id", saved.id);
      const keepIds = new Set(activeVariants.map((v) => v.id).filter(Boolean));
      const toDelete = (existing ?? []).filter((row) => !keepIds.has(row.id)).map((row) => row.id);
      if (toDelete.length) {
        await supabaseAdmin.from("product_variants").delete().in("id", toDelete);
      }
      for (const [index, variant] of activeVariants.entries()) {
        const row = {
          id: variant.id,
          product_id: saved.id,
          weight_value: variant.weight_value,
          weight_unit: variant.weight_unit,
          price_usd: variant.price_usd,
          price_fcfa: variant.price_fcfa,
          price_cdf: variant.price_cdf ?? 0,
          rdc_price_currency: variant.rdc_price_currency ?? productPayload.rdc_price_currency ?? "usd",
          sort_order: variant.sort_order ?? index,
          is_active: variant.is_active ?? true,
        };
        const { error: variantErr } = variant.id
          ? await supabaseAdmin.from("product_variants").update(row).eq("id", variant.id)
          : await supabaseAdmin.from("product_variants").insert(row);
        if (variantErr) throw new Error(variantErr.message);
      }
    }
    return { ok: true, id: saved.id };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("products").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminSetStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string; variant_id: string; pos_id: string | null; quantity: number; low_stock_threshold?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertStockEditor(context as any, data.pos_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previous } = await supabaseAdmin
      .from("stock")
      .select("quantity")
      .eq("variant_id", data.variant_id)
      .eq("pos_id", data.pos_id)
      .maybeSingle();
    const previousQty = previous?.quantity ?? 0;
    const delta = data.quantity - previousQty;
    const payload: any = {
      product_id: data.product_id,
      variant_id: data.variant_id,
      pos_id: data.pos_id,
      quantity: data.quantity,
    };
    if (typeof data.low_stock_threshold === "number") payload.low_stock_threshold = data.low_stock_threshold;
    const { error } = await supabaseAdmin.from("stock").upsert(payload, { onConflict: "variant_id,pos_id" });
    if (error) throw new Error(error.message);
    if (delta !== 0) {
      await supabaseAdmin.from("stock_movements").insert({
        product_id: data.product_id,
        variant_id: data.variant_id,
        pos_id: data.pos_id,
        delta,
        reason: "Mise à jour manuelle",
        created_by: (context as any).userId,
      });
    }
    return { ok: true };
  });

export const adminUpsertPOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; name: string; city?: string; city_scope?: StaffDirection | "";
    address?: string; phone?: string; public_note?: string; manager_user_id?: string | null;
    manager_user_ids?: string[];
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const selectedManagerIds = [...new Set((data.manager_user_ids ?? []).filter(Boolean))];
    const { manager_user_id, manager_user_ids: _ignored, ...posPayload } = data;
    let savedId = posPayload.id as string | undefined;
    const primaryManagerId = selectedManagerIds[0] ?? manager_user_id ?? null;

    if (posPayload.id) {
      const { error } = await supabaseAdmin.from("points_of_sale").update({
        ...posPayload,
        manager_user_id: primaryManagerId,
      }).eq("id", posPayload.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from("points_of_sale").insert({
        name: posPayload.name,
        city: posPayload.city,
        city_scope: posPayload.city_scope || null,
        address: posPayload.address,
        phone: posPayload.phone,
        public_note: posPayload.public_note ?? null,
        manager_user_id: primaryManagerId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      savedId = inserted.id;
    }

    if (savedId) {
      await syncPosManagers(supabaseAdmin, savedId, posPayload.city_scope || null, selectedManagerIds);
    }
    return { ok: true, id: savedId };
  });

async function syncPosManagers(
  supabaseAdmin: any,
  posId: string,
  cityScope: string | null,
  selectedManagerIds: string[],
) {
  if (selectedManagerIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, city_scope, full_name")
      .in("id", selectedManagerIds);
    const { data: permsList } = await supabaseAdmin
      .from("manager_permissions")
      .select("user_id, pos_ids, can_manage_pos")
      .in("user_id", selectedManagerIds);

    for (const userId of selectedManagerIds) {
      const profile = profiles?.find((p: any) => p.id === userId);
      const perms = permsList?.find((p: any) => p.user_id === userId);
      if (!perms?.can_manage_pos) {
        throw new Error(`Permission POS manquante pour ${profile?.full_name ?? "ce manager"}`);
      }
      if (cityScope && profile?.city_scope && profile.city_scope !== cityScope) {
        throw new Error(`${profile.full_name ?? "Manager"} n'est pas de cette direction`);
      }
      if (cityScope && !profile?.city_scope) {
        await supabaseAdmin.from("profiles").update({ city_scope: cityScope }).eq("id", userId);
      }
    }
  }

  const { data: allPerms } = await supabaseAdmin.from("manager_permissions").select("user_id, pos_ids");
  const currentlyLinked = (allPerms ?? [])
    .filter((row: any) => (row.pos_ids ?? []).includes(posId))
    .map((row: any) => row.user_id as string);

  const toAdd = selectedManagerIds.filter((id) => !currentlyLinked.includes(id));
  const toRemove = currentlyLinked.filter((id) => !selectedManagerIds.includes(id));

  for (const userId of toAdd) {
    const { data: perms } = await supabaseAdmin
      .from("manager_permissions")
      .select("pos_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const current = new Set((perms?.pos_ids ?? []) as string[]);
    current.add(posId);
    const { error } = await supabaseAdmin
      .from("manager_permissions")
      .update({ pos_ids: [...current] })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  for (const userId of toRemove) {
    const { data: perms } = await supabaseAdmin
      .from("manager_permissions")
      .select("pos_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const next = ((perms?.pos_ids ?? []) as string[]).filter((id) => id !== posId);
    const { error } = await supabaseAdmin
      .from("manager_permissions")
      .update({ pos_ids: next })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}

export const adminListPosManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pos_id?: string; city_scope?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "manager");
    const managerIds = (roles ?? []).map((r: any) => r.user_id);
    if (!managerIds.length) return [];

    const [{ data: profiles }, { data: perms }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, city_scope, badge_id").in("id", managerIds),
      supabaseAdmin.from("manager_permissions").select("user_id, pos_ids, can_manage_pos").in("user_id", managerIds),
    ]);

    return (profiles ?? [])
      .map((profile: any) => {
        const permission = perms?.find((p: any) => p.user_id === profile.id);
        const posIds = (permission?.pos_ids ?? []) as string[];
        return {
          id: profile.id,
          full_name: profile.full_name,
          city_scope: profile.city_scope,
          badge_id: profile.badge_id,
          can_manage_pos: !!permission?.can_manage_pos,
          assigned: data.pos_id ? posIds.includes(data.pos_id) : false,
        };
      })
      .filter((row) => row.can_manage_pos)
      .filter((row) => !data.city_scope || !row.city_scope || row.city_scope === data.city_scope)
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr"));
  });

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminModerateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approved: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reviews")
      .update({
        approved: data.approved,
        approved_at: data.approved ? new Date().toISOString() : null,
        approved_by: data.approved ? (context as any).userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    hero_eyebrow: string;
    hero_title: string;
    hero_highlight: string;
    hero_subtitle: string;
    cta_label: string;
    cta_href: string;
    whatsapp_number: string;
    hero_images: string[];
    seo_title?: string;
    seo_description?: string;
    seo_keywords?: string;
    og_image_url?: string;
    site_url?: string;
    twitter_handle?: string;
    pos_page_eyebrow?: string;
    pos_page_title?: string;
    pos_page_cta_label?: string;
    pos_page_cta_href?: string;
    pos_page_cta_secondary_label?: string;
    story_eyebrow?: string;
    story_title?: string;
    story_paragraph_1?: string;
    story_paragraph_2?: string;
    home_stats?: { value: string; label: string }[];
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      id: true,
      ...data,
      hero_images: data.hero_images.slice(0, 3).filter(Boolean),
      home_stats: (data.home_stats ?? []).slice(0, 4),
      updated_by: (context as any).userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
