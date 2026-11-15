-- Create a PRIVATE storage bucket; content is never exposed on GitHub Pages.
-- Apply only after reviewing existing Storage policies for this bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('premium-content', 'premium-content', false, 1048576, ARRAY['text/html'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1048576,
  allowed_mime_types = ARRAY['text/html'];
-- No SELECT/INSERT/UPDATE/DELETE policy for anon/authenticated is installed.
-- The service_role key in the Edge Function is the only reader.
-- Verify there is NO pre-existing broad storage.objects policy giving clients
-- access to objects with bucket_id = 'premium-content'.
