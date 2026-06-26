-- Pages publiques: expédition, contact, filtrage POS et articles

ALTER TABLE public.points_of_sale
  ADD COLUMN IF NOT EXISTS public_listing text NOT NULL DEFAULT 'retail';

ALTER TABLE public.points_of_sale
  DROP CONSTRAINT IF EXISTS points_of_sale_public_listing_check;

ALTER TABLE public.points_of_sale
  ADD CONSTRAINT points_of_sale_public_listing_check
  CHECK (public_listing IN ('retail', 'expedition', 'contact'));

UPDATE public.points_of_sale
SET public_listing = 'contact'
WHERE public_listing = 'retail'
  AND (
    name ILIKE '%BRAZZA%'
    OR name ILIKE '%BUREAU KINSHASA%'
    OR name ILIKE '%KOLWEZI%'
    OR name ILIKE '%LUBUMBASHI%'
    OR name ILIKE '%POINTE%NOIRE%'
    OR name ILIKE '%POINTE-N%'
  );

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS expedition_page_eyebrow text NOT NULL DEFAULT 'Expédition',
  ADD COLUMN IF NOT EXISTS expedition_page_title text NOT NULL DEFAULT 'Nos destinations d''expédition',
  ADD COLUMN IF NOT EXISTS expedition_page_cta_label text NOT NULL DEFAULT 'Découvrir les produits',
  ADD COLUMN IF NOT EXISTS expedition_page_cta_href text NOT NULL DEFAULT '/products',
  ADD COLUMN IF NOT EXISTS expedition_page_cta_secondary_label text NOT NULL DEFAULT 'Nous écrire sur WhatsApp',
  ADD COLUMN IF NOT EXISTS contact_page_eyebrow text NOT NULL DEFAULT 'Contact',
  ADD COLUMN IF NOT EXISTS contact_page_title text NOT NULL DEFAULT 'Nous livrons partout en Afrique centrale et au-delà.';

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS public_page text NOT NULL DEFAULT 'points_de_vente';

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_public_page_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_public_page_check
  CHECK (public_page IN ('points_de_vente', 'expedition', 'both'));
