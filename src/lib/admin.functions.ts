import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
      await supabaseAdmin.from("manager_permissions").upsert({
        user_id: uid,
        can_manage_products: !!data.permissions?.can_manage_products,
        can_manage_stock: !!data.permissions?.can_manage_stock,
        can_manage_orders: !!data.permissions?.can_manage_orders,
        can_manage_logistics: !!data.permissions?.can_manage_logistics,
        can_view_accounting: !!data.permissions?.can_view_accounting,
        can_record_wholesale: !!data.permissions?.can_record_wholesale,
        can_record_expenses: !!data.permissions?.can_record_expenses,
        can_manage_pos: !!data.permissions?.can_manage_pos,
        can_manage_users: !!data.permissions?.can_manage_users,
        pos_ids: data.pos_ids ?? [],
      });
    }
    if (data.role === "pos" && data.pos_id) {
      await supabaseAdmin.from("pos_accounts").upsert({ user_id: uid, pos_id: data.pos_id });
    }
    return { ok: true, user_id: uid };
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
    return users?.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      profile: profiles?.find((p) => p.id === u.id) ?? null,
      roles: roles?.filter((r) => r.user_id === u.id).map((r) => r.role) ?? [],
      pos_account: posAccounts?.find((p) => p.user_id === u.id) ?? null,
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
    address?: string; phone?: string; manager_user_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { manager_user_id, ...posPayload } = data;
    let savedId = posPayload.id as string | undefined;
    if (posPayload.id) {
      const { error } = await supabaseAdmin.from("points_of_sale").update({
        ...posPayload,
        manager_user_id: manager_user_id || null,
      }).eq("id", posPayload.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from("points_of_sale").insert({
        name: posPayload.name,
        city: posPayload.city,
        city_scope: posPayload.city_scope || null,
        address: posPayload.address,
        phone: posPayload.phone,
        manager_user_id: manager_user_id || null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      savedId = inserted.id;
    }

    if (manager_user_id && savedId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("city_scope")
        .eq("id", manager_user_id)
        .maybeSingle();
      if (posPayload.city_scope && !profile?.city_scope) {
        await supabaseAdmin.from("profiles").update({ city_scope: posPayload.city_scope }).eq("id", manager_user_id);
      }
      const { data: perms } = await supabaseAdmin
        .from("manager_permissions")
        .select("pos_ids")
        .eq("user_id", manager_user_id)
        .maybeSingle();
      const current = new Set((perms?.pos_ids ?? []) as string[]);
      current.add(savedId);
      if (perms) {
        await supabaseAdmin.from("manager_permissions").update({ pos_ids: [...current] }).eq("user_id", manager_user_id);
      } else {
        await supabaseAdmin.from("manager_permissions").insert({
          user_id: manager_user_id,
          pos_ids: [...current],
        });
      }
    }
    return { ok: true, id: savedId };
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
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      id: true,
      ...data,
      hero_images: data.hero_images.slice(0, 3).filter(Boolean),
      updated_by: (context as any).userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
