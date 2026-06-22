export type PublicReview = {
  id: string;
  product_slug: string;
  author_name: string;
  rating: number;
  comment: string;
  location: string | null;
  before_image_url: string | null;
  after_image_url: string | null;
  created_at: string;
};

const reviewSelect =
  "id, product_slug, author_name, rating, comment, location, before_image_url, after_image_url, created_at";

export async function fetchApprovedReviews(options?: {
  productSlug?: string;
  limit?: number;
}): Promise<PublicReview[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("reviews")
    .select(reviewSelect)
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.productSlug) {
    query = query.eq("product_slug", options.productSlug);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicReview[];
}
