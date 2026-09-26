
DROP POLICY IF EXISTS "assets read all" ON storage.objects;
CREATE POLICY "assets read all" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'assets');
