import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { formatPlannedVisitDate } from "@/utils/dateFormat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Bell, ChevronRight } from "lucide-react";
import { SkillFilterDialog } from "@/components/SkillFilterDialog";
import heartIcon from "@/assets/heart-icon.png";
import pickleheartLogo from "@/assets/pickleheart-logo-new.png";
import arrowNav from "@/assets/arrow-nav.png";
import { StackReportDialog } from "@/components/StackReportDialog";
import { ParkMediaDialog } from "@/components/ParkMediaDialog";
import { CourtConditionsDialog } from "@/components/CourtConditionsDialog";
import { PlannedVisitDialog } from "@/components/PlannedVisitDialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDuprRating } from "@/lib/utils";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
  court_count: number;
}

interface PlayerAtPark {
  id: string;
  display_name: string | null;
  dupr_rating: number | null;
  avatar_url: string | null;
  gender: string | null;
  birthday: string | null;
  privacy_settings: {
    share_name: boolean;
    share_skill_level: boolean;
  } | null;
}

const Home = () => {
  const navigate = useNavigate();
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [playersCount, setPlayersCount] = useState(10);
  const [skillRange, setSkillRange] = useState<[number, number]>([2.75, 3.75]);
  const [skillPlayersCount, setSkillPlayersCount] = useState(8);
  const [quality, setQuality] = useState<"bad" | "good" | "great">("great");
  const [loading, setLoading] = useState(true);
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [showPlayersDialog, setShowPlayersDialog] = useState(false);
  const [playersAtPark, setPlayersAtPark] = useState<PlayerAtPark[]>([]);
  const [displayName, setDisplayName] = useState<string>("Friend");
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [showCourtConditionsDialog, setShowCourtConditionsDialog] = useState(false);
  const [latestStackCount, setLatestStackCount] = useState<number | null>(2);
  const [latestCourtCondition, setLatestCourtCondition] = useState<string | null>("Dry");
  const [showPlannedVisitDialog, setShowPlannedVisitDialog] = useState(false);
  const [plannedVisit, setPlannedVisit] = useState<{ park_name: string; planned_at: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // useEffect(() => {
  //   if (selectedParkId) {
  //     loadParkData();
  //     loadLatestReports();
  //     loadPlannedVisit(selectedParkId);
  //   }
  // }, [selectedParkId, skillRange]);

  const loadPlannedVisit = async (parkId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("planned_visits")
        .select(`
          planned_at,
          parks (name)
        `)
        .eq("user_id", session.user.id)
        .eq("park_id", parkId)
        .maybeSingle();

      if (data) {
        setPlannedVisit({
          park_name: (data.parks as any)?.name || "Unknown Park",
          planned_at: data.planned_at
        });
      } else {
        setPlannedVisit(null);
      }
    } catch (error) {
      console.error("Error loading planned visit:", error);
    }
  };

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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

      // Load user profile with home park
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, home_park_id, dupr_rating")
        .eq("id", session.user.id)
        .single();

      if (profileData?.display_name) {
        setDisplayName(profileData.display_name);
      }

      // Set skill range based on user's rating
      // if (profileData?.dupr_rating) {
      //   const rating = profileData.dupr_rating;
      //   if (rating > 4.75) {
      //     setSkillRange([4.5, 5.0]);
      //   } else {
      //     const lower = Math.max(0, rating - 0.25);
      //     const upper = Math.min(5.0, rating + 0.25);
      //     setSkillRange([lower, upper]);
      //   }
      // }

      // Load parks
      const { data: parksData } = await supabase
        .from("parks")
        .select("id, name, court_count")
        .order("name");

      if (parksData && parksData.length > 0) {
        // Sort parks with home park first
        const sortedParks = [...parksData];
        if (profileData?.home_park_id) {
          const homeParkIndex = sortedParks.findIndex(p => p.id === profileData.home_park_id);
          if (homeParkIndex > 0) {
            const [homePark] = sortedParks.splice(homeParkIndex, 1);
            sortedParks.unshift(homePark);
          }
        }
        setParks(sortedParks);
        setSelectedParkId(sortedParks[0].id);
      }

      // Load pending friend requests count
      const { data: friendRequests } = await supabase
        .from("friendships")
        .select("id")
        .eq("addressee_id", session.user.id)
        .eq("status", "pending");
      
      setFriendRequestsCount(friendRequests?.length || 0);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadParkData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get all players at park
      const { data: presenceData } = await supabase
        .from("presence")
        .select(`
          user_id,
          profiles(
            id, 
            display_name, 
            dupr_rating, 
            avatar_url, 
            gender, 
            birthday,
            privacy_settings:privacy_settings(share_name, share_skill_level)
          )
        `)
        .eq("park_id", selectedParkId)
        .is("checked_out_at", null);

      const players = presenceData?.map((p: any) => p.profiles).filter(Boolean) || [];
      setPlayersAtPark(players);
      setPlayersCount(players.length);

      // Count players in skill range
      const skillPlayers = players.filter((p: PlayerAtPark) => 
        p.dupr_rating && p.dupr_rating >= skillRange[0] && p.dupr_rating <= skillRange[1]
      );
      setSkillPlayersCount(skillPlayers.length);

      // Calculate quality based on players and courts
      const selectedPark = parks.find(p => p.id === selectedParkId);
      if (selectedPark) {
        const courtRatio = players.length / (selectedPark.court_count * 4);
        if (courtRatio < 0.5) setQuality("great");
        else if (courtRatio < 1) setQuality("good");
        else setQuality("bad");
      }
    } catch (error) {
      console.error("Error loading park data:", error);
    }
  };

  const loadLatestReports = async () => {
    try {
      // Get latest stack report
      const { data: stackData } = await supabase
        .from("stack_reports")
        .select("stack_count")
        .eq("park_id", selectedParkId)
        .order("reported_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestStackCount(stackData?.stack_count ?? null);

      // Get latest court condition
      const { data: conditionData } = await supabase
        .from("court_conditions")
        .select("condition")
        .eq("park_id", selectedParkId)
        .order("reported_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setLatestCourtCondition(conditionData?.condition ?? null);
    } catch (error) {
      console.error("Error loading latest reports:", error);
    }
  };

  const getQualityMessage = () => {
    if (quality === "great") return "Yes, the courts are perfect for you!";
    if (quality === "good") return "Pretty good time to play!";
    return "Courts might be crowded";
  };

  const calculateAge = (birthday: string | null): number | null => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getDisplayName = (player: PlayerAtPark): string => {
    const shareName = player.privacy_settings?.share_name ?? false;
    return shareName ? (player.display_name || "Anonymous") : "Anonymous";
  };

  const getDisplayRating = (player: PlayerAtPark): string => {
    const shareSkillLevel = player.privacy_settings?.share_skill_level ?? true;
    return shareSkillLevel ? (player.dupr_rating ? formatDuprRating(player.dupr_rating) : "—") : "Hidden";
  };

  const formatRating = (rating: number) => {
    // Remove trailing zeros but keep at least one decimal place
    const formatted = rating.toFixed(2);
    if (formatted.endsWith('0') && !formatted.endsWith('.0')) {
      return rating.toFixed(1);
    }
    return formatted;
  };

  const handleCheckIn = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to check in");
        return;
      }

      // Check if already checked in at this park
      const { data: existingPresence } = await supabase
        .from("presence")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("park_id", selectedParkId)
        .is("checked_out_at", null)
        .maybeSingle();

      if (existingPresence) {
        toast.info("You're already checked in at this park");
        return;
      }

      // Create new presence record
      const { error } = await supabase
        .from("presence")
        .insert({
          user_id: session.user.id,
          park_id: selectedParkId,
          auto_checked_in: false,
          arrived_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success(`Checked in at ${selectedPark?.name || "park"}`);
      loadParkData(); // Refresh player count
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">loading...</div>
      </div>
    );
  }

  const selectedPark = parks.find(p => p.id === selectedParkId);

  return (
    <div className="min-h-screen flex flex-col pb-16">
      {/* Header */}
      <header className="p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <img src={pickleheartLogo} alt="pickleheart" className="h-20" />
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/profile")}
              className="text-sm font-medium hover:underline"
            >
              Hey {displayName}!
            </button>
            <button 
              className="relative"
              onClick={() => setShowNotificationsDialog(true)}
            >
              <Bell className="w-5 h-5" />
              {friendRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {friendRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Park Selector */}
      <div className="px-4 mb-6">
        <div className="max-w-md mx-auto">
          <ToggleGroup type="single" value={selectedParkId} onValueChange={(value) => {
            if (value) {
              setSelectedParkId(value);
            }
          }} className="grid grid-cols-3 gap-2 w-full">
            {parks.map((park) => (
              <ToggleGroupItem 
                key={park.id} 
                value={park.id}
                className="bg-card/50 backdrop-blur border-2 border-dashed border-foreground/20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary h-14 text-sm font-medium rounded-2xl"
              >
                {park.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Center Status Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <h2 className="font-headline text-2xl mb-8">Good time to play?</h2>
        
        <div className="relative w-80 h-80 flex items-center justify-center mb-12">
          {/* Left Arrow */}
          <button
            onClick={() => {
              const currentIndex = parks.findIndex(p => p.id === selectedParkId);
              if (currentIndex > 0) {
                setSelectedParkId(parks[currentIndex - 1].id);
              }
            }}
            disabled={parks.findIndex(p => p.id === selectedParkId) === 0}
            className="absolute -left-4 top-1/2 -translate-y-1/2 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 transition-transform"
          >
            <img 
              src={arrowNav} 
              alt="previous court" 
              className="w-12 h-12 rotate-180" 
            />
          </button>

          {/* Decorative Circle */}
          <div className={`absolute inset-8 rounded-full opacity-40 border-4 border-dashed border-foreground/20 ${
            quality === 'great' ? 'bg-status-great' : 
            quality === 'good' ? 'bg-status-good' : 
            'bg-status-bad'
          }`} />
          
          {/* Central Message */}
          <button
            onClick={() => setShowMediaDialog(true)}
            className="relative z-10 bg-card rounded-full w-64 h-64 flex flex-col items-center justify-center p-6 shadow-lg border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors cursor-pointer"
          >
            <p className="text-xs text-muted-foreground mb-2">{selectedPark?.name}</p>
            <p className="font-headline text-2xl text-center leading-tight">
              {getQualityMessage()}
            </p>
            <img src={heartIcon} alt="heart" className="w-8 h-8 mt-3" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={() => {
              const currentIndex = parks.findIndex(p => p.id === selectedParkId);
              if (currentIndex < parks.length - 1) {
                setSelectedParkId(parks[currentIndex + 1].id);
              }
            }}
            disabled={parks.findIndex(p => p.id === selectedParkId) === parks.length - 1}
            className="absolute -right-4 top-1/2 -translate-y-1/2 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 transition-transform"
          >
            <img 
              src={arrowNav} 
              alt="next court" 
              className="w-12 h-12" 
            />
          </button>
        </div>

        {/* Info Cards */}
        <div className="max-w-md mx-auto grid grid-cols-4 gap-3 w-full px-2">
          <button
            onClick={() => setShowPlayersDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors flex flex-col items-center"
          >
            <div className="text-3xl font-bold mb-1 min-h-[2.25rem] flex items-center">{playersCount}</div>
            <div className="text-xs font-medium text-center">Friends at<br/>the Park</div>
          </button>
          
          <button
            onClick={() => setShowSkillDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors flex flex-col items-center"
          >
            <div className="text-3xl font-bold mb-1 min-h-[2.25rem] flex items-center">{skillPlayersCount}</div>
            <div className="text-xs font-medium text-center">
              {skillRange[0] >= 4.5 
                ? `${formatRating(skillRange[0])}+` 
                : `${formatRating(skillRange[0])}-${formatRating(skillRange[1])}`}
              <br/>Players at the Park
            </div>
          </button>
          
          <button
            onClick={() => setShowStackDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors flex flex-col items-center"
          >
            <div className="text-3xl font-bold mb-1 min-h-[2.25rem] flex items-center">{latestStackCount ?? "—"}</div>
            <div className="text-xs font-medium text-center">Stack Count</div>
            <div className="text-xs font-medium mt-1 text-center">report the stack count</div>
          </button>

          <button
            onClick={() => setShowCourtConditionsDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors flex flex-col items-center"
          >
            <div className="text-2xl font-bold mb-1 capitalize min-h-[2.25rem] flex items-center">{latestCourtCondition ?? "—"}</div>
            <div className="text-xs font-medium text-center">court conditions</div>
            <div className="text-xs font-medium mt-1 text-center">report</div>
          </button>
        </div>

        {/* Check-in Button */}
        <div className="max-w-md mx-auto w-full px-2 mt-4 mb-2">
          <Button
            onClick={handleCheckIn}
            size="sm"
            variant="outline"
            className="w-full"
          >
            check in at {selectedPark?.name || "park"}
          </Button>
        </div>

        {/* Planned Visit Button */}
        <div className="max-w-md mx-auto w-full px-2 mb-4">
          <Button
            onClick={() => setShowPlannedVisitDialog(true)}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {plannedVisit 
              ? `Next planned visit ${formatPlannedVisitDate(new Date(plannedVisit.planned_at))} at ${format(new Date(plannedVisit.planned_at), "h:mm a")}`
              : "Plan your next visit"}
          </Button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <img src={heartIcon} alt="heart" className="w-5 h-5" />
            <span className="text-xs text-primary">Home</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/parks")}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-xs">Parks</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/friends")}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Friends</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/profile")}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </nav>

      {/* Dialogs */}
      <SkillFilterDialog
        isOpen={showSkillDialog}
        onClose={() => setShowSkillDialog(false)}
        onApply={(range) => {
          setSkillRange(range);
          setShowSkillDialog(false);
        }}
        currentRange={skillRange}
        parkId={selectedParkId}
      />

      <StackReportDialog
        isOpen={showStackDialog}
        onClose={() => setShowStackDialog(false)}
        parkId={selectedParkId}
        onReported={() => {
          loadParkData();
          loadLatestReports();
        }}
        isInGeofence={true}
      />

      {/* Players List Dialog */}
      {showPlayersDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPlayersDialog(false)}>
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Players at Park</h2>
            <div className="space-y-3 overflow-y-auto flex-1">
              {playersAtPark.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No players currently at this park</p>
              ) : (
                playersAtPark.map((player) => {
                  const age = calculateAge(player.birthday);
                  const displayName = getDisplayName(player);
                  const displayRating = getDisplayRating(player);
                  
                  return (
                    <div key={player.id} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback>
                          {displayName[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {displayName}
                        </p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          {age !== null && <span>{age}yo</span>}
                          {player.gender && <span>• {player.gender}</span>}
                          <span>• DUPR: {displayRating}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Button className="w-full mt-4" onClick={() => setShowPlayersDialog(false)}>Close</Button>
          </div>
        </div>
      )}

      {/* Notifications Dialog */}
      {showNotificationsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNotificationsDialog(false)}>
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Notifications</h2>
            <div className="space-y-2">
              {friendRequestsCount === 0 ? (
                <p className="text-muted-foreground text-center py-4">No new notifications</p>
              ) : (
                <button
                  onClick={() => {
                    setShowNotificationsDialog(false);
                    navigate("/friends");
                  }}
                  className="w-full flex items-center justify-between p-3 bg-background rounded-lg hover:bg-accent transition-colors"
                >
                  <span className="font-medium">{friendRequestsCount} Friend Request{friendRequestsCount !== 1 ? 's' : ''}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
            <Button className="w-full mt-4" onClick={() => setShowNotificationsDialog(false)}>Close</Button>
          </div>
        </div>
      )}

      {/* Park Media Dialog */}
      <ParkMediaDialog
        isOpen={showMediaDialog}
        onClose={() => setShowMediaDialog(false)}
        parkId={selectedParkId}
        parkName={selectedPark?.name || ""}
      />

      {/* Court Conditions Dialog */}
      <CourtConditionsDialog
        isOpen={showCourtConditionsDialog}
        onClose={() => {
          setShowCourtConditionsDialog(false);
          loadLatestReports();
        }}
        parkId={selectedParkId}
        parkName={selectedPark?.name || ""}
      />

      {/* Planned Visit Dialog */}
      <PlannedVisitDialog
        open={showPlannedVisitDialog}
        onOpenChange={(open) => {
          setShowPlannedVisitDialog(open);
          if (!open) {
            loadPlannedVisit(selectedParkId);
          }
        }}
        currentParkId={selectedParkId}
      />
    </div>
  );
};

export default Home;
