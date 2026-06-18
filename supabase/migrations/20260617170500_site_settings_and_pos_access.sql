-- Site settings editable by admins
-- Requires 20260617170400_add_pos_app_role.sql to be committed first.

CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  hero_eyebrow text NOT NULL DEFAULT 'Powered by The Sisters · 100% Bio',
  hero_title text NOT NULL DEFAULT 'La prise de poids, naturelle et saine.',
  hero_highlight text NOT NULL DEFAULT 'naturelle',
  hero_subtitle text NOT NULL DEFAULT 'Des bouillies bio d''origine végétale, conçues en Afrique pour révéler vos courbes et soutenir la croissance de vos enfants.',
  cta_label text NOT NULL DEFAULT 'Découvre nos produits',
  cta_href text NOT NULL DEFAULT '/products',
  whatsapp_number text NOT NULL DEFAULT '243994186790',
  hero_images text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.site_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site settings"
ON public.site_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update site settings"
ON public.site_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert site settings"
ON public.site_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public can view site assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-assets');

CREATE POLICY "Admins can upload site assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- POS user access and daily accounting
CREATE TABLE IF NOT EXISTS public.pos_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pos_id uuid NOT NULL REFERENCES public.points_of_sale(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pos_accounts TO authenticated;
GRANT ALL ON public.pos_accounts TO service_role;
ALTER TABLE public.pos_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "POS users read own assignment"
ON public.pos_accounts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_id uuid NOT NULL REFERENCES public.points_of_sale(id) ON DELETE CASCADE,
  sold_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_fcfa integer NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pos_sales TO authenticated;
GRANT ALL ON public.pos_sales TO service_role;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all POS sales"
ON public.pos_sales FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "POS users read own POS sales"
ON public.pos_sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'pos')
  AND EXISTS (
    SELECT 1 FROM public.pos_accounts pa
    WHERE pa.user_id = auth.uid()
      AND pa.pos_id = pos_sales.pos_id
  )
);

CREATE POLICY "POS users create own POS sales"
ON public.pos_sales FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'pos')
  AND sold_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pos_accounts pa
    WHERE pa.user_id = auth.uid()
      AND pa.pos_id = pos_sales.pos_id
  )
);

CREATE INDEX IF NOT EXISTS pos_sales_pos_created_idx
ON public.pos_sales(pos_id, created_at DESC);

CREATE POLICY "POS users read own POS stock"
ON public.stock FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'pos')
  AND EXISTS (
    SELECT 1 FROM public.pos_accounts pa
    WHERE pa.user_id = auth.uid()
      AND pa.pos_id = stock.pos_id
  )
);
