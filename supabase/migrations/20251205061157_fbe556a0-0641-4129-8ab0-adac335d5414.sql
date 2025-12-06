-- Add DELETE policy on rooms so cleanup trigger can work
CREATE POLICY "System can delete empty rooms"
ON public.rooms FOR DELETE
USING (NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = rooms.id));