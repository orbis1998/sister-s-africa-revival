-- Repair: staff_expenses table + manager permission columns (idempotent)

ALTER TABLE public.manager_permissions
  ADD COLUMN IF NOT EXISTS can_record_expenses boolean NOT NULL DEFAULT false;

ALTER TABLE public.manager_permissions
  ADD COLUMN IF NOT EXISTS can_record_wholesale boolean NOT NULL DEFAULT false;

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

DROP POLICY IF EXISTS "Admins read all staff expenses" ON public.staff_expenses;
CREATE POLICY "Admins read all staff expenses"
ON public.staff_expenses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers read city expenses" ON public.staff_expenses;
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

DROP POLICY IF EXISTS "Managers create city expenses" ON public.staff_expenses;
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

DROP POLICY IF EXISTS "Admins create staff expenses" ON public.staff_expenses;
CREATE POLICY "Admins create staff expenses"
ON public.staff_expenses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
