-- Delivery fees per commune, rich content, blog posts, SEO fields

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee_fcfa integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_usd numeric NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS seo_title text DEFAULT 'The Sisters Africa — Bouillies bio pour une prise de poids saine',
  ADD COLUMN IF NOT EXISTS seo_description text DEFAULT 'Mass Gainer, Super Grow et Peanut Butter : bouillies bio d''origine végétale. Livraison à Kinshasa, Lubumbashi, Brazzaville et Pointe-Noire.',
  ADD COLUMN IF NOT EXISTS seo_keywords text DEFAULT 'The Sisters Africa, bouillie bio, prise de poids, Mass Gainer, Super Grow, Kinshasa, Brazzaville',
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS site_url text DEFAULT 'https://thesistersafrica.com',
  ADD COLUMN IF NOT EXISTS twitter_handle text DEFAULT '@thesistersafrica';

CREATE TABLE IF NOT EXISTS public.commune_delivery_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  city text NOT NULL,
  commune text NOT NULL,
  city_scope text,
  fee_fcfa integer NOT NULL DEFAULT 0,
  fee_usd numeric NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, city, commune)
);

CREATE INDEX IF NOT EXISTS commune_delivery_fees_scope_idx ON public.commune_delivery_fees(city_scope);
CREATE INDEX IF NOT EXISTS commune_delivery_fees_city_idx ON public.commune_delivery_fees(country_code, city);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content_html text,
  cover_image_url text,
  category text,
  read_time text DEFAULT '4 min',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON public.blog_posts(is_published, sort_order);

GRANT SELECT ON public.commune_delivery_fees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commune_delivery_fees TO service_role;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO service_role;

