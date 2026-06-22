-- Stock inventory per product variant (1 kg / 2 kg, etc.)

ALTER TABLE public.stock
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Point existing rows at the first active variant of each product
UPDATE public.stock s
SET variant_id = (
  SELECT v.id
  FROM public.product_variants v
  WHERE v.product_id = s.product_id
  ORDER BY v.sort_order, v.weight_value
  LIMIT 1
)
WHERE s.variant_id IS NULL;

-- Allow multiple variants per product/POS before inserting extra rows
ALTER TABLE public.stock DROP CONSTRAINT IF EXISTS stock_product_id_pos_id_key;

-- Ensure every variant has a stock row at each POS (default qty 0)
INSERT INTO public.stock (product_id, variant_id, pos_id, quantity, low_stock_threshold)
SELECT v.product_id, v.id, pos.id, 0, 5
FROM public.product_variants v
CROSS JOIN public.points_of_sale pos
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock s
  WHERE s.variant_id = v.id AND s.pos_id IS NOT DISTINCT FROM pos.id
);

-- Remove duplicate product-level rows when multiple variants share one legacy row
DELETE FROM public.stock s
USING public.stock keeper
WHERE s.variant_id IS NOT NULL
  AND keeper.variant_id IS NOT NULL
  AND s.pos_id IS NOT DISTINCT FROM keeper.pos_id
  AND s.product_id = keeper.product_id
  AND s.id <> keeper.id
  AND s.quantity = 0
  AND keeper.quantity > 0;

ALTER TABLE public.stock
  ALTER COLUMN variant_id SET NOT NULL;

ALTER TABLE public.stock DROP CONSTRAINT IF EXISTS stock_variant_id_pos_id_key;
ALTER TABLE public.stock ADD CONSTRAINT stock_variant_id_pos_id_key UNIQUE (variant_id, pos_id);

CREATE INDEX IF NOT EXISTS stock_variant_pos_idx ON public.stock (variant_id, pos_id);

-- Backfill movement variant_id from product's first variant when missing
UPDATE public.stock_movements sm
SET variant_id = (
  SELECT v.id
  FROM public.product_variants v
  WHERE v.product_id = sm.product_id
  ORDER BY v.sort_order, v.weight_value
  LIMIT 1
)
WHERE sm.variant_id IS NULL;

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
  v_variant_id uuid;
  v_qty integer;
  v_current_qty integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun article dans la vente';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, 0);

    IF v_variant_id IS NOT NULL THEN
      SELECT product_id INTO v_product_id
      FROM public.product_variants
      WHERE id = v_variant_id;
    END IF;

    IF v_product_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Article POS invalide';
    END IF;

    IF v_variant_id IS NULL THEN
      SELECT id INTO v_variant_id
      FROM public.product_variants
      WHERE product_id = v_product_id
      ORDER BY sort_order, weight_value
      LIMIT 1;
    END IF;

    IF v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Aucune variante configurée pour ce produit';
    END IF;

    SELECT quantity INTO v_current_qty
    FROM public.stock
    WHERE variant_id = v_variant_id AND pos_id = p_pos_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
      RAISE EXCEPTION 'Aucun stock POS configuré pour cette variante';
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
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_qty := (v_item->>'qty')::integer;

    IF v_variant_id IS NOT NULL THEN
      SELECT product_id INTO v_product_id
      FROM public.product_variants
      WHERE id = v_variant_id;
    END IF;

    IF v_variant_id IS NULL AND v_product_id IS NOT NULL THEN
      SELECT id INTO v_variant_id
      FROM public.product_variants
      WHERE product_id = v_product_id
      ORDER BY sort_order, weight_value
      LIMIT 1;
    END IF;

    UPDATE public.stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE variant_id = v_variant_id AND pos_id = p_pos_id;

    INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
    VALUES (v_product_id, v_variant_id, p_pos_id, -v_qty, 'Vente POS ' || v_sale_id::text, p_sold_by);
  END LOOP;

  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_delivery_stock(
  p_order_id uuid,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_current_qty integer;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.stock_decremented THEN RETURN; END IF;
  IF v_order.pos_id IS NULL THEN
    RAISE EXCEPTION 'Aucun POS associé à cette commande';
  END IF;
  IF v_order.items IS NULL OR jsonb_array_length(v_order.items) = 0 THEN
    UPDATE public.orders SET stock_decremented = true WHERE id = p_order_id;
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_order.items)
  LOOP
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    v_product_id := NULL;
    v_variant_id := NULLIF(v_item->>'variantId', '')::uuid;

    IF v_variant_id IS NOT NULL THEN
      SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = v_variant_id;
      IF v_product_id IS NULL THEN v_product_id := v_variant_id; END IF;
    END IF;

    IF v_product_id IS NULL AND v_item->>'slug' IS NOT NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = v_item->>'slug' LIMIT 1;
    END IF;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Produit introuvable: %', COALESCE(v_item->>'name', 'article');
    END IF;

    IF v_variant_id IS NULL THEN
      SELECT id INTO v_variant_id
      FROM public.product_variants
      WHERE product_id = v_product_id
      ORDER BY sort_order, weight_value
      LIMIT 1;
    END IF;

    IF v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Variante introuvable pour %', COALESCE(v_item->>'name', 'article');
    END IF;

    SELECT quantity INTO v_current_qty
    FROM public.stock
    WHERE variant_id = v_variant_id AND pos_id = v_order.pos_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
      RAISE EXCEPTION 'Stock POS non configuré pour %', COALESCE(v_item->>'name', 'article');
    END IF;
    IF v_current_qty < v_qty THEN
      RAISE EXCEPTION 'Stock insuffisant pour % (dispo: %, demandé: %)', COALESCE(v_item->>'name', 'article'), v_current_qty, v_qty;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_order.items)
  LOOP
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    v_product_id := NULL;
    v_variant_id := NULLIF(v_item->>'variantId', '')::uuid;

    IF v_variant_id IS NOT NULL THEN
      SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = v_variant_id;
      IF v_product_id IS NULL THEN v_product_id := v_variant_id; END IF;
    END IF;

    IF v_product_id IS NULL AND v_item->>'slug' IS NOT NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE slug = v_item->>'slug' LIMIT 1;
    END IF;

    IF v_variant_id IS NULL AND v_product_id IS NOT NULL THEN
      SELECT id INTO v_variant_id
      FROM public.product_variants
      WHERE product_id = v_product_id
      ORDER BY sort_order, weight_value
      LIMIT 1;
    END IF;

    UPDATE public.stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE variant_id = v_variant_id AND pos_id = v_order.pos_id;

    INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
    VALUES (v_product_id, v_variant_id, v_order.pos_id, -v_qty, 'Livraison commande ' || v_order.order_number, p_actor);
  END LOOP;

  UPDATE public.orders SET stock_decremented = true WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_order_delivery_stock TO authenticated, service_role;
