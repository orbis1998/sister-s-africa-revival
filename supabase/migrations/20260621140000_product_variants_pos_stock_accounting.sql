-- Product weight variants, POS sale stock decrement, accounting helpers

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  weight_value numeric(12,3) NOT NULL CHECK (weight_value > 0),
  weight_unit text NOT NULL CHECK (weight_unit IN ('g', 'kg')),
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  price_fcfa integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, weight_value, weight_unit)
);

CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants(product_id, sort_order);

INSERT INTO public.product_variants (product_id, weight_value, weight_unit, price_usd, price_fcfa, sort_order)
SELECT p.id, 1, 'kg', p.price_usd, p.price_fcfa, 0
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id
);

GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active product variants" ON public.product_variants;
CREATE POLICY "Public read active product variants"
ON public.product_variants FOR SELECT TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage product variants" ON public.product_variants;
CREATE POLICY "Admins manage product variants"
ON public.product_variants FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers manage product variants" ON public.product_variants;
CREATE POLICY "Managers manage product variants"
ON public.product_variants FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid() AND mp.can_manage_products = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid() AND mp.can_manage_products = true
  )
);

DROP TRIGGER IF EXISTS product_variants_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.record_pos_sale(
  p_pos_id uuid,
  p_sold_by uuid,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_total_fcfa integer,
  p_total_usd numeric,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_current_qty integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun article dans la vente';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_product_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Article POS invalide';
    END IF;

    SELECT quantity INTO v_current_qty
    FROM public.stock
    WHERE product_id = v_product_id AND pos_id = p_pos_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
      RAISE EXCEPTION 'Aucun stock POS configuré pour ce produit';
    END IF;
    IF v_current_qty < v_qty THEN
      RAISE EXCEPTION 'Stock insuffisant (disponible: %, demandé: %)', v_current_qty, v_qty;
    END IF;
  END LOOP;

  INSERT INTO public.pos_sales (
    pos_id, sold_by, customer_name, customer_phone, payment_method, total_fcfa, total_usd, items
  ) VALUES (
    p_pos_id, p_sold_by, NULLIF(p_customer_name, ''), NULLIF(p_customer_phone, ''),
    COALESCE(NULLIF(p_payment_method, ''), 'cash'), p_total_fcfa, p_total_usd, p_items
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;

    UPDATE public.stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE product_id = v_product_id AND pos_id = p_pos_id;

    INSERT INTO public.stock_movements (product_id, pos_id, delta, reason, created_by)
    VALUES (v_product_id, p_pos_id, -v_qty, 'Vente POS ' || v_sale_id::text, p_sold_by);
  END LOOP;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale TO authenticated, service_role;
