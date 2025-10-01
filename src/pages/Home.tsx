import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, Heart, MapPin, Bell, ChevronRight } from "lucide-react";
import { SkillFilterDialog } from "@/components/SkillFilterDialog";
import { StackReportDialog } from "@/components/StackReportDialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDuprRating } from "@/lib/utils";

interface Park {
  id: string;
  name: string;
  court_count: number;
}

interface PlayerAtPark {
  id: string;
  display_name: string | null;
  dupr_rating: number | null;
}

const Home = () => {
  const navigate = useNavigate();
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [playersCount, setPlayersCount] = useState(0);
  const [skillRange, setSkillRange] = useState<[number, number]>([3.0, 4.0]);
  const [skillPlayersCount, setSkillPlayersCount] = useState(0);
  const [quality, setQuality] = useState<"bad" | "good" | "great">("good");
  const [loading, setLoading] = useState(true);
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [showPlayersDialog, setShowPlayersDialog] = useState(false);
  const [playersAtPark, setPlayersAtPark] = useState<PlayerAtPark[]>([]);
  const [displayName, setDisplayName] = useState<string>("Friend");
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedParkId) {
      loadParkData();
    }
  }, [selectedParkId, skillRange]);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load user profile with home park
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, home_park_id")
        .eq("id", session.user.id)
        .single();

      if (profileData?.display_name) {
        setDisplayName(profileData.display_name);
      }

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
          profiles(id, display_name, dupr_rating)
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

  const getQualityMessage = () => {
    const selectedPark = parks.find(p => p.id === selectedParkId);
    const parkName = selectedPark?.name || "Park";
    
    switch (quality) {
      case "great":
        return `Yes! Courts are hot right now`;
      case "good":
        return `Good time to play at ${parkName}`;
      case "bad":
        return `Courts are pretty busy right now`;
    }
  };

  const formatRating = (rating: number) => {
    // Remove trailing zeros but keep at least one decimal place
    const formatted = rating.toFixed(2);
    if (formatted.endsWith('0') && !formatted.endsWith('.0')) {
      return rating.toFixed(1);
    }
    return formatted;
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
          <h1 className="font-headline text-2xl">pickleheart</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Hey {displayName}!</span>
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
          <ToggleGroup type="single" value={selectedParkId} onValueChange={(value) => value && setSelectedParkId(value)} className="grid grid-cols-3 gap-2 w-full">
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
          {/* Decorative Circle */}
          <div className={`absolute inset-8 rounded-full opacity-40 border-4 border-dashed border-foreground/20 ${
            quality === 'great' ? 'bg-status-great' : 
            quality === 'good' ? 'bg-status-good' : 
            'bg-status-bad'
          }`} />
          
          {/* Central Message */}
          <div className="relative z-10 bg-card rounded-full w-64 h-64 flex flex-col items-center justify-center p-6 shadow-lg border-2 border-dashed border-foreground/20">
            <p className="text-xs text-muted-foreground mb-2">{selectedPark?.name}</p>
            <p className="font-headline text-2xl text-center leading-tight">
              {getQualityMessage()}
            </p>
            <Heart className="w-8 h-8 mt-3 text-primary fill-primary" />
          </div>
        </div>

        {/* Info Cards */}
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3 w-full px-2">
          <button
            onClick={() => setShowPlayersDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors"
          >
            <div className="text-3xl font-bold mb-1">{playersCount}</div>
            <div className="text-xs font-medium">Players at<br/>the Park</div>
          </button>
          
          <button
            onClick={() => setShowSkillDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors"
          >
            <div className="text-3xl font-bold mb-1">{skillPlayersCount}</div>
            <div className="text-xs font-medium">{formatRating(skillRange[0])}-{formatRating(skillRange[1])}<br/>Players at the Park</div>
          </button>
          
          <button
            onClick={() => setShowStackDialog(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 hover:bg-card/70 transition-colors"
          >
            <div className="text-3xl font-bold mb-1">—</div>
            <div className="text-xs font-medium">Stack Count</div>
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <Heart className="w-5 h-5 text-primary fill-primary" />
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
      />

      <StackReportDialog
        isOpen={showStackDialog}
        onClose={() => setShowStackDialog(false)}
        parkId={selectedParkId}
        onReported={() => loadParkData()}
        isInGeofence={true}
      />

      {/* Players List Dialog */}
      {showPlayersDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPlayersDialog(false)}>
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Players at Park</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {playersAtPark.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No players currently at this park</p>
              ) : (
                playersAtPark.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                    <span className="font-medium">{player.display_name || "Anonymous"}</span>
                    <span className="text-sm text-muted-foreground">
                      {player.dupr_rating ? formatDuprRating(player.dupr_rating) : "—"}
                    </span>
                  </div>
                ))
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
    </div>
  );
};

export default Home;
