
CREATE TYPE public.order_status AS ENUM ('received','preparing','ready','en_route','delivered','cancelled');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('TS-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*100000))::text, 5, '0')),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  country_code text NOT NULL,
  country_name text NOT NULL,
  city text NOT NULL,
  commune text NOT NULL,
  address text NOT NULL,
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_fcfa integer NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'received',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon checkout) can create an order
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Admin: full read/write
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Manager: read/update all (permissions filtered in app)
CREATE POLICY "Managers read all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'manager'));
CREATE POLICY "Managers update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'manager'));

-- Livreur: only their assigned orders
CREATE POLICY "Livreurs read own assigned" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'livreur') AND assigned_to = auth.uid());
CREATE POLICY "Livreurs update own assigned" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'livreur') AND assigned_to = auth.uid());

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_assigned ON public.orders(assigned_to);
