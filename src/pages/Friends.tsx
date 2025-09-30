import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Users, UserPlus, MapPin, Check, X, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Friend {
  id: string;
  status: "pending" | "accepted" | "declined";
  requester_id: string;
  addressee_id: string;
  requester_profile?: { display_name: string | null; dupr_rating: number | null };
  addressee_profile?: { display_name: string | null; dupr_rating: number | null };
}

interface FriendWithPresence extends Friend {
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
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      loadFriends(session.user.id);
    });
  }, [navigate]);

  const loadFriends = async (uid: string) => {
    try {
      // Get accepted friends
      const { data: acceptedData, error: acceptedError } = await supabase
        .from("friendships")
        .select(`
          id,
          status,
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(display_name, dupr_rating),
          addressee:profiles!friendships_addressee_id_fkey(display_name, dupr_rating)
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

      if (acceptedError) throw acceptedError;

      // Get presence for each friend
      const friendsWithPresence = await Promise.all(
        (acceptedData || []).map(async (friendship) => {
          const friendId =
            friendship.requester_id === uid
              ? friendship.addressee_id
              : friendship.requester_id;

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
            ...friendship,
            requester_profile: friendship.requester,
            addressee_profile: friendship.addressee,
            presence: presenceData,
          } as FriendWithPresence;
        })
      );

      setFriends(friendsWithPresence);

      // Get pending requests
      const { data: pendingData, error: pendingError } = await supabase
        .from("friendships")
        .select(`
          id,
          status,
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(display_name, dupr_rating),
          addressee:profiles!friendships_addressee_id_fkey(display_name, dupr_rating)
        `)
        .eq("status", "pending")
        .eq("addressee_id", uid);

      if (pendingError) throw pendingError;

      setPendingRequests(
        (pendingData || []).map((f) => ({
          ...f,
          requester_profile: f.requester,
          addressee_profile: f.addressee,
        }))
      );
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!userId || !searchEmail.trim()) return;

    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", searchEmail.trim())
        .single();

      if (userError || !userData) {
        toast.error("User not found");
        return;
      }

      const { error } = await supabase.from("friendships").insert({
        requester_id: userId,
        addressee_id: userData.id,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Friend request sent!");
      setSearchEmail("");
    } catch (error: any) {
      console.error("Error sending request:", error);
      toast.error(error.message || "Failed to send request");
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);

      if (error) throw error;

      toast.success("Friend request accepted!");
      if (userId) loadFriends(userId);
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "declined" })
        .eq("id", friendshipId);

      if (error) throw error;

      toast.success("Request declined");
      if (userId) loadFriends(userId);
    } catch (error) {
      console.error("Error declining request:", error);
      toast.error("Failed to decline request");
    }
  };

  const getFriendStatus = (friend: FriendWithPresence) => {
    if (friend.presence) {
      return {
        label: "at park",
        park: friend.presence.parks.name,
        color: "text-green-600",
      };
    }
    return { label: "offline", park: null, color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-headline flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            friends
          </h1>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            home
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends">
              my friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              requests ({pendingRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4 mt-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">add a friend</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter user ID or email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                <Button onClick={handleSendRequest} size="sm">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            {friends.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No friends yet. Add some to see when they're playing!
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => {
                  const friendProfile =
                    friend.requester_id === userId
                      ? friend.addressee_profile
                      : friend.requester_profile;
                  const status = getFriendStatus(friend);

                  return (
                    <Card key={friend.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">
                            {friendProfile?.display_name || "Anonymous"}
                          </h3>
                          <div className="flex items-center gap-2 text-sm">
                            <span className={status.color}>{status.label}</span>
                            {status.park && (
                              <>
                                <span>•</span>
                                <MapPin className="w-3 h-3" />
                                <span className="text-muted-foreground">
                                  {status.park}
                                </span>
                              </>
                            )}
                          </div>
                          {friendProfile?.dupr_rating && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {friendProfile.dupr_rating.toFixed(2)} DUPR
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4 mt-6">
            {pendingRequests.length === 0 ? (
              <Card className="p-8 text-center">
                <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No pending requests</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">
                          {request.requester_profile?.display_name ||
                            "Anonymous"}
                        </h3>
                        {request.requester_profile?.dupr_rating && (
                          <p className="text-sm text-muted-foreground">
                            {request.requester_profile.dupr_rating.toFixed(2)}{" "}
                            DUPR
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAcceptRequest(request.id)}
                        size="sm"
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        accept
                      </Button>
                      <Button
                        onClick={() => handleDeclineRequest(request.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        decline
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/")}
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
            <Heart className="w-5 h-5" />
            <span className="text-xs">me</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Friends;
