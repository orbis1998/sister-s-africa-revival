-- CMS: page points de vente (hero blog), section Notre histoire, stats accueil

ALTER TABLE public.points_of_sale
  ADD COLUMN IF NOT EXISTS public_note text;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS pos_page_eyebrow text NOT NULL DEFAULT 'Points de vente',
  ADD COLUMN IF NOT EXISTS pos_page_title text NOT NULL DEFAULT 'Retrouvez The Sisters Africa près de chez vous.',
  ADD COLUMN IF NOT EXISTS pos_page_cta_label text NOT NULL DEFAULT 'Découvrir les produits',
  ADD COLUMN IF NOT EXISTS pos_page_cta_href text NOT NULL DEFAULT '/products',
  ADD COLUMN IF NOT EXISTS pos_page_cta_secondary_label text NOT NULL DEFAULT 'Nous écrire sur WhatsApp',
  ADD COLUMN IF NOT EXISTS story_eyebrow text NOT NULL DEFAULT 'Notre histoire',
  ADD COLUMN IF NOT EXISTS story_title text NOT NULL DEFAULT 'Deux sœurs, une mission : redéfinir la beauté africaine.',
  ADD COLUMN IF NOT EXISTS story_paragraph_1 text NOT NULL DEFAULT 'Née d''un constat simple — la difficulté pour de nombreuses femmes et enfants d''accéder à une nutrition saine et adaptée — The Sisters Africa s''est donné pour mission de formuler des bouillies bio efficaces, accessibles et délicieuses.',
  ADD COLUMN IF NOT EXISTS story_paragraph_2 text NOT NULL DEFAULT 'Aujourd''hui, des milliers de clientes à travers la RDC, le Congo Brazzaville et au-delà nous font confiance pour leur transformation.',
  ADD COLUMN IF NOT EXISTS home_stats jsonb NOT NULL DEFAULT '[
    {"value": "+10K", "label": "Clientes accompagnées"},
    {"value": "4", "label": "Pays livrés"},
    {"value": "100%", "label": "Origine végétale"},
    {"value": "2 sem.", "label": "Premiers résultats"}
  ]'::jsonb;
