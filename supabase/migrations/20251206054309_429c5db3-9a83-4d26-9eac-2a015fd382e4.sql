-- Create function to cleanup room when last member leaves
CREATE OR REPLACE FUNCTION public.cleanup_empty_room()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the room has no more members
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = OLD.room_id) THEN
    -- Delete all messages in the room first
    DELETE FROM public.messages WHERE room_id = OLD.room_id;
    -- Delete all typing indicators
    DELETE FROM public.typing_indicators WHERE room_id = OLD.room_id;
    -- Delete the room
    DELETE FROM public.rooms WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger that fires after a member leaves
DROP TRIGGER IF EXISTS on_member_leave_cleanup ON public.room_members;
CREATE TRIGGER on_member_leave_cleanup
  AFTER DELETE ON public.room_members
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_empty_room();