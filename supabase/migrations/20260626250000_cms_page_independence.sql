-- Decouple CMS content per public page: blog slugs scoped by page, independent fiches table.

-- 1) Blog posts: same slug allowed on different pages (no cross-page overwrite)
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_slug_key;
DROP INDEX IF EXISTS blog_posts_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_public_page_key
  ON public.blog_posts (slug, public_page);

-- 2) Independent fiches for points de vente / expédition (not tied to operational POS)
CREATE TABLE IF NOT EXISTS public.public_page_fiches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_page text NOT NULL,
  name text NOT NULL,
  city text,
  address text,
  phone text,
  public_note text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_page_fiches
  DROP CONSTRAINT IF EXISTS public_page_fiches_public_page_check;

ALTER TABLE public.public_page_fiches
  ADD CONSTRAINT public_page_fiches_public_page_check
  CHECK (public_page IN ('points_de_vente', 'expedition'));

CREATE INDEX IF NOT EXISTS public_page_fiches_page_idx
  ON public.public_page_fiches (public_page, is_published, sort_order);

GRANT SELECT ON public.public_page_fiches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_page_fiches TO service_role;

ALTER TABLE public.public_page_fiches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published page fiches" ON public.public_page_fiches;
CREATE POLICY "Public read published page fiches"
ON public.public_page_fiches FOR SELECT TO anon, authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage page fiches" ON public.public_page_fiches;
CREATE POLICY "Admins manage page fiches"
ON public.public_page_fiches FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS public_page_fiches_updated_at ON public.public_page_fiches;
CREATE TRIGGER public_page_fiches_updated_at
BEFORE UPDATE ON public.public_page_fiches
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Migrate existing CMS cards from POS (one-time copy, independent copies per page)
INSERT INTO public.public_page_fiches (public_page, name, city, address, phone, public_note, sort_order, is_published)
SELECT
  CASE
    WHEN p.public_listing = 'retail' THEN 'points_de_vente'
    WHEN p.public_listing = 'expedition' THEN 'expedition'
  END,
  p.name,
  p.city,
  p.address,
  p.phone,
  p.public_note,
  0,
  true
FROM public.points_of_sale p
WHERE p.public_listing IN ('retail', 'expedition')
  AND NOT EXISTS (
    SELECT 1
    FROM public.public_page_fiches f
    WHERE f.public_page = CASE
      WHEN p.public_listing = 'retail' THEN 'points_de_vente'
      WHEN p.public_listing = 'expedition' THEN 'expedition'
    END
    AND f.name = p.name
    AND COALESCE(f.city, '') = COALESCE(p.city, '')
  );
