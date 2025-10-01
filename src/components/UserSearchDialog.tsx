import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, UserPlus } from "lucide-react";

interface UserProfile {
  id: string;
  display_name: string | null;
  age: number | null;
  gender: string | null;
  avatar_url: string | null;
}

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

export function UserSearchDialog({ open, onOpenChange, currentUserId }: UserSearchDialogProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadUsers();
      setSearchQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter((user) =>
          user.display_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get all existing friendships for current user
      const { data: friendships } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

      const friendIds = new Set(
        friendships?.map((f) =>
          f.requester_id === currentUserId ? f.addressee_id : f.requester_id
        ) || []
      );

      // Get all profiles except current user and existing friends using security definer function
      const { data, error } = await supabase
        .rpc("get_public_profiles_for_search", { current_user_id: currentUserId });

      if (error) throw error;

      // Filter out existing friends
      const availableUsers = (data || []).filter((user) => !friendIds.has(user.id));
      setUsers(availableUsers);
      setFilteredUsers(availableUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const sendFriendRequest = async (userId: string) => {
    setSendingRequests((prev) => new Set(prev).add(userId));
    try {
      const { error } = await supabase.from("friendships").insert({
        requester_id: currentUserId,
        addressee_id: userId,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Friend request sent!",
      });

      // Remove user from list
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setFilteredUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({
        title: "Failed to send friend request",
        variant: "destructive",
      });
    } finally {
      setSendingRequests((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Users</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No users found" : "No users available"}
            </div>
          ) : (
            filteredUsers.map((user) => {
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {user.display_name || "Anonymous"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.age ? `${user.age} years old` : "Age unknown"}
                      {user.gender && ` • ${user.gender}`}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => sendFriendRequest(user.id)}
                    disabled={sendingRequests.has(user.id)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add Friend
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
