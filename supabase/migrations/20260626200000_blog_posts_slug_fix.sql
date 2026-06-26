UPDATE public.blog_posts
SET slug = trim(both '-' from lower(regexp_replace(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')))
WHERE slug IS NULL OR trim(slug) = '';

-- Ensure uniqueness if multiple titles normalize to the same slug
WITH ranked AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM public.blog_posts
)
UPDATE public.blog_posts p
SET slug = p.slug || '-' || left(p.id::text, 8)
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_slug_nonempty;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_slug_nonempty CHECK (length(trim(slug)) > 0);
