-- Fix PostgREST relationships for finance list queries (profiles embed)
-- reported_by / created_by must reference public.profiles for API joins

ALTER TABLE public.staff_expenses
  DROP CONSTRAINT IF EXISTS staff_expenses_reported_by_fkey;

ALTER TABLE public.staff_expenses
  ADD CONSTRAINT staff_expenses_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.wholesale_sales
  DROP CONSTRAINT IF EXISTS wholesale_sales_created_by_fkey;

ALTER TABLE public.wholesale_sales
  ADD CONSTRAINT wholesale_sales_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure admin can always read all rows (authenticated client fallback)
DROP POLICY IF EXISTS "Admins read all staff expenses" ON public.staff_expenses;
CREATE POLICY "Admins read all staff expenses"
ON public.staff_expenses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all wholesale sales" ON public.wholesale_sales;
CREATE POLICY "Admins read all wholesale sales"
ON public.wholesale_sales FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
