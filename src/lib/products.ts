import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];

const productSelect = "id, slug, name, description, content_html, seo_title, seo_description, price_usd, price_fcfa, quantity, image_url, is_active, is_bestseller, created_at, updated_at";

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchFeaturedProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("is_active", true)
    .eq("is_bestseller", true)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchProductBySlug(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export const formatPrice = (fcfa: number, usd: number) =>
  `${fcfa.toLocaleString("fr-FR")} FCFA · $${usd}`;
