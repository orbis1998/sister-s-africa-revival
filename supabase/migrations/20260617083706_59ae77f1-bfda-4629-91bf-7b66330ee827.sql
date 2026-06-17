
CREATE POLICY "Public can view review photos" ON storage.objects FOR SELECT USING (bucket_id = 'review-photos');
CREATE POLICY "Anyone can upload review photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'review-photos');
