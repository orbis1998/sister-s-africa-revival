-- Allow managers with can_manage_products to upload product images
DROP POLICY IF EXISTS "Managers upload product images" ON storage.objects;
CREATE POLICY "Managers upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid() AND mp.can_manage_products = true
  )
);

DROP POLICY IF EXISTS "Managers update product images" ON storage.objects;
CREATE POLICY "Managers update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid() AND mp.can_manage_products = true
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.manager_permissions mp
    WHERE mp.user_id = auth.uid() AND mp.can_manage_products = true
  )
);
