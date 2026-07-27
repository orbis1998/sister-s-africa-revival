-- Fix POS and wholesale stock deduction when variant_id is product_id or missing.
-- Also add backfill helper for orders flagged without movements.

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
  v_rows integer;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun article dans la vente';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT r.v_product_id, r.v_variant_id
    INTO v_product_id, v_variant_id
    FROM public.resolve_order_item_variant(v_item) AS r;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Produit introuvable: %', COALESCE(v_item->>'name', 'article');
    END IF;
    IF v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Variante introuvable pour %', COALESCE(v_item->>'name', 'article');
    END IF;

    SELECT quantity INTO v_current_qty
    FROM public.stock
    WHERE variant_id = v_variant_id AND pos_id = p_pos_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
      RAISE EXCEPTION 'Stock POS non configuré pour %', COALESCE(v_item->>'name', 'article');
    END IF;
    IF v_current_qty < v_qty THEN
      RAISE EXCEPTION 'Stock insuffisant pour % (dispo: %, demandé: %)', COALESCE(v_item->>'name', 'article'), v_current_qty, v_qty;
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
    v_qty := COALESCE((v_item->>'qty')::integer, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT r.v_product_id, r.v_variant_id
    INTO v_product_id, v_variant_id
    FROM public.resolve_order_item_variant(v_item) AS r;

    IF v_product_id IS NULL OR v_variant_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT quantity INTO v_current_qty
    FROM public.stock
    WHERE variant_id = v_variant_id AND pos_id = p_pos_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
      INSERT INTO public.stock (product_id, variant_id, pos_id, quantity, low_stock_threshold)
      VALUES (v_product_id, v_variant_id, p_pos_id, 0, 5)
      ON CONFLICT (variant_id, pos_id) DO NOTHING;
      v_current_qty := 0;
    END IF;

    UPDATE public.stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE variant_id = v_variant_id AND pos_id = p_pos_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Échec déduction stock pour %', COALESCE(v_item->>'name', 'article');
    END IF;

    INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
    VALUES (v_product_id, v_variant_id, p_pos_id, -v_qty, 'Vente POS ' || v_sale_id::text, p_sold_by);
  END LOOP;

  RETURN v_sale_id;
END;
$$;

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
  v_variant_id uuid;
  v_product_id uuid;
  v_qty integer;
  v_current_qty integer;
  v_rows integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_created_by THEN
    RAISE EXCEPTION 'Forbidden: identité non concordante';
  END IF;

  IF NOT public.has_role(p_created_by, 'admin') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.manager_permissions mp
      JOIN public.profiles p ON p.id = p_created_by
      WHERE mp.user_id = p_created_by
        AND mp.can_record_wholesale = true
        AND p.city_scope = p_city_scope
        AND p_pos_id = ANY(mp.pos_ids)
    ) THEN
      RAISE EXCEPTION 'Forbidden: vente en gros non autorisée pour ce POS';
    END IF;
  END IF;

  IF p_pos_id IS NULL THEN
    RAISE EXCEPTION 'Aucun point de vente associé';
  END IF;
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Nom client requis';
  END IF;

  v_qty := GREATEST(1, COALESCE(p_quantity, 1));
  v_product_id := p_product_id;
  v_variant_id := p_variant_id;

  IF v_variant_id IS NOT NULL THEN
    SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = v_variant_id;
  END IF;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Produit requis';
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
    RAISE EXCEPTION 'Stock POS non configuré pour %', COALESCE(p_product_name, 'ce produit');
  END IF;
  IF v_current_qty < v_qty THEN
    RAISE EXCEPTION 'Stock insuffisant pour % (dispo: %, demandé: %)',
      COALESCE(p_product_name, 'produit'), v_current_qty, v_qty;
  END IF;

  INSERT INTO public.wholesale_sales (
    created_by, city_scope, pos_id, customer_name, customer_phone,
    product_id, product_name, quantity,
    unit_price_usd, unit_price_fcfa, total_usd, total_fcfa,
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

  UPDATE public.stock
  SET quantity = quantity - v_qty, updated_at = now()
  WHERE variant_id = v_variant_id AND pos_id = p_pos_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Échec déduction stock pour %', COALESCE(p_product_name, 'produit');
  END IF;

  INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
  VALUES (v_product_id, v_variant_id, p_pos_id, -v_qty, 'Vente en gros ' || v_sale_id::text, p_created_by);

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_wholesale_sale TO authenticated, service_role;

-- Backfill: reset stock_decremented flag on delivered orders with no stock movement.
DO $$
DECLARE
  r record;
  v_actor uuid;
BEGIN
  SELECT id INTO v_actor FROM public.profiles ORDER BY created_at LIMIT 1;

  FOR r IN
    SELECT o.id
    FROM public.orders o
    WHERE o.status = 'delivered'
      AND o.stock_decremented = true
      AND NOT EXISTS (
        SELECT 1 FROM public.stock_movements sm
        WHERE sm.reason LIKE 'Livraison commande ' || o.order_number || '%'
           OR sm.reason LIKE 'Rattrapage livraison ' || o.order_number || '%'
      )
  LOOP
    BEGIN
      UPDATE public.orders SET stock_decremented = false WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill reset failed for order %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
