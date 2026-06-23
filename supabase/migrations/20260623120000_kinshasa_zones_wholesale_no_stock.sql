-- Kinshasa delivery zones + wholesale sales without stock decrement

ALTER TABLE public.commune_delivery_fees
  ADD COLUMN IF NOT EXISTS zone text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_zone text NOT NULL DEFAULT '';

ALTER TABLE public.commune_delivery_fees
  DROP CONSTRAINT IF EXISTS commune_delivery_fees_country_code_city_commune_key;

ALTER TABLE public.commune_delivery_fees
  DROP CONSTRAINT IF EXISTS commune_delivery_fees_country_code_city_commune_zone_key;

ALTER TABLE public.commune_delivery_fees
  ADD CONSTRAINT commune_delivery_fees_country_code_city_commune_zone_key
  UNIQUE (country_code, city, commune, zone);

CREATE INDEX IF NOT EXISTS commune_delivery_fees_zone_idx
  ON public.commune_delivery_fees(country_code, city, commune, zone);

-- Wholesale: record sale only, no stock movement
CREATE OR REPLACE FUNCTION public.record_wholesale_sale(
  p_created_by uuid,
  p_city_scope text,
  p_pos_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_product_id uuid,
  p_variant_id uuid,
  p_product_name text,
  p_quantity integer,
  p_unit_price_usd numeric,
  p_unit_price_fcfa integer,
  p_payment_status text,
  p_notes text,
  p_sold_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_product_id uuid;
  v_qty integer;
BEGIN
  IF p_pos_id IS NULL THEN
    RAISE EXCEPTION 'Aucun point de vente associé';
  END IF;
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Nom client requis';
  END IF;

  v_qty := GREATEST(1, COALESCE(p_quantity, 1));
  v_product_id := p_product_id;

  IF p_variant_id IS NOT NULL THEN
    SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = p_variant_id;
  END IF;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Produit requis';
  END IF;

  INSERT INTO public.wholesale_sales (
    created_by, city_scope, pos_id, customer_name, customer_phone,
    product_id, product_name, quantity,
    unit_price_usd, unit_price_fcfa,
    total_usd, total_fcfa,
    payment_status, notes, sold_at
  ) VALUES (
    p_created_by, p_city_scope, p_pos_id,
    btrim(p_customer_name), NULLIF(btrim(COALESCE(p_customer_phone, '')), ''),
    v_product_id, btrim(p_product_name), v_qty,
    COALESCE(p_unit_price_usd, 0), COALESCE(p_unit_price_fcfa, 0),
    COALESCE(p_unit_price_usd, 0) * v_qty, COALESCE(p_unit_price_fcfa, 0) * v_qty,
    COALESCE(NULLIF(p_payment_status, ''), 'pending'),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    COALESCE(p_sold_at, now())
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_wholesale_sale TO authenticated, service_role;

-- Kinshasa: communes + quartiers (zone)
INSERT INTO public.commune_delivery_fees (country_code, city, commune, zone, city_scope, fee_fcfa, fee_usd)
SELECT v.country_code, v.city, v.commune, v.zone, 'kinshasa', 0, 0
FROM (VALUES
  ('CD', 'Kinshasa', 'Gombe', ''),
  ('CD', 'Kinshasa', 'Lingwala', ''),
  ('CD', 'Kinshasa', 'Kinshasa', ''),
  ('CD', 'Kinshasa', 'Kintambo', 'Mimosa'),
  ('CD', 'Kinshasa', 'Kintambo', 'Mont Fleuri'),
  ('CD', 'Kinshasa', 'Kintambo', 'Babylone'),
  ('CD', 'Kinshasa', 'Kintambo', 'Jamaïque'),
  ('CD', 'Kinshasa', 'Kintambo', 'Komorico'),
  ('CD', 'Kinshasa', 'Kalamu', 'Victoire'),
  ('CD', 'Kinshasa', 'Kalamu', 'Matonge'),
  ('CD', 'Kinshasa', 'Kalamu', 'Yolo'),
  ('CD', 'Kinshasa', 'Kalamu', 'Kimwenza'),
  ('CD', 'Kinshasa', 'Bandalungwa', ''),
  ('CD', 'Kinshasa', 'Ngaliema', 'GB'),
  ('CD', 'Kinshasa', 'Ngaliema', 'Macampagne'),
  ('CD', 'Kinshasa', 'Ngaliema', 'Ozone'),
  ('CD', 'Kinshasa', 'Ngaliema', 'Golf'),
  ('CD', 'Kinshasa', 'Ngaliema', 'Delvaux'),
  ('CD', 'Kinshasa', 'Ngaliema', 'Pigeon'),
  ('CD', 'Kinshasa', 'Ngaliema', 'UPN'),
  ('CD', 'Kinshasa', 'Ngaliema', 'Pompage'),
  ('CD', 'Kinshasa', 'Barumbu', 'Barumbu'),
  ('CD', 'Kinshasa', 'Barumbu', 'Baramoto'),
  ('CD', 'Kinshasa', 'Barumbu', 'Kasaï'),
  ('CD', 'Kinshasa', 'Kasa-Vubu', ''),
  ('CD', 'Kinshasa', 'Ngiri-Ngiri', ''),
  ('CD', 'Kinshasa', 'Makala', ''),
  ('CD', 'Kinshasa', 'Ngaba', ''),
  ('CD', 'Kinshasa', 'Kisenso', ''),
  ('CD', 'Kinshasa', 'Matete', ''),
  ('CD', 'Kinshasa', 'Selembao', ''),
  ('CD', 'Kinshasa', 'Bumbu', ''),
  ('CD', 'Kinshasa', 'Limete', ''),
  ('CD', 'Kinshasa', 'Masina', 'Ndjili'),
  ('CD', 'Kinshasa', 'Mont-Ngafula', 'Liyolo'),
  ('CD', 'Kinshasa', 'Mont-Ngafula', 'Cité Verte'),
  ('CD', 'Kinshasa', 'Mont-Ngafula', 'Camp Badiading'),
  ('CD', 'Kinshasa', 'Mont-Ngafula', 'Mitendi'),
  ('CD', 'Kinshasa', 'Lemba', 'Salongo'),
  ('CD', 'Kinshasa', 'Lemba', 'Super'),
  ('CD', 'Kinshasa', 'Lemba', 'Livulu'),
  ('CD', 'Kinshasa', 'Lemba', 'Terminus'),
  ('CD', 'Kinshasa', 'Lemba', 'Imbu'),
  ('CD', 'Kinshasa', 'Plateau', ''),
  ('CD', 'Kinshasa', 'Matadi Kibala', ''),
  ('CD', 'Kinshasa', 'Mokali', ''),
  ('CD', 'Kinshasa', 'Sekomaf', ''),
  ('CD', 'Kinshasa', 'Kingasani', ''),
  ('CD', 'Kinshasa', 'Maluku', ''),
  ('CD', 'Kinshasa', 'Nsele', ''),
  ('CD', 'Kinshasa', 'Aéroport de N''Djili', ''),
  ('CD', 'Kinshasa', 'Sangamamba', '')
) AS v(country_code, city, commune, zone)
ON CONFLICT (country_code, city, commune, zone) DO NOTHING;
