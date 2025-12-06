import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { roomNameSchema, roomCodeSchema } from "@/lib/validation";

export default function Home() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    const validation = roomNameSchema.safeParse({ name: roomName });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid room name");
      return;
    }

    setCreatingRoom(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        room_code: code,
        name: validation.data.name,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create room");
      setCreatingRoom(false);
      return;
    }

    await supabase.from("room_members").insert({
      room_id: data.id,
      user_id: userId,
    });

    setCreatingRoom(false);
    toast.success(`Room created! Code: ${code}`);
    navigate(`/room/${data.id}`);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    const validation = roomCodeSchema.safeParse({ code: roomCode });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid room code");
      return;
    }

    setJoiningRoom(true);
    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", validation.data.code.toUpperCase())
      .maybeSingle();

    if (error || !room) {
      toast.error("Room not found");
      setJoiningRoom(false);
      return;
    }

    const { data: existingMember } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingMember) {
      await supabase.from("room_members").insert({
        room_id: room.id,
        user_id: userId,
      });
    }

    setJoiningRoom(false);
    navigate(`/room/${room.id}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen p-4 bg-background">
      
      <div className="container max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Baatcheet</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="glass-card">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleSignOut} className="glass-card">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="glass-card border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Create New Room</CardTitle>
              <CardDescription>Start a new chat room and invite others</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name">Room Name</Label>
                  <Input
                    id="room-name"
                    placeholder="My Awesome Room"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creatingRoom || joiningRoom}>
                  {creatingRoom ? <><Spinner size="sm" className="mr-2" /> Creating...</> : "Create Room"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="glass-card border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Join Room</CardTitle>
              <CardDescription>Enter a room code to join an existing chat</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-code">Room Code</Label>
                  <Input
                    id="room-code"
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    maxLength={20}
                    required
                    className="uppercase"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creatingRoom || joiningRoom}>
                  {joiningRoom ? <><Spinner size="sm" className="mr-2" /> Joining...</> : "Join Room"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
