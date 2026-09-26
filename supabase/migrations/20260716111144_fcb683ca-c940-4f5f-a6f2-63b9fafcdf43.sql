
CREATE POLICY "assets read all" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "assets insert auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assets');
CREATE POLICY "assets update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'assets');
CREATE POLICY "assets delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'assets');
