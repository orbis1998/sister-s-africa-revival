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
  created_at: string;
};

const select = "id, slug, title, excerpt, content_html, cover_image_url, category, read_time, sort_order, seo_title, seo_description, created_at";

export async function fetchPublishedBlogPosts() {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(select)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPostPublic[];
}

export async function fetchBlogPostBySlugPublic(slug: string) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(select)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlogPostPublic | null;
}
