-- Staff city/direction scoping for managers, livreurs and POS.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_scope text CHECK (
    city_scope IS NULL OR city_scope IN ('kinshasa', 'katanga', 'brazzaville', 'pointe-noire')
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS city_scope text CHECK (
    city_scope IS NULL OR city_scope IN ('kinshasa', 'katanga', 'brazzaville', 'pointe-noire')
  ),
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_time time;

UPDATE public.orders
SET city_scope = CASE
  WHEN city = 'Kinshasa' THEN 'kinshasa'
  WHEN city IN ('Lubumbashi', 'Kolwezi', 'Likasi', 'Katanga') THEN 'katanga'
  WHEN city = 'Brazzaville' THEN 'brazzaville'
  WHEN city IN ('Pointe-Noire', 'Pointe noir', 'Pointe Noire') THEN 'pointe-noire'
  WHEN country_code = 'CG' THEN 'brazzaville'
  WHEN country_code = 'CD' THEN 'kinshasa'
  ELSE city_scope
END
WHERE city_scope IS NULL;

CREATE INDEX IF NOT EXISTS profiles_city_scope_idx ON public.profiles(city_scope);
CREATE INDEX IF NOT EXISTS orders_city_scope_idx ON public.orders(city_scope);
CREATE INDEX IF NOT EXISTS profiles_badge_id_lower_idx ON public.profiles(lower(badge_id)) WHERE badge_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.staff_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_scope text NOT NULL CHECK (city_scope IN ('kinshasa', 'katanga', 'brazzaville', 'pointe-noire')),
  amount_usd numeric(10,2) NOT NULL DEFAULT 0,
  amount_fcfa integer NOT NULL DEFAULT 0,
  note text NOT NULL,
  spent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.staff_expenses TO authenticated;
GRANT ALL ON public.staff_expenses TO service_role;
ALTER TABLE public.staff_expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS staff_expenses_city_spent_idx ON public.staff_expenses(city_scope, spent_at DESC);
CREATE INDEX IF NOT EXISTS staff_expenses_reported_by_idx ON public.staff_expenses(reported_by);

CREATE POLICY "Admins read all staff expenses"
ON public.staff_expenses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers read city expenses"
ON public.staff_expenses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Managers create city expenses"
ON public.staff_expenses FOR INSERT TO authenticated
WITH CHECK (
  reported_by = auth.uid()
  AND public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Admins create staff expenses"
ON public.staff_expenses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Replace broad manager order policies with city-scoped ones for direct DB access too.
DROP POLICY IF EXISTS "Managers read all orders" ON public.orders;
DROP POLICY IF EXISTS "Managers update orders" ON public.orders;

CREATE POLICY "Managers read city orders"
ON public.orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Managers update city orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
);
