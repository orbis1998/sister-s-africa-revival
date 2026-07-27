-- Fix: delivery stock silently skipped when order items store product id as variantId.
-- Also backfill pos_id on delivery and reset wrongly flagged stock_decremented orders.

CREATE OR REPLACE FUNCTION public.resolve_order_item_variant(
  v_item jsonb,
  OUT v_product_id uuid,
  OUT v_variant_id uuid
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_raw uuid;
BEGIN
  v_product_id := NULL;
  v_variant_id := NULL;
  v_raw := COALESCE(
    NULLIF(v_item->>'variantId', ''),
    NULLIF(v_item->>'variant_id', '')
  )::uuid;

  IF v_raw IS NOT NULL THEN
    SELECT id, product_id INTO v_variant_id, v_product_id
    FROM public.product_variants
    WHERE id = v_raw;

    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id FROM public.products WHERE id = v_raw LIMIT 1;
      IF v_product_id IS NOT NULL THEN
        v_variant_id := NULL;
      END IF;
    END IF;
  END IF;

  IF v_product_id IS NULL AND v_item->>'slug' IS NOT NULL THEN
    SELECT id INTO v_product_id FROM public.products WHERE slug = v_item->>'slug' LIMIT 1;
  END IF;

  IF v_product_id IS NULL AND v_item->>'product_id' IS NOT NULL THEN
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
  END IF;

  IF v_variant_id IS NULL AND v_product_id IS NOT NULL THEN
    SELECT id INTO v_variant_id
    FROM public.product_variants
    WHERE product_id = v_product_id
    ORDER BY sort_order, weight_value
    LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_delivery_stock(
  p_order_id uuid,
  p_actor uuid,
  p_force boolean DEFAULT false
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
  v_rows integer;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  IF v_order.pos_id IS NULL AND v_order.city_scope IS NOT NULL THEN
    v_order.pos_id := public.resolve_pos_for_scope(v_order.city_scope, '{}');
    IF v_order.pos_id IS NOT NULL THEN
      UPDATE public.orders SET pos_id = v_order.pos_id WHERE id = p_order_id;
    END IF;
  END IF;

  IF v_order.stock_decremented THEN
    SELECT count(*) INTO v_rows
    FROM public.stock_movements sm
    WHERE sm.reason LIKE 'Livraison commande ' || v_order.order_number || '%'
       OR sm.reason LIKE 'Rattrapage livraison ' || v_order.order_number || '%';
    IF v_rows > 0 THEN
      RETURN;
    END IF;
    UPDATE public.orders SET stock_decremented = false WHERE id = p_order_id;
    v_order.stock_decremented := false;
  END IF;

  IF v_order.pos_id IS NULL THEN
    RAISE EXCEPTION 'Aucun POS associé à cette commande';
  END IF;

  IF v_order.items IS NULL OR jsonb_array_length(v_order.items) = 0 THEN
    UPDATE public.orders SET stock_decremented = true WHERE id = p_order_id;
    RETURN;
  END IF;

  IF NOT p_force THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_order.items)
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
      WHERE variant_id = v_variant_id AND pos_id = v_order.pos_id
      FOR UPDATE;

      IF v_current_qty IS NULL THEN
        RAISE EXCEPTION 'Stock POS non configuré pour %', COALESCE(v_item->>'name', 'article');
      END IF;
      IF v_current_qty < v_qty THEN
        RAISE EXCEPTION 'Stock insuffisant pour % (dispo: %, demandé: %)', COALESCE(v_item->>'name', 'article'), v_current_qty, v_qty;
      END IF;
    END LOOP;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_order.items)
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
    WHERE variant_id = v_variant_id AND pos_id = v_order.pos_id
    FOR UPDATE;

    IF v_current_qty IS NULL THEN
      INSERT INTO public.stock (product_id, variant_id, pos_id, quantity, low_stock_threshold)
      VALUES (v_product_id, v_variant_id, v_order.pos_id, 0, 5)
      ON CONFLICT (variant_id, pos_id) DO NOTHING;
      v_current_qty := 0;
    END IF;

    UPDATE public.stock
    SET quantity = CASE
      WHEN p_force THEN GREATEST(quantity - v_qty, 0)
      ELSE quantity - v_qty
    END,
    updated_at = now()
    WHERE variant_id = v_variant_id AND pos_id = v_order.pos_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Échec déduction stock pour %', COALESCE(v_item->>'name', 'article');
    END IF;

    INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
    VALUES (
      v_product_id,
      v_variant_id,
      v_order.pos_id,
      -v_qty,
      CASE WHEN p_force THEN 'Rattrapage livraison ' || v_order.order_number ELSE 'Livraison commande ' || v_order.order_number END,
      p_actor
    );
  END LOOP;

  UPDATE public.orders SET stock_decremented = true WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.deliver_order_with_stock(
  p_order_id uuid,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  IF v_order.status = 'delivered' THEN
    PERFORM public.record_order_delivery_stock(p_order_id, p_actor, false);
    RETURN;
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Impossible de livrer une commande annulée';
  END IF;

  PERFORM public.record_order_delivery_stock(p_order_id, p_actor, false);

  UPDATE public.orders
  SET status = 'delivered',
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_order_item_variant(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_order_delivery_stock(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deliver_order_with_stock(uuid, uuid) TO authenticated, service_role;

-- Re-run delivery stock for delivered orders flagged without movements (Kinshasa/Katanga historical bug).
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
      AND NOT EXISTS (
        SELECT 1 FROM public.stock_movements sm
        WHERE sm.reason LIKE 'Livraison commande ' || o.order_number || '%'
           OR sm.reason LIKE 'Rattrapage livraison ' || o.order_number || '%'
      )
    ORDER BY COALESCE(o.delivered_at, o.created_at) ASC, o.id ASC
  LOOP
    BEGIN
      UPDATE public.orders SET stock_decremented = false WHERE id = r.id;
      PERFORM public.record_order_delivery_stock(r.id, v_actor, true);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill stock failed for order %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
