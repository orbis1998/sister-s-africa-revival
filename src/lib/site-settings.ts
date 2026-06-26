import heroImg from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type HomeStatCard = { value: string; label: string };

export const defaultHomeStats: HomeStatCard[] = [
  { value: "+10K", label: "Clientes accompagnées" },
  { value: "4", label: "Pays livrés" },
  { value: "100%", label: "Origine végétale" },
  { value: "2 sem.", label: "Premiers résultats" },
];

export type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"] & {
  home_stats?: HomeStatCard[] | null;
};

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
  seo_title: "The Sisters Africa — Bouillies bio pour une prise de poids saine",
  seo_description: "Mass Gainer, Super Grow et Peanut Butter : bouillies bio d'origine végétale. Livraison à Kinshasa, Lubumbashi, Brazzaville et Pointe-Noire.",
  seo_keywords: "The Sisters Africa, bouillie bio, prise de poids, Mass Gainer, Super Grow, Kinshasa, Brazzaville",
  og_image_url: null,
  site_url: "https://thesistersafrica.com",
  twitter_handle: "@thesistersafrica",
  pos_page_eyebrow: "Points de vente",
  pos_page_title: "Retrouvez The Sisters Africa près de chez vous.",
  pos_page_cta_label: "Découvrir les produits",
  pos_page_cta_href: "/products",
  pos_page_cta_secondary_label: "Nous écrire sur WhatsApp",
  expedition_page_eyebrow: "Expédition",
  expedition_page_title: "Nos destinations d'expédition",
  expedition_page_cta_label: "Découvrir les produits",
  expedition_page_cta_href: "/products",
  expedition_page_cta_secondary_label: "Nous écrire sur WhatsApp",
  contact_page_eyebrow: "Contact",
  contact_page_title: "Nous livrons partout en Afrique centrale et au-delà.",
  story_eyebrow: "Notre histoire",
  story_title: "Deux sœurs, une mission : redéfinir la beauté africaine.",
  story_paragraph_1:
    "Née d'un constat simple — la difficulté pour de nombreuses femmes et enfants d'accéder à une nutrition saine et adaptée — The Sisters Africa s'est donné pour mission de formuler des bouillies bio efficaces, accessibles et délicieuses.",
  story_paragraph_2:
    "Aujourd'hui, des milliers de clientes à travers la RDC, le Congo Brazzaville et au-delà nous font confiance pour leur transformation.",
  home_stats: defaultHomeStats,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export async function fetchSiteSettings() {
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return defaultSiteSettings;
  const stats = Array.isArray(data.home_stats) && data.home_stats.length
    ? (data.home_stats as HomeStatCard[])
    : defaultHomeStats;
  return {
    ...data,
    hero_images: data.hero_images.length ? data.hero_images : [heroImg],
    home_stats: stats,
  };
}
