import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BlogPublicPage } from "@/lib/blog";

export type PageFiche = {
  id: string;
  public_page: BlogPublicPage;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  public_note: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin requis");
}

export const adminListPageFiches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("public_page_fiches")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PageFiche[];
  });

export const adminUpsertPageFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    public_page: BlogPublicPage;
    name: string;
    city?: string;
    address?: string;
    phone?: string;
    public_note?: string;
    sort_order?: number;
    is_published?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (!data.name?.trim()) throw new Error("Le nom est obligatoire");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      public_page: data.public_page,
      name: data.name.trim(),
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      public_note: data.public_note?.trim() || null,
      sort_order: data.sort_order ?? 0,
      is_published: data.is_published ?? true,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("public_page_fiches").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("public_page_fiches").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePageFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("public_page_fiches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
