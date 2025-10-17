import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, MapPin, Search, Filter, ArrowUpDown } from "lucide-react";
import heartIcon from "@/assets/heart-icon.png";
import { toast } from "sonner";
import { InviteFriendsDialog } from "@/components/InviteFriendsDialog";
import { UserSearchDialog } from "@/components/UserSearchDialog";
import { FriendFinderDialog } from "@/components/FriendFinderDialog";
import { FriendDetailDialog } from "@/components/FriendDetailDialog";
import { formatDuprRating } from "@/lib/utils";
import { formatPlannedVisitDate } from "@/utils/dateFormat";
import { format } from "date-fns";

interface Park {
  id: string;
  name: string;
}

interface FriendProfile {
  id: string;
  display_name: string | null;
  dupr_rating: number | null;
  avatar_url: string | null;
  age: number | null;
  gender: string | null;
}

interface FriendWithPresence {
  friendId: string;
  profile: FriendProfile;
  presence?: {
    park_id: string;
    arrived_at: string;
    parks: { name: string };
  } | null;
  plannedVisit?: {
    park_name: string;
    planned_at: string;
  } | null;
}

interface PendingRequest {
  id: string;
  requester_id: string;
  display_name: string;
  dupr_rating: number | null;
  avatar_url: string | null;
  created_at: string;
}

interface SentRequest {
  id: string;
  addressee_id: string;
  display_name: string;
  dupr_rating: number | null;
  avatar_url: string | null;
  created_at: string;
}

