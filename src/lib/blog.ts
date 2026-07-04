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

export function blogArticleSearch(post: { public_page?: string }) {
  const page = post.public_page ?? "points_de_vente";
  if (page === "both" || page === "points_de_vente") return { page: "points_de_vente" as BlogPublicPage };
  return { page: "expedition" as BlogPublicPage };
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

export async function fetchBlogPostBySlugPublic(slugOrId: string, page?: BlogPublicPage) {
  const key = slugOrId?.trim();
  if (!key) return null;

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  if (uuidLike) {
    const { data: byId, error: idError } = await supabase
      .from("blog_posts")
      .select(select)
      .eq("id", key)
      .eq("is_published", true)
      .maybeSingle();
    if (idError) throw new Error(idError.message);
    return byId as BlogPostPublic | null;
  }

  let query = supabase
    .from("blog_posts")
    .select(select)
    .eq("slug", key)
    .eq("is_published", true);

  if (page === "points_de_vente") {
    query = query.in("public_page", ["points_de_vente", "both"]);
  } else if (page === "expedition") {
    query = query.in("public_page", ["expedition", "both"]);
  }

  const { data: rows, error: slugError } = await query.order("created_at", { ascending: true }).limit(2);
  if (slugError) throw new Error(slugError.message);
  if (!rows?.length) return null;
  return rows[0] as BlogPostPublic;
}
