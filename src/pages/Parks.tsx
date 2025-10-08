import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { MapPin, Users, ChevronLeft, Info, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import heartIcon from "@/assets/heart-icon.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import carlSchurzParkImage from "@/assets/carl-schurz-park.png";
import centralParkImage from "@/assets/central-park.png";
import riversideParkImage from "@/assets/riverside-park.png";

interface Park {
  id: string;
  name: string;
  address: string;
  court_count: number;
}

const Parks = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [playersCount, setPlayersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [courtsDialogOpen, setCourtsDialogOpen] = useState(false);

  useEffect(() => {
    // Check auth and get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      checkWelcomeProgress(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkWelcomeProgress = async (userId: string) => {
    const { data: progress } = await supabase
      .from("welcome_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!progress || !progress.completed_ready) {
      navigate("/welcome/privacy");
      return;
    }

    loadParksData();
  };

  const loadParksData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Get user's home park
    let homeParkId = null;
    if (session?.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("home_park_id")
        .eq("id", session.user.id)
        .maybeSingle();
      homeParkId = profileData?.home_park_id;
    }

    const { data: parksData, error } = await supabase
      .from("parks")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error loading parks:", error);
      return;
    }

    if (parksData && parksData.length > 0) {
      // Sort parks with home park first
      const sortedParks = [...parksData];
      if (homeParkId) {
        const homeParkIndex = sortedParks.findIndex(p => p.id === homeParkId);
        if (homeParkIndex > 0) {
          const [homePark] = sortedParks.splice(homeParkIndex, 1);
          sortedParks.unshift(homePark);
        }
      }
      setParks(sortedParks);
      setSelectedParkId(sortedParks[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedParkId) {
      loadParkData();
    }
  }, [selectedParkId]);

  const loadParkData = async () => {
    const { count } = await supabase
      .from("presence")
      .select("*", { count: "exact", head: true })
      .eq("park_id", selectedParkId)
      .is("checked_out_at", null);

    setPlayersCount(count || 0);
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">loading...</div>
      </div>
    );
  }

  const selectedPark = parks.find(p => p.id === selectedParkId);

  const getCourtInfo = () => {
    switch (selectedPark?.name) {
      case "Carl Schurz Park":
        return {
          hours: "Sunrise to Sunset",
          lights: "No",
          surface: "Hard court",
          nets: "Permanent nets",
          lines: "Permanent lines",
          spacing: "Lots of space",
          additional: "Next to a space with skateboarders and kids playing other sports"
        };
      case "Central Park":
        return {
          hours: "Sunrise to Sunset",
          lights: "No",
          surface: "Hard court",
          nets: "Bring your own net",
          lines: "Permanent lines",
          spacing: "Standard",
          additional: "3 courts available"
        };
      case "Riverside Park":
        return {
          hours: "Sunrise to Sunset",
          lights: "No",
          surface: "Hard court",
          nets: "Permanent",
          lines: "Permanent",
          spacing: "Normal except one court is tight",
          additional: "There is a sixth court with lines and a provided portable net on asphalt"
        };
      default:
        return {
          hours: "N/A",
          lights: "N/A",
          surface: "N/A",
          nets: "N/A",
          lines: "N/A",
          spacing: "N/A",
          additional: "Court information not available"
        };
    }
  };

  const getParkAddress = () => {
    switch (selectedPark?.name) {
      case "Riverside Park":
        return "Riverside Park on 110th street (best to enter at 108th)";
      case "Central Park":
        return "North Meadow Handball Courts in the middle of Central Park at 97th Street";
      case "Carl Schurz Park":
        return "84th Street at Carl Schurz Park right by the East River";
      default:
        return selectedPark?.address || "";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with park selector */}
      <header className="bg-card p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="font-headline text-xl">{selectedPark?.name}</h1>
            <button>
              <Info className="w-6 h-6" />
            </button>
          </div>

          {/* Park Tabs */}
          <ToggleGroup 
            type="single" 
            value={selectedParkId} 
            onValueChange={(value) => value && setSelectedParkId(value)} 
            className="grid grid-cols-3 gap-2 w-full"
          >
            {parks.map((park) => (
              <ToggleGroupItem 
                key={park.id} 
                value={park.id}
                className="bg-card/50 backdrop-blur border-2 border-dashed border-foreground/20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary h-10 text-sm font-medium rounded-xl"
              >
                {park.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </header>

      {/* Park Image */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="w-full h-64 bg-gradient-to-br from-blue-400 to-green-400 rounded-lg overflow-hidden">
          {selectedPark?.name === "Carl Schurz Park" ? (
            <img 
              src={carlSchurzParkImage} 
              alt="Carl Schurz Park pickleball courts" 
              className="w-full h-full object-cover"
            />
          ) : selectedPark?.name === "Central Park" ? (
            <img 
              src={centralParkImage} 
              alt="Central Park pickleball courts" 
              className="w-full h-full object-cover"
            />
          ) : (selectedPark?.name?.toLowerCase().includes("riverside")) ? (
            <img 
              src={riversideParkImage} 
              alt="Riverside Park pickleball courts" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/70">
              Park Image
            </div>
          )}
        </div>

        {/* Address */}
        <div className="flex items-start gap-3 mt-6">
          <MapPin className="w-6 h-6 flex-shrink-0 mt-1" />
          <div>
            <span className="font-medium">Address: </span>
            <span className="text-muted-foreground">{getParkAddress()}</span>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {/* Courts Card */}
          <button 
            onClick={() => setCourtsDialogOpen(true)}
            className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 flex flex-col items-center hover:bg-card/70 transition-colors"
          >
            <div className="text-4xl mb-2">🎾</div>
            <div className="text-3xl font-bold mb-1">{selectedPark?.court_count || 0}</div>
            <div className="text-xs text-center font-medium">Courts</div>
          </button>

          {/* Rules and Norms Card */}
          <div className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 flex flex-col items-center">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-xs text-center font-medium mt-2">Rules and<br/>Norms</div>
          </div>

          {/* Volunteer Info Card */}
          <div className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 flex flex-col items-center">
            <div className="text-4xl mb-2">🙋</div>
            <div className="text-xs text-center font-medium mt-2">Volunteer<br/>Info</div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/")}
          >
            <img src={heartIcon} alt="heart" className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
          >
            <MapPin className="w-5 h-5 text-primary fill-primary" />
            <span className="text-xs text-primary">Parks</span>
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

      {/* Courts Details Dialog */}
      <Dialog open={courtsDialogOpen} onOpenChange={setCourtsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Court Information - {selectedPark?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {(() => {
              const info = getCourtInfo();
              return (
                <>
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <span className="font-medium text-muted-foreground">Hours:</span>
                    <span className="text-foreground text-right">{info.hours}</span>
                  </div>
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <span className="font-medium text-muted-foreground">Lights:</span>
                    <span className="text-foreground text-right">{info.lights}</span>
                  </div>
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <span className="font-medium text-muted-foreground">Surface:</span>
                    <span className="text-foreground text-right">{info.surface}</span>
                  </div>
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <span className="font-medium text-muted-foreground">Nets:</span>
                    <span className="text-foreground text-right">{info.nets}</span>
                  </div>
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <span className="font-medium text-muted-foreground">Lines:</span>
                    <span className="text-foreground text-right">{info.lines}</span>
                  </div>
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <span className="font-medium text-muted-foreground">Spacing:</span>
                    <span className="text-foreground text-right">{info.spacing}</span>
                  </div>
                  <div className="flex justify-between items-start pt-2">
                    <span className="font-medium text-muted-foreground">Additional Info:</span>
                    <span className="text-foreground text-right max-w-[60%]">{info.additional}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Parks;
