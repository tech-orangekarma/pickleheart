import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Heart } from "lucide-react";

interface Park {
  id: string;
  name: string;
  address: string;
  court_count: number;
}

interface ParkStats {
  park_id: string;
  player_count: number;
  status: "bad" | "good" | "great";
}

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [parks, setParks] = useState<Park[]>([]);
  const [parkStats, setParkStats] = useState<Record<string, ParkStats>>({});
  const [loading, setLoading] = useState(true);

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
      .single();

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

    setParks(parksData || []);

    // Calculate stats for each park
    const stats: Record<string, ParkStats> = {};
    for (const park of parksData || []) {
      const { count } = await supabase
        .from("presence")
        .select("*", { count: "exact", head: true })
        .eq("park_id", park.id)
        .is("checked_out_at", null);

      const playerCount = count || 0;
      let status: "bad" | "good" | "great" = "bad";
      if (playerCount >= 8) status = "great";
      else if (playerCount >= 4) status = "good";

      stats[park.id] = { park_id: park.id, player_count: playerCount, status };
    }

    setParkStats(stats);
    setLoading(false);
  };

  const getStatusColor = (status: "bad" | "good" | "great") => {
    switch (status) {
      case "bad":
        return "bg-status-bad";
      case "good":
        return "bg-status-good";
      case "great":
        return "bg-status-great";
    }
  };

  const getStatusLabel = (status: "bad" | "good" | "great") => {
    switch (status) {
      case "bad":
        return "quiet";
      case "good":
        return "good vibes";
      case "great":
        return "it's on!";
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
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-headline flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            pickleheart
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => supabase.auth.signOut()}
          >
            sign out
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
        <div className="text-center py-6">
          <h2 className="text-xl font-headline mb-2">where should you play?</h2>
          <p className="text-muted-foreground text-sm">
            tap a park to see who's there
          </p>
        </div>

        <div className="space-y-4">
          {parks.map((park) => {
            const stats = parkStats[park.id];
            if (!stats) return null;

            return (
              <Card
                key={park.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/park/${park.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-24 h-24 rounded-full ${getStatusColor(
                      stats.status
                    )} flex flex-col items-center justify-center shadow-lg`}
                  >
                    <Users className="w-8 h-8 mb-1" />
                    <span className="text-2xl font-bold">
                      {stats.player_count}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-headline mb-1">{park.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{park.address}</span>
                    </div>
                    <div className="inline-block px-3 py-1 rounded-full bg-muted text-sm font-medium">
                      {getStatusLabel(stats.status)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <MapPin className="w-5 h-5" />
            <span className="text-xs">parks</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <Users className="w-5 h-5" />
            <span className="text-xs">friends</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-1">
            <Heart className="w-5 h-5" />
            <span className="text-xs">me</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Home;
