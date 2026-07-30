INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'product_images_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY "product_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = ''product-images'')';
  END IF;
END $$;
