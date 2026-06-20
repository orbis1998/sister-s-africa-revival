-- Wholesale sales recorded by managers and visible to admins.
CREATE TABLE IF NOT EXISTS public.wholesale_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_scope text NOT NULL CHECK (city_scope IN ('kinshasa', 'katanga', 'brazzaville', 'pointe-noire')),
  customer_name text NOT NULL,
  customer_phone text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_usd numeric(10,2) NOT NULL DEFAULT 0,
  unit_price_fcfa integer NOT NULL DEFAULT 0,
  total_usd numeric(10,2) NOT NULL DEFAULT 0,
  total_fcfa integer NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
  notes text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.wholesale_sales TO authenticated;
GRANT ALL ON public.wholesale_sales TO service_role;
ALTER TABLE public.wholesale_sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS wholesale_sales_city_sold_idx
ON public.wholesale_sales(city_scope, sold_at DESC);

CREATE INDEX IF NOT EXISTS wholesale_sales_created_by_idx
ON public.wholesale_sales(created_by);

CREATE POLICY "Admins read all wholesale sales"
ON public.wholesale_sales FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers read city wholesale sales"
ON public.wholesale_sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Managers create city wholesale sales"
ON public.wholesale_sales FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.has_role(auth.uid(), 'manager')
  AND city_scope = (
    SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Admins create wholesale sales"
ON public.wholesale_sales FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update wholesale sales"
ON public.wholesale_sales FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
