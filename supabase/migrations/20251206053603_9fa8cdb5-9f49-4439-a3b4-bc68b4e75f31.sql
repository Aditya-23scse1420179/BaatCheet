-- Create a security definer function to get user's room IDs without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_room_ids_safe(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room_id FROM public.room_members WHERE user_id = _user_id
$$;

-- Create a security definer function to check room membership
CREATE OR REPLACE FUNCTION public.is_room_member_safe(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE user_id = _user_id AND room_id = _room_id
  )
$$;

-- Fix room_members SELECT policy to avoid self-reference
DROP POLICY IF EXISTS "Users can view room members" ON public.room_members;
CREATE POLICY "Users can view room members"
ON public.room_members FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_room_member_safe(auth.uid(), room_id)
);

-- Fix rooms SELECT policy to use the safe function
DROP POLICY IF EXISTS "Users can view rooms they created or are members of" ON public.rooms;
CREATE POLICY "Users can view rooms they created or are members of"
ON public.rooms FOR SELECT
USING (
  created_by = auth.uid() 
  OR id IN (SELECT public.get_user_room_ids_safe(auth.uid()))
);

-- Restrict profiles to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);