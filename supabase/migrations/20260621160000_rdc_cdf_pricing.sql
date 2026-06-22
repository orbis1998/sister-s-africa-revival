-- RDC pricing: USD or CDF per product (option B), not both displayed

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_cdf integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rdc_price_currency text NOT NULL DEFAULT 'usd'
    CHECK (rdc_price_currency IN ('usd', 'cdf'));

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS price_cdf integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rdc_price_currency text NOT NULL DEFAULT 'usd'
    CHECK (rdc_price_currency IN ('usd', 'cdf'));

UPDATE public.product_variants v
SET rdc_price_currency = COALESCE(p.rdc_price_currency, 'usd'),
    price_cdf = COALESCE(NULLIF(v.price_cdf, 0), p.price_cdf, 0)
FROM public.products p
WHERE p.id = v.product_id;
