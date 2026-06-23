-- Manager expense permission + wholesale sale with POS stock decrement

ALTER TABLE public.manager_permissions
  ADD COLUMN IF NOT EXISTS can_record_expenses boolean NOT NULL DEFAULT false;

-- Existing managers with comptabilité keep expense access
UPDATE public.manager_permissions
SET can_record_expenses = true
WHERE can_view_accounting = true AND can_record_expenses = false;

-- Wholesale sale with stock validation (variant-level, same as POS)
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
    RAISE EXCEPTION 'Stock insuffisant pour % (dispo: %, demandé: %)', COALESCE(p_product_name, 'produit'), v_current_qty, v_qty;
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

  UPDATE public.stock
  SET quantity = quantity - v_qty, updated_at = now()
  WHERE variant_id = v_variant_id AND pos_id = p_pos_id;

  INSERT INTO public.stock_movements (product_id, variant_id, pos_id, delta, reason, created_by)
  VALUES (v_product_id, v_variant_id, p_pos_id, -v_qty, 'Vente en gros ' || v_sale_id::text, p_created_by);

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_wholesale_sale TO authenticated, service_role;

-- Expenses: managers need can_view_accounting AND can_record_expenses
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
      AND mp.can_view_accounting = true
      AND mp.can_record_expenses = true
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
      AND mp.can_view_accounting = true
      AND mp.can_record_expenses = true
  )
);
