import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
  address: string;
  court_count: number;
  location: any; // PostGIS geography type
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceTopark, setDistanceToPark] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPresenceId, setUserPresenceId] = useState<string | null>(null);
  const [checkInTimer, setCheckInTimer] = useState<number>(0);

  useEffect(() => {
    if (!parkId) {
      navigate("/");
      return;
    }

    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
      }
    });

    loadParkData();
  }, [parkId, navigate]);

  // Start location tracking
  useEffect(() => {
    if (!userId || !park) return;

    setIsTracking(true);

    // Get user's current location
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserLocation({ lat: userLat, lng: userLng });

        // Calculate distance to park (simple Haversine formula)
        const distance = calculateDistance(
          userLat,
          userLng,
          park.location.coordinates[1],
          park.location.coordinates[0]
        );
        setDistanceToPark(distance);

        // Check if within 150m geofence
        if (distance <= 150) {
          handleInGeofence();
        } else {
          handleOutOfGeofence();
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Unable to get your location. Please enable location services.");
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [userId, park]);

  // Auto check-in after 5 minutes in geofence
  useEffect(() => {
    if (checkInTimer >= 5 * 60 && !userPresenceId) {
      performCheckIn();
    }
  }, [checkInTimer, userPresenceId]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleInGeofence = () => {
    // Start counting time in geofence
    const timer = setInterval(() => {
      setCheckInTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  };

  const handleOutOfGeofence = () => {
    setCheckInTimer(0);
    
    // If user was checked in and has been away for 10 minutes, check them out
    if (userPresenceId) {
      // This would need a more sophisticated timer for the 10-minute checkout
      // For MVP, we'll implement this in a future iteration
    }
  };

  const performCheckIn = async () => {
    if (!userId || !parkId) return;

    try {
      const { data, error } = await supabase
        .from("presence")
        .insert({
          user_id: userId,
          park_id: parkId,
          auto_checked_in: true,
        })
        .select()
        .single();

      if (error) throw error;

      setUserPresenceId(data.id);
      toast.success("You've been checked in!");
      loadParkData(); // Refresh the list
    } catch (error) {
      console.error("Error checking in:", error);
    }
  };

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
        {isTracking && distanceTopark !== null && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {distanceTopark <= 150 ? (
                    <>
                      You're at the park! 
                      {checkInTimer > 0 && checkInTimer < 300 && (
                        <span className="ml-2 text-muted-foreground">
                          Auto check-in in {Math.ceil((300 - checkInTimer) / 60)}m
                        </span>
                      )}
                    </>
                  ) : (
                    `${Math.round(distanceTopark)}m away`
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-headline mb-1">who's here now</h2>
          <p className="text-sm text-muted-foreground">
            {presences.length} {presences.length === 1 ? "player" : "players"}
          </p>
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
