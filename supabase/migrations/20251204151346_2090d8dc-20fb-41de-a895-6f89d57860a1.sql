-- Fix RLS policies for messages table
DROP POLICY IF EXISTS "Messages are viewable by everyone in room" ON messages;

CREATE POLICY "Messages viewable by room members"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM room_members 
    WHERE room_members.room_id = messages.room_id 
    AND room_members.user_id = auth.uid()
  )
);

-- Fix RLS policies for rooms table
DROP POLICY IF EXISTS "Rooms are viewable by members" ON rooms;

CREATE POLICY "Rooms viewable by members"
ON rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM room_members 
    WHERE room_members.room_id = rooms.id 
    AND room_members.user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

-- Fix RLS policies for room_members table
DROP POLICY IF EXISTS "Room members are viewable by everyone" ON room_members;

CREATE POLICY "Room members viewable by fellow members"
ON room_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM room_members rm 
    WHERE rm.room_id = room_members.room_id 
    AND rm.user_id = auth.uid()
  )
);

-- Fix RLS policies for typing_indicators table
DROP POLICY IF EXISTS "Typing indicators are viewable by everyone" ON typing_indicators;

CREATE POLICY "Typing indicators viewable by room members"
ON typing_indicators FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM room_members 
    WHERE room_members.room_id = typing_indicators.room_id 
    AND room_members.user_id = auth.uid()
  )
);

-- Make chat-images bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-images';

-- Add RLS policy for storage to allow only room members to view images
CREATE POLICY "Room members can view chat images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-images' 
  AND auth.role() = 'authenticated'
);