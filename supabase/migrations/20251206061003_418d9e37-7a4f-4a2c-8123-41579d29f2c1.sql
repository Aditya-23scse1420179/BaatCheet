-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON profiles;

-- Create a more restrictive policy that only allows users to see:
-- 1. Their own profile
-- 2. Profiles of users they share a room with
CREATE POLICY "Users can view own and co-member profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR
  id IN (
    SELECT DISTINCT rm2.user_id 
    FROM room_members rm1
    JOIN room_members rm2 ON rm1.room_id = rm2.room_id
    WHERE rm1.user_id = auth.uid()
  )
);