const Friends = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkIndex, setSelectedParkIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [friendFinderOpen, setFriendFinderOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendWithPresence | null>(null);
  const [friendDetailOpen, setFriendDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'age' | 'dupr' | 'status'>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllPendingRequests, setShowAllPendingRequests] = useState(false);
  const [showAllSentRequests, setShowAllSentRequests] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has completed welcome flow
      const { data: welcomeProgress } = await supabase
        .from("welcome_progress")
        .select("completed_ready, current_step")
        .eq("user_id", session.user.id)
        .single();

      // If welcome flow not completed, redirect to appropriate step
      if (!welcomeProgress?.completed_ready) {
        const step = welcomeProgress?.current_step || "delight";
        navigate(`/welcome/${step}`);
        return;
      }

      setUserId(session.user.id);
      loadData(session.user.id);
    });
  }, [navigate]);

  const loadData = async (uid: string) => {
    await Promise.all([loadParks(uid), loadFriends(uid)]);
  };

  const loadParks = async (uid: string) => {
    try {
      // Get user's home park
      const { data: profileData } = await supabase
        .from("profiles")
        .select("home_park_id")
        .eq("id", uid)
        .single();

      const { data, error } = await supabase
        .from("parks")
        .select("id, name")
        .order("name");

      if (error) throw error;
      
      // Sort parks to put home park first
      if (data && profileData?.home_park_id) {
        const homeParkIndex = data.findIndex(p => p.id === profileData.home_park_id);
        if (homeParkIndex > 0) {
          const homePark = data[homeParkIndex];
          data.splice(homeParkIndex, 1);
          data.unshift(homePark);
        }
      }
      
      setParks(data || []);
    } catch (error) {
      console.error("Error loading parks:", error);
    }
  };

  const loadFriends = async (uid: string) => {
    try {
      // Load accepted friendships
      const { data: acceptedData, error: acceptedError } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

      if (acceptedError) throw acceptedError;

      // Load pending requests where current user is the addressee
      const { data: pendingData, error: pendingError} = await supabase
        .from("friendships")
        .select("id, requester_id, created_at")
        .eq("status", "pending")
        .eq("addressee_id", uid);

      if (!pendingError && pendingData) {
        // Load profiles for pending requests using secure function
        const requests: PendingRequest[] = await Promise.all(
          pendingData.map(async (req) => {
            const { data: profileData } = await supabase
              .rpc("get_public_profile", { profile_id: req.requester_id })
              .single();
            
            return {
              id: req.id,
              requester_id: req.requester_id,
              display_name: profileData?.display_name || "Unknown User",
              dupr_rating: profileData?.dupr_rating || null,
              avatar_url: profileData?.avatar_url || null,
              created_at: req.created_at,
            };
          })
        );
        setPendingRequests(requests);
      }

      // Load pending requests where current user is the requester (sent requests)
      const { data: sentData, error: sentError} = await supabase
        .from("friendships")
        .select("id, addressee_id, created_at")
        .eq("status", "pending")
        .eq("requester_id", uid);

      if (!sentError && sentData) {
        // Load profiles for sent requests using secure function
        const sent: SentRequest[] = await Promise.all(
          sentData.map(async (req) => {
            const { data: profileData } = await supabase
              .rpc("get_public_profile", { profile_id: req.addressee_id })
              .single();
            
            return {
              id: req.id,
              addressee_id: req.addressee_id,
              display_name: profileData?.display_name || "Unknown User",
              dupr_rating: profileData?.dupr_rating || null,
              avatar_url: profileData?.avatar_url || null,
              created_at: req.created_at,
            };
          })
        );
        setSentRequests(sent);
      }

      const friendsWithPresence = await Promise.all(
        (acceptedData || []).map(async (friendship) => {
          const friendId =
            friendship.requester_id === uid
              ? friendship.addressee_id
              : friendship.requester_id;
          
          // Get friend profile using security definer function
          const { data: profileData } = await supabase
            .rpc("get_public_profile", { profile_id: friendId })
            .single();

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

          // Get friend's next planned visit
          const { data: plannedVisitData } = await supabase
            .from("planned_visits")
            .select(`
              planned_at,
              parks (name)
            `)
            .eq("user_id", friendId)
            .order("planned_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            friendId,
            profile: profileData || {
              id: friendId,
              display_name: null,
              dupr_rating: null,
              avatar_url: null,
              age: null,
              gender: null,
            },
            presence: presenceData,
            plannedVisit: plannedVisitData ? {
              park_name: (plannedVisitData.parks as any)?.name || "Unknown Park",
              planned_at: plannedVisitData.planned_at,
            } : null,
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

  const handleAcceptRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept friend request");
      return;
    }

    toast.success("Friend request accepted!");
    if (userId) loadFriends(userId);
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject friend request");
      return;
    }

    toast.success("Friend request rejected");
    if (userId) loadFriends(userId);
  };

  const handleCancelRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (error) {
      console.error("Error canceling request:", error);
      toast.error("Failed to cancel friend request");
      return;
    }

    toast.success("Friend request canceled");
    if (userId) loadFriends(userId);
  };

  const handleRemoveFriend = async () => {
    if (!selectedFriend || !userId) return;

    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${selectedFriend.friendId}),and(requester_id.eq.${selectedFriend.friendId},addressee_id.eq.${userId})`);

    if (error) {
      console.error("Error removing friend:", error);
      toast.error("Failed to remove friend");
      return;
    }

    toast.success("Friend removed");
    setSelectedFriend(null);
    if (userId) loadFriends(userId);
  };

  const handleFriendClick = (friend: FriendWithPresence) => {
    setSelectedFriend(friend);
    setFriendDetailOpen(true);
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

  const sortedFriends = [...friends].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'age') {
      const ageA = a.profile.age || 0;
      const ageB = b.profile.age || 0;
      comparison = ageB - ageA;
    } else if (sortBy === 'dupr') {
      const duprA = a.profile.dupr_rating || 0;
      const duprB = b.profile.dupr_rating || 0;
      comparison = duprB - duprA;
    } else {
      // Sort by status - online friends first
      const statusA = a.presence ? 1 : 0;
      const statusB = b.presence ? 1 : 0;
      comparison = statusB - statusA;
    }
    
    return sortOrder === 'desc' ? comparison : -comparison;
  });

  const handleSortClick = (type: 'age' | 'dupr' | 'status') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(type);
      setSortOrder('desc');
    }
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
          {/* Pending Friend Requests */}
          {pendingRequests.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Friend Requests</h2>
              {(showAllPendingRequests ? pendingRequests : pendingRequests.slice(0, 10)).map((request) => (
                <Card key={request.id} className="p-4 border-2 border-dashed">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="flex-shrink-0">
                        <AvatarImage src={request.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(request.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{request.display_name}</p>
                        {request.dupr_rating && (
                          <p className="text-sm text-muted-foreground">
                            DUPR: {formatDuprRating(request.dupr_rating)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(request.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {pendingRequests.length > 10 && !showAllPendingRequests && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAllPendingRequests(true)}
                >
                  See All ({pendingRequests.length})
                </Button>
              )}
            </>
          )}

          {/* Sent Friend Requests */}
          {sentRequests.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Pending Requests You've Sent</h2>
              {(showAllSentRequests ? sentRequests : sentRequests.slice(0, 10)).map((request) => (
                <Card key={request.id} className="p-4 border-2 border-dashed bg-muted/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="flex-shrink-0">
                        <AvatarImage src={request.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(request.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{request.display_name}</p>
                        {request.dupr_rating && (
                          <p className="text-sm text-muted-foreground">
                            DUPR: {formatDuprRating(request.dupr_rating)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelRequest(request.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {sentRequests.length > 10 && !showAllSentRequests && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAllSentRequests(true)}
                >
                  See All ({sentRequests.length})
                </Button>
              )}
            </>
          )}

          {(pendingRequests.length > 0 || sentRequests.length > 0) && friends.length > 0 && (
            <div className="flex items-center justify-between mt-6 mb-2">
              <h2 className="text-lg font-semibold">Friends</h2>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'status' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortClick('status')}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Status
                </Button>
                <Button
                  variant={sortBy === 'age' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortClick('age')}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Age
                </Button>
                <Button
                  variant={sortBy === 'dupr' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortClick('dupr')}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  DUPR
                </Button>
              </div>
            </div>
          )}

          {friends.length > 0 && (pendingRequests.length === 0 && sentRequests.length === 0) && (
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Friends</h2>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'status' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortClick('status')}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Status
                </Button>
                <Button
                  variant={sortBy === 'age' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortClick('age')}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Age
                </Button>
                <Button
                  variant={sortBy === 'dupr' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortClick('dupr')}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  DUPR
                </Button>
              </div>
            </div>
          )}

          {friends.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No friends yet. Add some to see when they're playing!
              </p>
            </Card>
          ) : (
            <>
              {(showAllFriends ? sortedFriends : sortedFriends.slice(0, 10)).map((friend) => {
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
                        <h3 
                          className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleFriendClick(friend)}
                        >
                          {friend.profile.display_name || "Anonymous"}
                        </h3>
                        
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{status.icon}</span>
                          <span className={`text-sm font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>

                        {/* Age and Gender */}
                        {(friend.profile.age || friend.profile.gender) && (
                          <div className="text-sm text-muted-foreground mb-1">
                            {friend.profile.age && (
                              <span>{friend.profile.age} years old</span>
                            )}
                            {friend.profile.age && friend.profile.gender && <span> • </span>}
                            {friend.profile.gender && <span>{friend.profile.gender}</span>}
                          </div>
                        )}

                        {friend.profile.dupr_rating && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="text-lg">🎾</span>
                            <span>DUPR Rating: {formatDuprRating(friend.profile.dupr_rating)}</span>
                          </div>
                        )}

                        {friend.plannedVisit && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="text-lg">📅</span>
                            <span>
                              Next visit: {formatPlannedVisitDate(new Date(friend.plannedVisit.planned_at))} at {format(new Date(friend.plannedVisit.planned_at), "h:mm a")} - {friend.plannedVisit.park_name}
                            </span>
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
              })}
              {friends.length > 10 && !showAllFriends && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAllFriends(true)}
                >
                  See All ({friends.length})
                </Button>
              )}
            </>
          )}
        </div>

        {/* Add Friends Buttons */}
        <div className="pt-4 space-y-3">
          <Button
            onClick={() => setSearchDialogOpen(true)}
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            <Search className="w-5 h-5 mr-2" />
            Add friends on the app
          </Button>
          
          <Button
            onClick={() => setInviteDialogOpen(true)}
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            <Users className="w-5 h-5 mr-2" />
            Invite friends to join
          </Button>

          <Button
            onClick={() => setFriendFinderOpen(true)}
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            <Filter className="w-5 h-5 mr-2" />
            Friend Finder Tool
          </Button>
        </div>
      </main>

      <UserSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        currentUserId={userId || ""}
      />

      <InviteFriendsDialog 
        open={inviteDialogOpen} 
        onOpenChange={setInviteDialogOpen}
      />

      <FriendFinderDialog
        open={friendFinderOpen}
        onOpenChange={setFriendFinderOpen}
      />

      {selectedFriend && (
        <FriendDetailDialog
          open={friendDetailOpen}
          onOpenChange={setFriendDetailOpen}
          friendId={selectedFriend.friendId}
          friendName={selectedFriend.profile.display_name}
          friendAvatar={selectedFriend.profile.avatar_url}
          friendAge={selectedFriend.profile.age}
          friendGender={selectedFriend.profile.gender}
          friendRating={selectedFriend.profile.dupr_rating}
          onRemoveFriend={handleRemoveFriend}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/")}
          >
            <img src={heartIcon} alt="home" className="w-5 h-5" />
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
