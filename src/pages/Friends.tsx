import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
}

interface FriendProfile {
  id: string;
  display_name: string | null;
  dupr_rating: number | null;
  avatar_url: string | null;
}

interface FriendWithPresence {
  friendId: string;
  profile: FriendProfile;
  presence?: {
    park_id: string;
    arrived_at: string;
    parks: { name: string };
  } | null;
}

const Friends = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkIndex, setSelectedParkIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      loadData(session.user.id);
    });
  }, [navigate]);

  const loadData = async (uid: string) => {
    await Promise.all([loadParks(), loadFriends(uid)]);
  };

  const loadParks = async () => {
    try {
      const { data, error } = await supabase
        .from("parks")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setParks(data || []);
    } catch (error) {
      console.error("Error loading parks:", error);
    }
  };

  const loadFriends = async (uid: string) => {
    try {
      const { data: acceptedData, error: acceptedError } = await supabase
        .from("friendships")
        .select(`
          id,
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(id, display_name, dupr_rating, avatar_url),
          addressee:profiles!friendships_addressee_id_fkey(id, display_name, dupr_rating, avatar_url)
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

      if (acceptedError) throw acceptedError;

      const friendsWithPresence = await Promise.all(
        (acceptedData || []).map(async (friendship) => {
          const friendId =
            friendship.requester_id === uid
              ? friendship.addressee_id
              : friendship.requester_id;
          
          const profile = friendship.requester_id === uid
            ? friendship.addressee
            : friendship.requester;

          const { data: presenceData } = await supabase
            .from("presence")
            .select(`
              park_id,
              arrived_at,
              parks(name)
            `)
            .eq("user_id", friendId)
            .is("checked_out_at", null)
            .single();

          return {
            friendId,
            profile,
            presence: presenceData,
          } as FriendWithPresence;
        })
      );

      setFriends(friendsWithPresence);
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
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

  const getFriendStatus = (friend: FriendWithPresence) => {
    if (!friend.presence) return { label: "Offline", icon: "⚫", color: "text-muted-foreground" };
    
    const minutesAgo = Math.floor(
      (Date.now() - new Date(friend.presence.arrived_at).getTime()) / 60000
    );
    
    if (minutesAgo < 5) return { label: "Just Arrived", icon: "⏸", color: "text-blue-600" };
    if (minutesAgo < 15) return { label: "Waiting", icon: "⚪", color: "text-yellow-600" };
    return { label: "On Court", icon: "▶", color: "text-green-600" };
  };

  const selectedPark = parks[selectedParkIndex];
  const friendsAtPark = friends.filter(
    (f) => f.presence && selectedPark && f.presence.park_id === selectedPark.id
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <h1 className="text-xl font-headline">Friends</h1>
        </div>
      </header>

      {/* Park Tabs */}
      {parks.length > 0 && (
        <div className="bg-card border-b border-border py-4">
          <div className="max-w-md mx-auto px-4">
            <div className="flex gap-2 justify-center">
              {parks.map((park, index) => (
                <Button
                  key={park.id}
                  variant={selectedParkIndex === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedParkIndex(index)}
                  className="flex-1"
                >
                  {park.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto p-6 pb-24 space-y-6">
        {/* Friends at Selected Park - Horizontal */}
        <div>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            {friendsAtPark.length} of your friends {friendsAtPark.length === 1 ? 'is' : 'are'} here now
          </p>
          
          {friendsAtPark.length > 0 ? (
            <div className="flex gap-6 justify-center overflow-x-auto pb-2">
              {friendsAtPark.map((friend) => {
                const status = getFriendStatus(friend);
                return (
                  <div key={friend.friendId} className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <Avatar className="w-20 h-20 border-4 border-dashed border-foreground">
                        <AvatarImage src={friend.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-lg">
                          {getInitials(friend.profile.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-background flex items-center justify-center">
                        <span className="text-xl">{status.icon}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No friends at this park right now
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t-2 border-dashed border-border" />

        {/* All Friends - Vertical List */}
        <div className="space-y-4">
          {friends.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No friends yet. Add some to see when they're playing!
              </p>
            </Card>
          ) : (
            friends.map((friend) => {
              const status = getFriendStatus(friend);
              return (
                <Card
                  key={friend.friendId}
                  className="p-4 border-2 border-dashed"
                  style={{
                    backgroundColor: friend.presence
                      ? "rgba(134, 239, 172, 0.1)"
                      : "rgba(229, 229, 229, 0.1)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-16 h-16 border-4 border-dashed border-foreground">
                        <AvatarImage src={friend.profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(friend.profile.display_name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-2">
                        {friend.profile.display_name || "Anonymous"}
                      </h3>
                      
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{status.icon}</span>
                        <span className={`text-sm font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      {friend.profile.dupr_rating && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="text-lg">🎾</span>
                          <span>DUPR Rating: {friend.profile.dupr_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    {friend.presence && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 bg-green-100 hover:bg-green-200 border-green-400 border-2 border-dashed"
                      >
                        <span className="text-lg mr-1">🎾</span>
                        Invite to Play
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Add Friends Button */}
        <div className="pt-4">
          <Button
            onClick={() => toast.info("Add friends feature coming soon!")}
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            <Users className="w-5 h-5 mr-2" />
            Add or Invite Friends
          </Button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/")}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-xs">home</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/parks")}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-xs">parks</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-xs text-primary">friends</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/profile")}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">me</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Friends;
