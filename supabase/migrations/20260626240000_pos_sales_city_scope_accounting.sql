-- POS accounting: align city_scope on points_of_sale, manager profiles, and pos_sales read access

-- 1. Display city labels where only city_scope was set
UPDATE public.points_of_sale
SET city = CASE city_scope
  WHEN 'kinshasa' THEN 'Kinshasa'
  WHEN 'katanga' THEN 'Lubumbashi'
  WHEN 'brazzaville' THEN 'Brazzaville'
  WHEN 'pointe-noire' THEN 'Pointe-Noire'
  ELSE city
END
WHERE city_scope IS NOT NULL
  AND (city IS NULL OR btrim(city) = '');

-- 2. Re-sync manager pos_ids from legacy manager_user_id links
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
    END IF;
  END LOOP;
END $$;

-- 3. Backfill manager profiles.city_scope from assigned POS
UPDATE public.profiles p
SET city_scope = pos.city_scope
FROM public.manager_permissions mp
JOIN public.points_of_sale pos ON pos.id = ANY(mp.pos_ids)
WHERE mp.user_id = p.id
  AND p.city_scope IS NULL
  AND pos.city_scope IS NOT NULL;

-- 4. Managers with accounting access can read POS sales for their direction (city_scope)
DROP POLICY IF EXISTS "Managers read assigned POS sales" ON public.pos_sales;
CREATE POLICY "Managers read assigned POS sales"
ON public.pos_sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid()
      AND (mp.can_manage_pos = true OR mp.can_view_accounting = true)
      AND (
        pos_id = ANY(mp.pos_ids)
        OR EXISTS (
          SELECT 1
          FROM public.points_of_sale pos
          WHERE pos.id = pos_sales.pos_id
            AND pos.city_scope IS NOT NULL
            AND pos.city_scope = (
              SELECT pr.city_scope FROM public.profiles pr WHERE pr.id = auth.uid()
            )
        )
      )
  )
);