ALTER TABLE public.commune_delivery_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read commune delivery fees" ON public.commune_delivery_fees;
CREATE POLICY "Public read commune delivery fees"
ON public.commune_delivery_fees FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage commune delivery fees" ON public.commune_delivery_fees;
CREATE POLICY "Admins manage commune delivery fees"
ON public.commune_delivery_fees FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers manage scoped commune delivery fees" ON public.commune_delivery_fees;
CREATE POLICY "Managers manage scoped commune delivery fees"
ON public.commune_delivery_fees FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND city_scope IS NOT NULL
  AND city_scope = (SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager')
  AND city_scope IS NOT NULL
  AND city_scope = (SELECT p.city_scope FROM public.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Public read published blog posts" ON public.blog_posts;
CREATE POLICY "Public read published blog posts"
ON public.blog_posts FOR SELECT TO anon, authenticated USING (is_published = true);

DROP POLICY IF EXISTS "Admins manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins manage blog posts"
ON public.blog_posts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS commune_delivery_fees_updated_at ON public.commune_delivery_fees;
CREATE TRIGGER commune_delivery_fees_updated_at
BEFORE UPDATE ON public.commune_delivery_fees
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed communes with zero fees (managers set prices from dashboard)
INSERT INTO public.commune_delivery_fees (country_code, city, commune, city_scope, fee_fcfa, fee_usd)
SELECT v.country_code, v.city, v.commune, v.city_scope, 0, 0
FROM (VALUES
  ('CD','Kinshasa','Gombe','kinshasa'),('CD','Kinshasa','Kintambo','kinshasa'),('CD','Kinshasa','Lingwala','kinshasa'),
  ('CD','Kinshasa','Bandalungwa','kinshasa'),('CD','Kinshasa','Kasavubu','kinshasa'),('CD','Kinshasa','Kalamu','kinshasa'),
  ('CD','Kinshasa','Ngiri-Ngiri','kinshasa'),('CD','Kinshasa','Selembao','kinshasa'),('CD','Kinshasa','Bumbu','kinshasa'),
  ('CD','Kinshasa','Makala','kinshasa'),('CD','Kinshasa','Ngaba','kinshasa'),('CD','Kinshasa','Limete','kinshasa'),
  ('CD','Kinshasa','Matete','kinshasa'),('CD','Kinshasa','Lemba','kinshasa'),('CD','Kinshasa','Mont-Ngafula','kinshasa'),
  ('CD','Kinshasa','Ngaliema','kinshasa'),('CD','Kinshasa','Masina','kinshasa'),('CD','Kinshasa','Kimbanseke','kinshasa'),
  ('CD','Kinshasa','N''djili','kinshasa'),('CD','Kinshasa','N''sele','kinshasa'),('CD','Kinshasa','Maluku','kinshasa'),
  ('CD','Kinshasa','Barumbu','kinshasa'),('CD','Kinshasa','Kinshasa','kinshasa'),
  ('CD','Lubumbashi','Lubumbashi','katanga'),('CD','Lubumbashi','Kampemba','katanga'),('CD','Lubumbashi','Kenya','katanga'),
  ('CD','Lubumbashi','Katuba','katanga'),('CD','Lubumbashi','Rwashi','katanga'),('CD','Lubumbashi','Annexe','katanga'),
  ('CD','Kolwezi','Manika','katanga'),('CD','Kolwezi','Dilala','katanga'),
  ('CD','Likasi','Likasi','katanga'),('CD','Likasi','Panda','katanga'),('CD','Likasi','Shituru','katanga'),
  ('CG','Brazzaville','Bacongo','brazzaville'),('CG','Brazzaville','Makélékélé','brazzaville'),('CG','Brazzaville','Poto-Poto','brazzaville'),
  ('CG','Brazzaville','Moungali','brazzaville'),('CG','Brazzaville','Ouenzé','brazzaville'),('CG','Brazzaville','Talangaï','brazzaville'),
  ('CG','Brazzaville','Mfilou','brazzaville'),('CG','Brazzaville','Madibou','brazzaville'),('CG','Brazzaville','Djiri','brazzaville'),
  ('CG','Pointe-Noire','Lumumba','pointe-noire'),('CG','Pointe-Noire','Mvou-Mvou','pointe-noire'),('CG','Pointe-Noire','Tié-Tié','pointe-noire'),
  ('CG','Pointe-Noire','Loandjili','pointe-noire'),('CG','Pointe-Noire','Mongo-Mpoukou','pointe-noire'),('CG','Pointe-Noire','Ngoyo','pointe-noire')
) AS v(country_code, city, commune, city_scope)
ON CONFLICT (country_code, city, commune) DO NOTHING;

-- Seed 10 blog articles from existing static content
INSERT INTO public.blog_posts (slug, title, excerpt, content_html, category, read_time, sort_order, seo_title, seo_description)
VALUES
  ('mass-gainer-pour-adultes', 'Mass Gainer pour adultes', 'Mass Gainer est une bouillie de protéines bio d''origine végétale destinée aux hommes et femmes à partir de 14 ans.',
   '<p>Elle est spécialement conçue pour favoriser une <strong>prise de poids saine</strong> avec une consommation régulière. La marque met en avant des résultats visibles en deux semaines selon la régularité, l''alimentation et le métabolisme de chaque personne.</p>',
   'Produit adulte', '4 min', 1, 'Mass Gainer pour adultes — The Sisters Africa', 'Découvrez Mass Gainer, bouillie bio pour adultes dès 14 ans.'),
  ('benefices-du-mass-gainer', 'Bénéfices du Mass Gainer', 'La formule vise une prise de poids générale et peut aussi accompagner le développement des formes selon la génétique.',
   '<p>D''après les informations de la marque, de nombreuses femmes observent un développement au niveau des hanches, des joues ou de la poitrine. Ces effets ne sont pas identiques pour toutes : ils dépendent du corps, de la génétique et de la constance.</p>',
   'Bénéfices', '3 min', 2, 'Bénéfices du Mass Gainer — The Sisters Africa', 'Les bénéfices de Mass Gainer pour une prise de poids saine.'),
  ('sport-ou-sans-sport', 'Sport ou sans sport ?', 'La bouillie peut s''intégrer avec ou sans activité sportive, mais le sport aide à obtenir un résultat plus défini.',
   '<p>La marque indique que les résultats sont possibles <strong>avec ou sans sport</strong>. Cependant, une routine sportive permet de mieux structurer la prise de poids et d''obtenir une silhouette plus tonique.</p>',
   'Routine', '4 min', 3, 'Sport ou sans sport ? — The Sisters Africa', 'Mass Gainer avec ou sans sport : ce qu''il faut savoir.'),
  ('comment-la-formule-agit', 'Comment la formule agit', 'La bouillie est présentée comme un soutien pour stimuler l''appétit, renforcer les os et ralentir le métabolisme.',
   '<p>L''objectif est d''aider le corps à mieux transformer ce qui est consommé en masse corporelle et musculaire. Elle doit rester accompagnée d''une alimentation équilibrée et d''une bonne hydratation.</p>',
   'Nutrition', '4 min', 4, 'Comment agit Mass Gainer — The Sisters Africa', 'Comprendre le mode d''action de la bouillie bio The Sisters.'),
  ('precautions-importantes', 'Précautions importantes', 'Mass Gainer n''est pas recommandé aux femmes enceintes, aux enfants de moins de 14 ans, ni aux personnes diabétiques ou hypertendues.',
   '<p>Cette information doit être visible avant l''achat. Pour toute situation médicale particulière, le client doit demander l''avis d''un <strong>professionnel de santé</strong> avant consommation.</p>',
   'Sécurité', '3 min', 5, 'Précautions Mass Gainer — The Sisters Africa', 'Précautions et contre-indications avant consommation.'),
  ('super-grow-pour-enfants', 'Super Grow pour enfants', 'Super Grow est une bouillie nutritionnelle bio d''origine végétale pour les enfants de 1 à 13 ans.',
   '<p>Le paquet de 800 g correspond à environ <strong>20 jours</strong> de consommation par enfant. La formule est pensée pour les enfants qui ont du mal à manger, manquent d''appétit ou ont besoin d''un soutien nutritionnel.</p>',
   'Produit enfant', '5 min', 6, 'Super Grow pour enfants — The Sisters Africa', 'Super Grow, bouillie nutritionnelle bio pour enfants 1-13 ans.'),
  ('objectif-de-super-grow', 'Objectif de Super Grow', 'La formule enfant est présentée comme une aide pour favoriser une prise de poids saine et progressive.',
   '<p>Elle doit accompagner les repas, pas les remplacer. Les parents doivent suivre l''appétit, l''énergie, la tolérance et l''évolution de l''enfant au fil des jours.</p>',
   'Famille', '3 min', 7, 'Objectif Super Grow — The Sisters Africa', 'Objectifs et suivi de Super Grow pour enfants.'),
  ('peanut-butter-bio', 'Peanut Butter bio', 'Le Peanut Butter est un beurre de cacahuète sans sucre, sans sel et sans huile ajoutée.',
   '<p>La marque recommande de le mélanger avec la bouillie de protéines adulte ou la bouillie nutritionnelle enfant pour enrichir la routine et rendre la consommation plus gourmande.</p>',
   'Complément', '3 min', 8, 'Peanut Butter bio — The Sisters Africa', 'Beurre de cacahuète bio sans sucre ni sel ajouté.'),
  ('resultats-et-regularite', 'Résultats et régularité', 'La marque parle de résultats visibles en deux semaines, mais la régularité reste la clé.',
   '<p>Pour mieux suivre l''évolution, il est conseillé de noter le poids, l''appétit, l''énergie et les changements physiques. Les résultats peuvent varier d''une personne à l''autre.</p>',
   'Résultats', '4 min', 9, 'Résultats et régularité — The Sisters Africa', 'Régularité et suivi des résultats avec The Sisters Africa.'),
  ('ou-commander-et-se-renseigner', 'Où commander et se renseigner', 'Le service client accompagne les clientes selon leur ville : Kinshasa, Katanga, Pointe-Noire ou Brazzaville.',
   '<p>Pour Katanga : <strong>+243 810 113 198</strong>. Pour Pointe-Noire : <strong>+242 06 531 3192</strong>. Pour Brazzaville : <strong>+242 05 671 9462</strong>. La commande du site redirige vers le bon WhatsApp selon la ville choisie.</p>',
   'Service client', '5 min', 10, 'Commander The Sisters Africa — Service client', 'Contacts WhatsApp par ville pour commander The Sisters Africa.')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.site_settings SET
  seo_title = COALESCE(seo_title, 'The Sisters Africa — Bouillies bio pour une prise de poids saine'),
  seo_description = COALESCE(seo_description, 'Mass Gainer, Super Grow et Peanut Butter : bouillies bio d''origine végétale. Livraison à Kinshasa, Lubumbashi, Brazzaville et Pointe-Noire.'),
  seo_keywords = COALESCE(seo_keywords, 'The Sisters Africa, bouillie bio, prise de poids, Mass Gainer, Super Grow, Kinshasa, Brazzaville'),
  site_url = COALESCE(site_url, 'https://thesistersafrica.com')
WHERE id = true;
