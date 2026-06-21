import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { defaultVariant, sortVariants, type ProductVariant } from "@/lib/product-variants";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductWithVariants = Product & { variants: ProductVariant[] };

const productSelect = "id, slug, name, description, content_html, seo_title, seo_description, price_usd, price_fcfa, quantity, image_url, is_active, is_bestseller, created_at, updated_at";
const variantSelect = "id, product_id, weight_value, weight_unit, price_usd, price_fcfa, sort_order, is_active";

async function attachVariants<T extends Product>(products: T[]): Promise<(T & { variants: ProductVariant[] })[]> {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const { data: variants, error } = await supabase
    .from("product_variants")
    .select(variantSelect)
    .in("product_id", ids)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const byProduct = new Map<string, ProductVariant[]>();
  for (const variant of variants ?? []) {
    const list = byProduct.get(variant.product_id) ?? [];
    list.push(variant as ProductVariant);
    byProduct.set(variant.product_id, list);
  }
  return products.map((product) => ({
    ...product,
    variants: sortVariants(byProduct.get(product.id) ?? []),
  }));
}

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

export async function fetchProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const [withVariants] = await attachVariants([data]);
  return withVariants;
}

export function productDisplayPrices(product: ProductWithVariants) {
  const variant = defaultVariant(product.variants);
  if (variant) {
    return { price_usd: variant.price_usd, price_fcfa: variant.price_fcfa, fromVariant: true };
  }
  return { price_usd: product.price_usd, price_fcfa: product.price_fcfa, fromVariant: false };
}

export const formatPrice = (fcfa: number, usd: number) =>
  `${fcfa.toLocaleString("fr-FR")} FCFA · $${usd}`;
