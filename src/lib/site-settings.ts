import heroImg from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];

export const defaultSiteSettings: SiteSettings = {
  id: true,
  hero_eyebrow: "Powered by The Sisters · 100% Bio",
  hero_title: "La prise de poids, naturelle et saine.",
  hero_highlight: "naturelle",
  hero_subtitle:
    "Des bouillies bio d'origine végétale, conçues en Afrique pour révéler vos courbes et soutenir la croissance de vos enfants.",
  cta_label: "Découvre nos produits",
  cta_href: "/products",
  whatsapp_number: "243994186790",
  hero_images: [heroImg],
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export async function fetchSiteSettings() {
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, hero_images: data.hero_images.length ? data.hero_images : [heroImg] } : defaultSiteSettings;
}
