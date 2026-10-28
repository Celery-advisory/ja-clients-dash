-- Cover image library for generated wealth reports.
-- Built-in images ship in /public (builtin_file); uploads live in the report-images bucket (storage_path).

CREATE TABLE IF NOT EXISTS wealth.report_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  builtin_file text,
  storage_path text,
  content_type text NOT NULL DEFAULT 'image/jpeg',
  width integer,
  height integer,
  is_default boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_images_source_check CHECK (
    (builtin_file IS NOT NULL) <> (storage_path IS NOT NULL)
  ),
  CONSTRAINT report_images_content_type_check CHECK (
    content_type IN ('image/jpeg', 'image/png')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS report_images_one_default
  ON wealth.report_images ((true)) WHERE is_default;

CREATE UNIQUE INDEX IF NOT EXISTS report_images_builtin_file_key
  ON wealth.report_images (builtin_file) WHERE builtin_file IS NOT NULL;

ALTER TABLE wealth.report_images ENABLE ROW LEVEL SECURITY;

ALTER TABLE wealth.reports
  ADD COLUMN IF NOT EXISTS cover_image_id uuid REFERENCES wealth.report_images(id) ON DELETE SET NULL;

INSERT INTO wealth.report_images (label, builtin_file, content_type, width, height, is_default)
VALUES
  ('City skyline', 'report-assets/cover-skyline.jpg', 'image/jpeg', 1104, 1242, true),
  ('Desk with charts', 'report-assets/allocation-desk.jpg', 'image/jpeg', 1104, 1242, false)
ON CONFLICT DO NOTHING;

-- Public read so the picker can show thumbnails; writes go through the server with the service role.
-- The PDF renderer only embeds JPEG and PNG.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-images',
  'report-images',
  true,
  8388608,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS report_images_public_read ON storage.objects;
CREATE POLICY report_images_public_read ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'report-images');
