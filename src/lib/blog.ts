import { supabase } from "@/integrations/supabase/client";

export type BlogPostPublic = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  category: string | null;
  read_time: string | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  public_page: "points_de_vente" | "expedition" | "both";
  created_at: string;
};

const select = "id, slug, title, excerpt, content_html, cover_image_url, category, read_time, sort_order, seo_title, seo_description, public_page, created_at";

export type BlogPublicPage = "points_de_vente" | "expedition";

export function slugifyBlogTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "article";
}

export function blogPostPathKey(post: { slug: string; id: string }) {
  const slug = post.slug?.trim();
  return slug || post.id;
}

export async function fetchPublishedBlogPosts(page: BlogPublicPage = "points_de_vente") {
  const pages = page === "points_de_vente" ? ["points_de_vente", "both"] : ["expedition", "both"];
  const { data, error } = await supabase
    .from("blog_posts")
    .select(select)
    .eq("is_published", true)
    .in("public_page", pages)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPostPublic[];
}

export async function fetchBlogPostBySlugPublic(slugOrId: string) {
  const key = slugOrId?.trim();
  if (!key) return null;

  const { data: bySlug, error: slugError } = await supabase
    .from("blog_posts")
    .select(select)
    .eq("slug", key)
    .eq("is_published", true)
    .maybeSingle();
  if (slugError) throw new Error(slugError.message);
  if (bySlug) return bySlug as BlogPostPublic;

  const { data: byId, error: idError } = await supabase
    .from("blog_posts")
    .select(select)
    .eq("id", key)
    .eq("is_published", true)
    .maybeSingle();
  if (idError) throw new Error(idError.message);
  return byId as BlogPostPublic | null;
}
