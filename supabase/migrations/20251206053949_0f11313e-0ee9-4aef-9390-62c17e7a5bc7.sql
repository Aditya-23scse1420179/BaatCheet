-- Drop the overly permissive storage policies
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Room members can view chat images" ON storage.objects;

-- Create a proper policy that validates room membership through messages table
CREATE POLICY "Room members can view chat images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-images' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.room_members rm ON rm.room_id = m.room_id
    WHERE m.image_url LIKE '%' || storage.objects.name
    AND rm.user_id = auth.uid()
  )
);

-- Keep the upload policy for authenticated users who are room members
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');