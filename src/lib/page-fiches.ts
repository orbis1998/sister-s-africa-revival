import { supabase } from "@/integrations/supabase/client";
import type { BlogPublicPage } from "@/lib/blog";

export type PublicPageFiche = {
  id: string;
  public_page: BlogPublicPage;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  public_note: string | null;
  sort_order: number;
};

const select = "id, public_page, name, city, address, phone, public_note, sort_order";

export async function fetchPublicPageFiches(page: BlogPublicPage) {
  const { data, error } = await supabase
    .from("public_page_fiches")
    .select(select)
    .eq("public_page", page)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicPageFiche[];
}
