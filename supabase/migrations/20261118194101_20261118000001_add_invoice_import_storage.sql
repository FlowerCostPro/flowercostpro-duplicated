/*
# Add private storage bucket for invoice imports

1. Purpose
- Creates a private Supabase Storage bucket named `invoice-imports` for storing
  PDF and image files uploaded by shop owners during the invoice import flow.
- Files are scoped to each owner's own folder (path = `<owner_id>/<filename>`)
  and only the owner can read, write, or delete their own files.

2. Storage bucket
- `invoice-imports`: private bucket (not public). Files are served via
  signed URLs only, never permanent public URLs.

3. Security (storage.objects RLS policies)
- INSERT: owner can upload only into their own folder (storage.foldername(name)[1] = auth.uid()::text)
- SELECT: owner can read only their own files
- DELETE: owner can delete only their own files
- No UPDATE needed (files are immutable)
- No anon access — authenticated owners only

4. Notes
- The bucket is created via the storage schema insert, which is the standard
  Supabase pattern for creating buckets via migration.
- The edge function (import-invoice) will upload files here using the service
  role key, which bypasses RLS — but the function first verifies the caller
  is an owner, so only verified owners' files are written.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-imports', 'invoice-imports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoice-imports bucket
DROP POLICY IF EXISTS "invoice_imports_insert_own_folder" ON storage.objects;
CREATE POLICY "invoice_imports_insert_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "invoice_imports_select_own_folder" ON storage.objects;
CREATE POLICY "invoice_imports_select_own_folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "invoice_imports_delete_own_folder" ON storage.objects;
CREATE POLICY "invoice_imports_delete_own_folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
