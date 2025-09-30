import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Heart, ChevronLeft, Info, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import carlSchurzParkImage from "@/assets/carl-schurz-park.png";

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
    const { data: parksData, error } = await supabase
      .from("parks")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error loading parks:", error);
      return;
    }

    if (parksData && parksData.length > 0) {
      setParks(parksData);
      setSelectedParkId(parksData[0].id);
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

  const getCourtDetails = () => {
    switch (selectedPark?.name) {
      case "Carl Schurz Park":
        return "Three courts with permanent lines and permanent nets.";
      case "Central Park":
        return "3 courts with permanent lines and bring your own net.";
      case "Riverside Park":
        return "5 courts with permanent lines and permanent net, with one additional makeshift court with permanent lines and a portable net.";
      default:
        return "Court information not available.";
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
            <span className="text-muted-foreground">{selectedPark?.address}</span>
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
            <div className="text-xs text-center font-medium">Courts<br/>Available</div>
          </button>

          {/* Norms Card */}
          <div className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 flex flex-col items-center">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-xs text-center font-medium mt-2">Norms<br/>and Rules</div>
          </div>

          {/* Hours Card */}
          <div className="bg-card/50 backdrop-blur rounded-2xl p-4 border-2 border-dashed border-foreground/20 flex flex-col items-center">
            <Sun className="w-8 h-8 mb-2 text-yellow-500" />
            <div className="text-xs text-center font-medium">Sun up to<br/>Sundown</div>
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
            <Heart className="w-5 h-5" />
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
            <DialogTitle>Courts Available at {selectedPark?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground">{getCourtDetails()}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Parks;
