INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos', 'logos', true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'logos_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT USING (bucket_id = ''logos'')';
  END IF;
END $$;
