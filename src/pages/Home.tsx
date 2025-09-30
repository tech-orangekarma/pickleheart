import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, Heart, MapPin, Smile, Frown, Meh } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SkillFilterDialog } from "@/components/SkillFilterDialog";
import { StackReportDialog } from "@/components/StackReportDialog";

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

      // Load parks
      const { data: parksData } = await supabase
        .from("parks")
        .select("id, name, court_count")
        .order("name");

      if (parksData && parksData.length > 0) {
        setParks(parksData);
        setSelectedParkId(parksData[0].id);
      }
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

  const getQualityIcon = () => {
    switch (quality) {
      case "great":
        return <Smile className="w-20 h-20 text-green-500" />;
      case "good":
        return <Meh className="w-20 h-20 text-yellow-500" />;
      case "bad":
        return <Frown className="w-20 h-20 text-red-500" />;
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Park Selection - Top */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto">
          <ToggleGroup 
            type="single" 
            value={selectedParkId} 
            onValueChange={(value) => value && setSelectedParkId(value)}
            className="justify-start flex-wrap"
          >
            {parks.map((park) => (
              <ToggleGroupItem key={park.id} value={park.id} className="flex-1">
                {park.name.split(" ")[0]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </header>

      {/* Quality Indicator - Center */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          {getQualityIcon()}
          <p className="text-2xl font-bold mt-4 capitalize">{quality}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {playersCount} {playersCount === 1 ? "player" : "players"} at park
          </p>
        </div>
      </main>

      {/* Action Buttons - Bottom */}
      <div className="bg-card border-t border-border p-4 pb-20">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          <Button 
            variant="outline" 
            className="flex-col h-20 text-xs"
            onClick={() => setShowPlayersDialog(true)}
          >
            <Users className="w-5 h-5 mb-1" />
            players at park
          </Button>
          <Button 
            variant="outline" 
            className="flex-col h-20 text-xs"
            onClick={() => setShowSkillDialog(true)}
          >
            <span className="text-lg font-bold">{skillPlayersCount}</span>
            <span className="mt-1">{skillRange[0]}-{skillRange[1]} players</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex-col h-20 text-xs"
            onClick={() => setShowStackDialog(true)}
          >
            <MapPin className="w-5 h-5 mb-1" />
            stack count
          </Button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <Heart className="w-5 h-5 text-primary" />
            <span className="text-xs text-primary">home</span>
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
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/friends")}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">friends</span>
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
                      {player.dupr_rating?.toFixed(2) || "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Button className="w-full mt-4" onClick={() => setShowPlayersDialog(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
