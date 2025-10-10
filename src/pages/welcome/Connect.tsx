import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ArrowLeft, Users, UserPlus, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type FriendFinderMode = "everyone" | "auto_friends" | "auto_requests" | "receive_all" | "manual";

const FriendFinder = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<FriendFinderMode>("receive_all");
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 100]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
  const [ratingRange, setRatingRange] = useState<[number, number]>([2.0, 5.0]);
  const [loading, setLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [newFriends, setNewFriends] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }
        setUserId(session.user.id);
        
        // Load existing friend finder settings
        const { data: existingSettings } = await supabase
          .from("friend_finder_settings")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        if (existingSettings) {
          setMode(existingSettings.mode);
          if (existingSettings.min_age && existingSettings.max_age) {
            setAgeRange([existingSettings.min_age, existingSettings.max_age]);
          }
          if (existingSettings.gender_filter && existingSettings.gender_filter !== 'all') {
            setGenderFilter(existingSettings.gender_filter.split(','));
          }
          if (existingSettings.min_rating && existingSettings.max_rating) {
            setRatingRange([existingSettings.min_rating, existingSettings.max_rating]);
          }
        }
        
        // Load pending friend requests (already created by database trigger)
        const { data: requests } = await supabase
          .from("friendships")
          .select("id, requester_id, created_at")
          .eq("addressee_id", session.user.id)
          .eq("status", "pending");

        // Fetch profiles using the secure function
        if (requests && requests.length > 0) {
          const requesterIds = requests.map(r => r.requester_id);
          const { data: profiles } = await supabase
            .rpc('get_friend_profiles', { user_ids: requesterIds });
          
          // Merge the data
          const requestsWithProfiles = requests.map(req => ({
            ...req,
            profiles: profiles?.find(p => p.id === req.requester_id)
          }));
          
          setPendingRequests(requestsWithProfiles);
        } else {
          setPendingRequests([]);
        }
      } catch (error) {
        console.error("Error during initialization:", error);
        toast({ description: "Failed to load friend requests", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const handleContinue = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Save friend finder settings
      const settings = {
        user_id: userId,
        mode,
        min_age: ageRange[0],
        max_age: ageRange[1],
        gender_filter: genderFilter.length === 0 ? 'all' : genderFilter.join(','),
        min_rating: ratingRange[0],
        max_rating: ratingRange[1],
      };

      const { error: settingsError } = await supabase
        .from("friend_finder_settings")
        .upsert(settings, { onConflict: 'user_id' });

      if (settingsError) throw settingsError;

      // Helper function to check if a profile matches criteria
      const matchesCriteria = (profile: any) => {
        if (!profile) return false;
        
        // Check age
        if (profile.birthday) {
          const age = new Date().getFullYear() - new Date(profile.birthday).getFullYear();
          if (age < ageRange[0] || age > ageRange[1]) return false;
        }
        
        // Check gender
        if (genderFilter.length > 0 && profile.gender) {
          if (!genderFilter.includes(profile.gender)) return false;
        }
        
        // Check rating
        if (profile.dupr_rating !== null && profile.dupr_rating !== undefined) {
          if (profile.dupr_rating < ratingRange[0] || profile.dupr_rating > ratingRange[1]) return false;
        }
        
        return true;
      };

      if (mode === "manual") {
        // Reject all pending friend requests
        if (pendingRequests.length > 0) {
          const requestIds = pendingRequests.map(req => req.id);
          await supabase
            .from("friendships")
            .delete()
            .in("id", requestIds);
        }
        
        // Mark welcome as complete and go to home
        await supabase.from("welcome_progress").update({
          completed_ready: true,
        }).eq("user_id", userId);
        
        toast({ description: "Friend settings saved!" });
        navigate("/");
      } else if (mode === "everyone") {
        // Accept ALL pending friend requests
        if (pendingRequests.length > 0) {
          const requestIds = pendingRequests.map(req => req.id);
          await supabase
            .from("friendships")
            .update({ status: "accepted" })
            .in("id", requestIds);
        }
        
        // Mark welcome as complete
        await supabase.from("welcome_progress").update({
          completed_ready: true,
        }).eq("user_id", userId);
        
        // Fetch newly accepted friends
        const { data: friends } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

        // Get all friend IDs
        const friendIds = friends?.map(f => 
          f.requester_id === userId ? f.addressee_id : f.requester_id
        ) || [];

        // Fetch profiles using the secure function
        let mappedFriends: any[] = [];
        if (friendIds.length > 0) {
          const { data: profiles } = await supabase
            .rpc('get_friend_profiles', { user_ids: friendIds });
          
          mappedFriends = friends?.map(f => {
            const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
            return {
              id: f.id,
              profile: profiles?.find(p => p.id === friendId)
            };
          }) || [];
        }

        setNewFriends(mappedFriends);
        setShowResultsDialog(true);
      } else if (mode === "auto_friends") {
        // Accept only requests that match criteria
        const matchingRequests = pendingRequests.filter(req => matchesCriteria(req.profiles));
        const nonMatchingRequests = pendingRequests.filter(req => !matchesCriteria(req.profiles));
        
        // Deny all non-matching requests
        if (nonMatchingRequests.length > 0) {
          const nonMatchingIds = nonMatchingRequests.map(req => req.id);
          await supabase
            .from("friendships")
            .delete()
            .in("id", nonMatchingIds);
        }
        
        // Accept matching requests
        if (matchingRequests.length > 0) {
          const requestIds = matchingRequests.map(req => req.id);
          await supabase
            .from("friendships")
            .update({ status: "accepted" })
            .in("id", requestIds);
        }
        
        // Mark welcome as complete
        await supabase.from("welcome_progress").update({
          completed_ready: true,
        }).eq("user_id", userId);
        
        // Fetch newly accepted friends
        const { data: friends } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

        // Get all friend IDs
        const friendIds = friends?.map(f => 
          f.requester_id === userId ? f.addressee_id : f.requester_id
        ) || [];

        // Fetch profiles using the secure function
        let mappedFriends: any[] = [];
        if (friendIds.length > 0) {
          const { data: profiles } = await supabase
            .rpc('get_friend_profiles', { user_ids: friendIds });
          
          mappedFriends = friends?.map(f => {
            const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
            return {
              id: f.id,
              profile: profiles?.find(p => p.id === friendId)
            };
          }) || [];
        }

        setNewFriends(mappedFriends);
        setShowResultsDialog(true);
      } else if (mode === "auto_requests") {
        // Filter requests that match criteria
        const matchingRequests = pendingRequests.filter(req => matchesCriteria(req.profiles));
        const nonMatchingRequests = pendingRequests.filter(req => !matchesCriteria(req.profiles));
        
        // Deny all non-matching requests
        if (nonMatchingRequests.length > 0) {
          const nonMatchingIds = nonMatchingRequests.map(req => req.id);
          await supabase
            .from("friendships")
            .delete()
            .in("id", nonMatchingIds);
        }
        
        setPendingRequests(matchingRequests);
        
        // Mark welcome as complete
        await supabase.from("welcome_progress").update({
          completed_ready: true,
        }).eq("user_id", userId);
        
        setShowResultsDialog(true);
      } else if (mode === "receive_all") {
        // Show all pending requests
        await supabase.from("welcome_progress").update({
          completed_ready: true,
        }).eq("user_id", userId);
        
        setShowResultsDialog(true);
      }
    } catch (error) {
      console.error("Error saving friend finder settings:", error);
      toast({ description: "Failed to save settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseResults = () => {
    setShowResultsDialog(false);
    navigate("/");
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", requestId);
      
      // Remove from pending requests
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      toast({ description: "Friend request accepted!" });
    } catch (error) {
      console.error("Error accepting request:", error);
      toast({ description: "Failed to accept request", variant: "destructive" });
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await supabase
        .from("friendships")
        .delete()
        .eq("id", requestId);
      
      // Remove from pending requests
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
      toast({ description: "Friend request denied" });
    } catch (error) {
      console.error("Error denying request:", error);
      toast({ description: "Failed to deny request", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Users className="w-16 h-16 text-primary" />
          </div>
          {pendingRequests.length > 0 ? (
            <>
              <h1 className="text-4xl font-headline mb-4">
                {pendingRequests.length} {pendingRequests.length === 1 ? 'person wants' : 'people want'} to be your friend
              </h1>
              <p className="text-muted-foreground mb-6">
                Choose how you want to proceed
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-headline mb-2">find your people</h1>
              <p className="text-muted-foreground">
                Choose how you want to connect with other players
              </p>
            </>
          )}
        </div>

        <div className="bg-card p-6 rounded-2xl space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">How do you want to connect?</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as FriendFinderMode)}>
              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="everyone" id="everyone" />
                <div className="space-y-1">
                  <Label htmlFor="everyone" className="cursor-pointer font-medium">
                    I want to be friends with everyone
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-Friend (Everyone)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="auto_friends" id="auto_friends" />
                <div className="space-y-1">
                  <Label htmlFor="auto_friends" className="cursor-pointer font-medium">
                    I want to be friends with people in my range
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-Friend (Range)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="auto_requests" id="auto_requests" />
                <div className="space-y-1">
                  <Label htmlFor="auto_requests" className="cursor-pointer font-medium">
                    I want to see friend requests from people in my range
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-Request (Range)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="receive_all" id="receive_all" />
                <div className="space-y-1">
                  <Label htmlFor="receive_all" className="cursor-pointer font-medium">
                    I want to see all requests
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive All
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="manual" id="manual" />
                <div className="space-y-1">
                  <Label htmlFor="manual" className="cursor-pointer font-medium">
                    I don't want to be friends with anyone
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Closed
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {(mode === "auto_friends" || mode === "auto_requests") && (
            <>
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Age Range: {ageRange[0]} - {ageRange[1]}
                </Label>
                <Slider
                  min={18}
                  max={100}
                  step={1}
                  value={ageRange}
                  onValueChange={(value) => setAgeRange(value as [number, number])}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Gender</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>
                        {genderFilter.length === 0
                          ? "All Genders"
                          : genderFilter.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(", ")}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-3 bg-background border border-border z-50">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                        <Checkbox
                          id="all-genders"
                          checked={genderFilter.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) setGenderFilter([]);
                          }}
                        />
                        <Label htmlFor="all-genders" className="cursor-pointer flex-1">
                          All Genders
                        </Label>
                      </div>
                      {['male', 'female', 'non-binary'].map((gender) => (
                        <div key={gender} className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                          <Checkbox
                            id={gender}
                            checked={genderFilter.includes(gender)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setGenderFilter([...genderFilter, gender]);
                              } else {
                                setGenderFilter(genderFilter.filter(g => g !== gender));
                              }
                            }}
                          />
                          <Label htmlFor={gender} className="cursor-pointer flex-1 capitalize">
                            {gender}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  DUPR Rating: {ratingRange[0].toFixed(1)} - {ratingRange[1].toFixed(1)}
                </Label>
                <Slider
                  min={2.0}
                  max={5.0}
                  step={0.1}
                  value={ratingRange}
                  onValueChange={(value) => setRatingRange(value as [number, number])}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>

        <Button onClick={handleContinue} size="lg" className="w-full mt-6" disabled={loading}>
          {loading ? "Saving..." : "continue"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/privacy")}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          step 7 of 8
        </p>
      </div>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === "everyone" || mode === "auto_friends" ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  Your New Friends ({newFriends.length})
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-primary" />
                  Friend Requests ({pendingRequests.length})
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {mode === "everyone" || mode === "auto_friends" ? (
              newFriends.length > 0 ? (
                newFriends.map(({ id, profile }) => (
                  <div key={id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback>{profile?.display_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{profile?.display_name || "Unknown"}</p>
                      {profile?.dupr_rating && (
                        <p className="text-sm text-muted-foreground">
                          DUPR: {profile.dupr_rating}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No new friends yet
                </p>
              )
            ) : (
              pendingRequests.length > 0 ? (
                pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={request.profiles?.avatar_url} />
                      <AvatarFallback>{request.profiles?.display_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{request.profiles?.display_name || "Unknown"}</p>
                      {request.profiles?.dupr_rating && (
                        <p className="text-sm text-muted-foreground">
                          DUPR: {request.profiles.dupr_rating}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(request.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDenyRequest(request.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No pending requests yet
                </p>
              )
            )}
          </div>

          <Button onClick={handleCloseResults} className="w-full">
            continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FriendFinder;
