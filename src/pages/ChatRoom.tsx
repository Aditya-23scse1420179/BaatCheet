import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Send, Image as ImageIcon, Bot, Copy, Moon, Sun, Smile, Users, LogOut } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import EmojiPicker from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { messageSchema, validateImageFile } from "@/lib/validation";

interface Message {
  id: string;
  content: string;
  user_id: string | null;
  is_ai: boolean;
  image_url: string | null;
  created_at: string;
}

interface Room {
  id: string;
  name: string;
  room_code: string;
}

interface OnlineUser {
  user_id: string;
  username: string;
}

export default function ChatRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create notification sound
    notificationSoundRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnMpBSh+zPLaizsIGGS57OihUhELTKXh8bllHAU2jtHz0n8vBSh7yfDajjwHF2K37OaiUBELSqPf8bllHAU2jtHz0oAvBSh7yfDajjwHF2K37OaiUBELSqPf8bllHAU2jtHz0oAvBSh7yfDajjwHF2K37OaiUBELSqPf8bllHAU2jtHz0oAvBSh7yfDajjwHF2K37OaiUBELSqPf8bllHAU2jtHz0oAvBSh7yfDajjwHF2K37OaiUBELSqPf8bllHAU2jtHz0oAvBQ=="
    );
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
        fetchProfile(session.user.id);
      }
    });
  }, [navigate]);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .single();
    
    if (data) {
      setUsername(data.username);
    }
  };

  useEffect(() => {
    if (!roomId || !userId || !username) return;

    fetchRoom();
    fetchMessages();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          
          // Get signed URL for new image if present
          if (newMsg.image_url) {
            const fileName = newMsg.image_url.split('/').pop();
            if (fileName) {
              const { data } = await supabase.storage
                .from('chat-images')
                .createSignedUrl(fileName, 3600);
              if (data?.signedUrl) {
                setSignedUrls(prev => ({ ...prev, [newMsg.id]: data.signedUrl }));
              }
            }
          }
          
          scrollToBottom();
          
          // Play notification sound if message is not from current user
          if (newMsg.user_id !== userId && notificationSoundRef.current) {
            notificationSoundRef.current.play().catch(console.error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          checkTypingStatus();
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const users: OnlineUser[] = [];
        
        Object.keys(presenceState).forEach((key) => {
          const presences = presenceState[key] as any[];
          presences.forEach((presence) => {
            if (!users.find(u => u.user_id === presence.user_id)) {
              users.push({
                user_id: presence.user_id,
                username: presence.username,
              });
            }
          });
        });
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            username: username,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, username]);

  const fetchRoom = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error || !data) {
      toast.error("Room not found");
      navigate("/");
      return;
    }

    setRoom(data);
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load messages");
      return;
    }

    setMessages(data || []);
    
    // Generate signed URLs for images
    const urls: Record<string, string> = {};
    for (const msg of data || []) {
      if (msg.image_url) {
        const fileName = msg.image_url.split('/').pop();
        if (fileName) {
          const { data: signedData } = await supabase.storage
            .from('chat-images')
            .createSignedUrl(fileName, 3600);
          if (signedData?.signedUrl) {
            urls[msg.id] = signedData.signedUrl;
          }
        }
      }
    }
    setSignedUrls(urls);
    
    scrollToBottom();
  };

  const checkTypingStatus = async () => {
    const { data } = await supabase
      .from("typing_indicators")
      .select("*")
      .eq("room_id", roomId)
      .neq("user_id", userId);

    setIsTyping((data && data.length > 0) || false);
  };

  const updateTypingStatus = async (typing: boolean) => {
    if (!userId || !roomId) return;

    if (typing) {
      await supabase
        .from("typing_indicators")
        .upsert({ room_id: roomId, user_id: userId, updated_at: new Date().toISOString() });
    } else {
      await supabase
        .from("typing_indicators")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", userId);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    updateTypingStatus(true);

    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 2000);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !roomId) return;

    // Validate message
    const validation = messageSchema.safeParse({ content: newMessage });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Invalid message");
      return;
    }

    const messageContent = validation.data.content;
    setNewMessage("");
    updateTypingStatus(false);

    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      user_id: userId,
      content: messageContent,
      is_ai: false,
    });

    if (error) {
      toast.error("Failed to send message");
      setNewMessage(messageContent);
      return;
    }

    // If AI is enabled, get AI response
    if (aiEnabled) {
      setTimeout(() => sendAIMessage(messageContent), 500);
    }
  };

  const sendAIMessage = async (userMessage: string) => {
    try {
      const recentMessages = messages.slice(-5).map((m) => ({
        role: m.is_ai ? "assistant" : "user",
        content: m.content,
      }));

      recentMessages.push({ role: "user", content: userMessage });

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: recentMessages, roomId },
      });

      if (error) {
        if (error.message?.includes("Rate limit")) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (error.message?.includes("credits")) {
          toast.error("AI credits depleted.");
        } else {
          throw error;
        }
        return;
      }

      await supabase.from("messages").insert({
        room_id: roomId,
        user_id: null,
        content: data.message,
        is_ai: true,
      });
    } catch (error) {
      console.error("AI error:", error);
      toast.error("Failed to get AI response");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !roomId) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-images")
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setUploading(false);
      return;
    }

    // Store the file name as the image_url (we'll use signed URLs to display)
    await supabase.from("messages").insert({
      room_id: roomId,
      user_id: userId,
      content: "📷 Shared an image",
      image_url: fileName,
      is_ai: false,
    });

    setUploading(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getImageUrl = (message: Message) => {
    if (!message.image_url) return null;
    return signedUrls[message.id] || null;
  };

  const copyRoomCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.room_code);
      toast.success("Room code copied!");
    }
  };

  const handleLeaveRoom = async () => {
    if (!userId || !roomId) return;
    
    await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    
    toast.success("Left the room");
    navigate("/");
  };

  const onEmojiClick = (emojiObject: any) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
  };

  return (
    <div className="h-screen flex flex-col bg-background">

      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">{room?.name}</h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Code: {room?.room_code}</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <Users className="h-3 w-3 mr-1" />
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {onlineUsers.length}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="text-sm font-semibold mb-2">Online Users</div>
                  {onlineUsers.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No users online</div>
                  ) : (
                    <div className="space-y-1">
                      {onlineUsers.map((user) => (
                        <div key={user.user_id} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span>{user.username}</span>
                          {user.user_id === userId && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={copyRoomCode}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant={aiEnabled ? "default" : "outline"}
            size="icon"
            onClick={() => setAiEnabled(!aiEnabled)}
          >
            <Bot className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="destructive" size="icon" onClick={handleLeaveRoom} title="Leave Room">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.user_id === userId ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`chat-bubble ${
                message.is_ai
                  ? "bg-chat-ai text-white"
                  : message.user_id === userId
                  ? "bg-chat-sent text-white"
                  : "bg-chat-received text-foreground"
              }`}
            >
              {!message.is_ai && message.user_id !== userId && (
                <p className="text-xs font-semibold mb-1 opacity-70">User</p>
              )}
              {message.is_ai && (
                <p className="text-xs font-semibold mb-1 opacity-90">🤖 Gemini Bot</p>
              )}
              {message.image_url && getImageUrl(message) && (
                <img
                  src={getImageUrl(message)!}
                  alt="Shared"
                  className="rounded-lg max-w-xs mb-2"
                />
              )}
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <p className="text-xs mt-1 opacity-60">
                {new Date(message.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="chat-bubble bg-chat-received text-foreground">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 border-0" align="start">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={theme as any} />
            </PopoverContent>
          </Popover>
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            className="flex-1"
            maxLength={2000}
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
