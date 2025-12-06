-- Drop existing problematic policies
DROP POLICY IF EXISTS "Rooms viewable by members" ON public.rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room members viewable by fellow members" ON public.room_members;
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_members;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_members;

-- Simplified rooms policies (no circular reference)
CREATE POLICY "Users can view rooms they created or are members of"
ON public.rooms FOR SELECT
USING (
  created_by = auth.uid() OR
  id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create rooms"
ON public.rooms FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Simplified room_members policies (no circular reference)
CREATE POLICY "Users can view room members"
ON public.room_members FOR SELECT
USING (
  user_id = auth.uid() OR
  room_id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can join rooms"
ON public.room_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
ON public.room_members FOR DELETE
USING (auth.uid() = user_id);