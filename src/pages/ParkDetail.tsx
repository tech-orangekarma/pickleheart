import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Users, UserPlus } from "lucide-react";

interface Park {
  id: string;
  name: string;
  address: string;
  court_count: number;
}

interface PresenceData {
  id: string;
  user_id: string;
  arrived_at: string;
  profiles: {
    display_name: string | null;
    dupr_rating: number | null;
  } | null;
}

const ParkDetail = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const navigate = useNavigate();
  const [park, setPark] = useState<Park | null>(null);
  const [presences, setPresences] = useState<PresenceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parkId) {
      navigate("/");
      return;
    }

    loadParkData();
  }, [parkId, navigate]);

  const loadParkData = async () => {
    if (!parkId) return;

    try {
      // Load park info
      const { data: parkData, error: parkError } = await supabase
        .from("parks")
        .select("*")
        .eq("id", parkId)
        .single();

      if (parkError) throw parkError;
      setPark(parkData);

      // Load current presences
      const { data: presenceData, error: presenceError } = await supabase
        .from("presence")
        .select(`
          id,
          user_id,
          arrived_at,
          profiles (
            display_name,
            dupr_rating
          )
        `)
        .eq("park_id", parkId)
        .is("checked_out_at", null)
        .order("arrived_at", { ascending: false });

      if (presenceError) throw presenceError;
      setPresences(presenceData || []);
    } catch (error) {
      console.error("Error loading park:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatArrivalTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 5) return "just arrived";
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    return `${diffHours} hours ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">loading...</div>
      </div>
    );
  }

  if (!park) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">park not found</p>
          <Button onClick={() => navigate("/")}>back to home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            back
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-headline mb-2">{park.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <MapPin className="w-4 h-4" />
                <span>{park.address}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {park.court_count} {park.court_count === 1 ? "court" : "courts"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-headline mb-1">who's here now</h2>
            <p className="text-sm text-muted-foreground">
              {presences.length} {presences.length === 1 ? "player" : "players"}
            </p>
          </div>
          
          <Button size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            check in
          </Button>
        </div>

        {presences.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No one has checked in yet. Be the first!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {presences.map((presence) => (
              <Card key={presence.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {presence.profiles?.display_name || "Anonymous Player"}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatArrivalTime(presence.arrived_at)}</span>
                      {presence.profiles?.dupr_rating && (
                        <>
                          <span>•</span>
                          <span>
                            {presence.profiles.dupr_rating.toFixed(2)} DUPR
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ParkDetail;
