-- Manager finance: RLS OR policies, stock read for wholesale, profile backfill, secure RPC

-- Backfill accounting read flag for recorders
UPDATE public.manager_permissions
SET can_view_accounting = true
WHERE (can_record_wholesale = true OR can_record_expenses = true)
  AND can_view_accounting = false;

-- Backfill manager profile city_scope from assigned POS
UPDATE public.profiles p
SET city_scope = sub.scope
FROM (
  SELECT DISTINCT ON (mp.user_id)
    mp.user_id,
    COALESCE(pos.city_scope, CASE pos.city
      WHEN 'Kinshasa' THEN 'kinshasa'
      WHEN 'Lubumbashi' THEN 'katanga'
      WHEN 'Kolwezi' THEN 'katanga'
      WHEN 'Likasi' THEN 'katanga'
      WHEN 'Katanga' THEN 'katanga'
      WHEN 'Brazzaville' THEN 'brazzaville'
      WHEN 'Pointe-Noire' THEN 'pointe-noire'
      ELSE NULL
    END) AS scope
  FROM public.manager_permissions mp
  CROSS JOIN LATERAL unnest(mp.pos_ids) AS pid(pos_id)
  JOIN public.points_of_sale pos ON pos.id = pid.pos_id
  WHERE mp.pos_ids IS NOT NULL AND cardinality(mp.pos_ids) > 0
  ORDER BY mp.user_id, pos.name
) sub
WHERE p.id = sub.user_id
  AND p.city_scope IS NULL
  AND sub.scope IS NOT NULL;

-- Wholesale RLS (OR read, single-flag write)
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
      AND (mp.can_record_wholesale = true OR mp.can_view_accounting = true)
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
      AND mp.can_record_wholesale = true
  )
);

-- Expenses RLS
DROP POLICY IF EXISTS "Managers read city expenses" ON public.staff_expenses;
DROP POLICY IF EXISTS "Managers create city expenses" ON public.staff_expenses;

CREATE POLICY "Managers read city expenses"
ON public.staff_expenses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND (mp.can_record_expenses = true OR mp.can_view_accounting = true)
  )
);

CREATE POLICY "Managers create city expenses"
ON public.staff_expenses FOR INSERT TO authenticated
WITH CHECK (
  reported_by = auth.uid()
  AND public.has_role(auth.uid(), 'manager')
  AND city_scope = (SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND mp.can_record_expenses = true
  )
);

-- Stock read for wholesale managers at assigned POS
DROP POLICY IF EXISTS "Managers read assigned POS stock" ON public.stock;
CREATE POLICY "Managers read assigned POS stock"
ON public.stock FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND pos_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND pos_id = ANY(mp.pos_ids)
      AND (
        mp.can_manage_stock = true
        OR mp.can_manage_pos = true
        OR mp.can_record_wholesale = true
      )
  )
);

-- Secure wholesale RPC with permission + POS assignment checks
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

  INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
  VALUES (v_product_id, v_variant_id, p_pos_id, -v_qty, 'Vente en gros ' || v_sale_id::text, p_created_by);

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_wholesale_sale TO authenticated, service_role;
