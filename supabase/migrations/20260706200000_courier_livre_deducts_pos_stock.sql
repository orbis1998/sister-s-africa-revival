-- Same fix as sister-africa-deliveries/scripts/sync-delivery-to-order.sql
-- Ensures courier "livre" triggers record_order_delivery_stock on the livreur's POS.

CREATE OR REPLACE FUNCTION public.resolve_courier_pos_id(p_courier_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_pos_id uuid;
BEGIN
  IF p_courier_id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(c.profile_id, c.id) INTO v_profile_id
  FROM public.couriers c WHERE c.id = p_courier_id;
  IF v_profile_id IS NULL THEN RETURN NULL; END IF;

  SELECT p.pos_id INTO v_pos_id FROM public.profiles p WHERE p.id = v_profile_id;
  RETURN v_pos_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_courier_actor_id(p_courier_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT coalesce(c.profile_id, c.id) FROM public.couriers c WHERE c.id = p_courier_id),
    p_courier_id
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_delivery_status_to_order(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deliveries%rowtype;
  v_order_status public.order_status;
  v_actor uuid;
  v_courier_pos uuid;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = p_delivery_id;
  IF d.id IS NULL OR d.order_id IS NULL THEN RETURN; END IF;

  v_order_status := public.delivery_status_to_order(d.status);
  IF v_order_status IS NULL THEN RETURN; END IF;

  v_actor := public.resolve_courier_actor_id(d.courier_id);
  v_courier_pos := public.resolve_courier_pos_id(d.courier_id);

  IF v_courier_pos IS NOT NULL THEN
    UPDATE public.orders
    SET pos_id = v_courier_pos, updated_at = now()
    WHERE id = d.order_id AND pos_id IS DISTINCT FROM v_courier_pos;
  END IF;

  UPDATE public.orders o
  SET
    status = v_order_status,
    delivered_at = CASE
      WHEN v_order_status = 'delivered'::public.order_status AND o.delivered_at IS NULL THEN now()
      ELSE o.delivered_at
    END,
    updated_at = now()
  WHERE o.id = d.order_id
    AND o.status IS DISTINCT FROM v_order_status
    AND NOT (
      v_order_status = 'en_route'::public.order_status
      AND o.status IN ('delivered'::public.order_status, 'cancelled'::public.order_status)
    )
    AND NOT (
      v_order_status = 'cancelled'::public.order_status
      AND o.status = 'delivered'::public.order_status
    );

  IF v_order_status = 'delivered'::public.order_status THEN
    IF to_regprocedure('public.record_order_delivery_stock(uuid,uuid,boolean)') IS NOT NULL THEN
      PERFORM public.record_order_delivery_stock(d.order_id, coalesce(v_actor, d.courier_id), false);
    ELSE
      RAISE WARNING 'record_order_delivery_stock missing';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_courier_pos_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_courier_actor_id(uuid) TO authenticated, service_role;
