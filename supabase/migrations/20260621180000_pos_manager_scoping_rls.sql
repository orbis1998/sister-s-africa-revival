-- POS-centric stock, manager/livreur scoping, order delivery stock decrement

ALTER TABLE public.manager_permissions
  ADD COLUMN IF NOT EXISTS can_record_wholesale boolean NOT NULL DEFAULT false;

ALTER TABLE public.points_of_sale
  ADD COLUMN IF NOT EXISTS city_scope text CHECK (
    city_scope IS NULL OR city_scope IN ('kinshasa', 'katanga', 'brazzaville', 'pointe-noire')
  ),
  ADD COLUMN IF NOT EXISTS manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pos_id uuid REFERENCES public.points_of_sale(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pos_id uuid REFERENCES public.points_of_sale(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stock_decremented boolean NOT NULL DEFAULT false;

ALTER TABLE public.wholesale_sales
  ADD COLUMN IF NOT EXISTS pos_id uuid REFERENCES public.points_of_sale(id) ON DELETE SET NULL;

UPDATE public.points_of_sale
SET city_scope = CASE
  WHEN city = 'Kinshasa' THEN 'kinshasa'
  WHEN city IN ('Lubumbashi', 'Kolwezi', 'Likasi', 'Katanga') THEN 'katanga'
  WHEN city = 'Brazzaville' THEN 'brazzaville'
  WHEN city IN ('Pointe-Noire', 'Pointe noir', 'Pointe Noire') THEN 'pointe-noire'
  ELSE city_scope
END
WHERE city_scope IS NULL;

UPDATE public.orders o
SET pos_id = (
  SELECT p.id FROM public.points_of_sale p
  WHERE p.city_scope = o.city_scope
  ORDER BY p.created_at
  LIMIT 1
)
WHERE pos_id IS NULL AND o.city_scope IS NOT NULL;

CREATE INDEX IF NOT EXISTS points_of_sale_city_scope_idx ON public.points_of_sale(city_scope);
CREATE INDEX IF NOT EXISTS orders_pos_id_idx ON public.orders(pos_id);
CREATE INDEX IF NOT EXISTS profiles_pos_id_idx ON public.profiles(pos_id);

CREATE OR REPLACE FUNCTION public.manager_pos_ids(_uid uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(pos_ids, '{}') FROM public.manager_permissions WHERE user_id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.resolve_pos_for_scope(p_scope text, p_preferred uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_preferred IS NOT NULL AND array_length(p_preferred, 1) > 0 THEN
    SELECT id INTO v_id FROM public.points_of_sale
    WHERE id = ANY(p_preferred) AND city_scope = p_scope
    ORDER BY created_at LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    SELECT id INTO v_id FROM public.points_of_sale
    WHERE id = ANY(p_preferred)
    ORDER BY created_at LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT id INTO v_id FROM public.points_of_sale
  WHERE city_scope = p_scope
  ORDER BY created_at LIMIT 1;
  RETURN v_id;
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

    SELECT quantity INTO v_current_qty
    FROM public.stock
    WHERE product_id = v_product_id AND pos_id = v_order.pos_id
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

    UPDATE public.stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE product_id = v_product_id AND pos_id = v_order.pos_id;

    INSERT INTO public.stock_movements (product_id, pos_id, delta, reason, created_by)
    VALUES (v_product_id, v_order.pos_id, -v_qty, 'Livraison commande ' || v_order.order_number, p_actor);
  END LOOP;

  UPDATE public.orders SET stock_decremented = true WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manager_pos_ids TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_pos_for_scope TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_order_delivery_stock TO authenticated, service_role;

-- Stock RLS: managers with can_manage_stock see only assigned POS
DROP POLICY IF EXISTS "Stock staff read" ON public.stock;
DROP POLICY IF EXISTS "Admins read all stock" ON public.stock;
DROP POLICY IF EXISTS "Managers read assigned POS stock" ON public.stock;

CREATE POLICY "Admins read all stock"
ON public.stock FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers read assigned POS stock"
ON public.stock FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND pos_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND mp.can_manage_stock = true
      AND pos_id = ANY(mp.pos_ids)
  )
);

-- Stock movements RLS
DROP POLICY IF EXISTS "Movements staff read" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins read all stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Managers read assigned POS movements" ON public.stock_movements;

CREATE POLICY "Admins read all stock movements"
ON public.stock_movements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers read assigned POS movements"
ON public.stock_movements FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND pos_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND mp.can_manage_stock = true
      AND pos_id = ANY(mp.pos_ids)
  )
);

-- POS sales: managers see assigned POS sales if they have POS or accounting permission
DROP POLICY IF EXISTS "Managers read assigned POS sales" ON public.pos_sales;
CREATE POLICY "Managers read assigned POS sales"
ON public.pos_sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND (mp.can_manage_pos = true OR mp.can_view_accounting = true)
      AND pos_id = ANY(mp.pos_ids)
  )
);

-- Wholesale: require can_view_accounting AND can_record_wholesale
DROP POLICY IF EXISTS "Managers read city wholesale sales" ON public.wholesale_sales;
DROP POLICY IF EXISTS "Managers create city wholesale sales" ON public.wholesale_sales;

CREATE POLICY "Managers read city wholesale sales"
ON public.wholesale_sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND mp.can_view_accounting = true
      AND mp.can_record_wholesale = true
  )
);

CREATE POLICY "Managers create city wholesale sales"
ON public.wholesale_sales FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.has_role(auth.uid(), 'manager')
  AND city_scope = (SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND mp.can_view_accounting = true
      AND mp.can_record_wholesale = true
  )
);
