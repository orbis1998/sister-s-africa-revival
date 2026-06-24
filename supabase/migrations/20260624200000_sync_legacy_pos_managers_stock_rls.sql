-- Legacy POS managers: sync manager_user_id → pos_ids + allow POS managers to read stock

-- 1. Backfill: each POS manager_user_id gets the POS in pos_ids + can_manage_pos
DO $$
DECLARE
  r RECORD;
  current_ids uuid[];
BEGIN
  FOR r IN
    SELECT pos.id AS pos_id, pos.manager_user_id
    FROM public.points_of_sale pos
    WHERE pos.manager_user_id IS NOT NULL
  LOOP
    SELECT mp.pos_ids INTO current_ids
    FROM public.manager_permissions mp
    WHERE mp.user_id = r.manager_user_id;

    IF current_ids IS NULL THEN
      INSERT INTO public.manager_permissions (user_id, can_manage_pos, pos_ids)
      VALUES (r.manager_user_id, true, ARRAY[r.pos_id])
      ON CONFLICT (user_id) DO UPDATE SET
        can_manage_pos = true,
        pos_ids = (
          SELECT ARRAY(
            SELECT DISTINCT unnest(
              COALESCE(public.manager_permissions.pos_ids, '{}') || ARRAY[r.pos_id]::uuid[]
            )
          )
        );
    ELSIF NOT (r.pos_id = ANY(current_ids)) THEN
      UPDATE public.manager_permissions
      SET pos_ids = array_append(pos_ids, r.pos_id),
          can_manage_pos = true
      WHERE user_id = r.manager_user_id;
    ELSE
      UPDATE public.manager_permissions
      SET can_manage_pos = true
      WHERE user_id = r.manager_user_id
        AND can_manage_pos = false;
    END IF;
  END LOOP;
END $$;

-- 2. Managers with POS assigned but can_manage_pos still off
UPDATE public.manager_permissions
SET can_manage_pos = true
WHERE cardinality(pos_ids) > 0
  AND can_manage_pos = false
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = manager_permissions.user_id AND ur.role = 'manager'
  );

-- 3. RLS stock: can_manage_pos OR can_manage_stock for assigned POS
DROP POLICY IF EXISTS "Managers read assigned POS stock" ON public.stock;
CREATE POLICY "Managers read assigned POS stock"
ON public.stock FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND pos_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND (mp.can_manage_stock = true OR mp.can_manage_pos = true)
      AND pos_id = ANY(mp.pos_ids)
  )
);
