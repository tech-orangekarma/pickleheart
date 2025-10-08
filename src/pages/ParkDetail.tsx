import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Users, Loader2, ListOrdered, Filter } from "lucide-react";
import { toast } from "sonner";
import { StackReportDialog } from "@/components/StackReportDialog";
import { SkillFilterDialog } from "@/components/SkillFilterDialog";
import { formatDuprRating } from "@/lib/utils";

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
  const [hasAttemptedAutoCheckIn, setHasAttemptedAutoCheckIn] = useState<boolean>(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [showSkillFilter, setShowSkillFilter] = useState(false);
  const [skillRange, setSkillRange] = useState<[number, number]>([2.0, 8.0]);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date>(new Date());
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [isManualAction, setIsManualAction] = useState(false);

  useEffect(() => {
    if (!parkId) {
      navigate("/");
      return;
    }

    // Get current user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
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

        // Check location permission
        const { data: privacyData } = await supabase
          .from("privacy_settings")
          .select("location_permission_granted")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setLocationPermissionGranted(privacyData?.location_permission_granted ?? null);
      }
    });

    loadParkData();
  }, [parkId, navigate, skillRange]);

  // Start location tracking (only if permission granted)
  useEffect(() => {
    if (!userId || !park || locationPermissionGranted !== true) return;

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
        setLastLocationUpdate(new Date());

        // Check if within 150m geofence
        if (distance <= 150) {
          handleInGeofence();
        } else {
          handleOutOfGeofence();
        }
      },
      (error) => {
        console.error("[ParkDetail] Geolocation error:", {
          code: error.code,
          message: error.message,
          details: error.code === 1 ? "PERMISSION_DENIED" : 
                   error.code === 2 ? "POSITION_UNAVAILABLE" : 
                   error.code === 3 ? "TIMEOUT" : "UNKNOWN",
          parkId,
          userId
        });
        
        const errorMessages = {
          1: "Location permission denied. Please enable location access.",
          2: "Unable to determine location. Check GPS/network connection.",
          3: "Location request timed out."
        };
        
        toast.error(errorMessages[error.code as 1 | 2 | 3] || "Unable to get your location");
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
  }, [userId, park, locationPermissionGranted]);

  // Reset auto check-in flag when user manually checks out
  useEffect(() => {
    if (!userPresenceId) {
      setHasAttemptedAutoCheckIn(false);
    }
  }, [userPresenceId]);

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
    // Auto check-in immediately if not already checked in and haven't attempted auto check-in yet
    if (!userPresenceId && !hasAttemptedAutoCheckIn) {
      setHasAttemptedAutoCheckIn(true);
      performCheckIn(false);
    }
  };

  const handleOutOfGeofence = () => {
    const timeSinceLastUpdate = new Date().getTime() - lastLocationUpdate.getTime();
    const minutesAway = timeSinceLastUpdate / 1000 / 60;

    // Auto checkout after 10 minutes away
    if (userPresenceId && minutesAway >= 10) {
      performCheckOut(false);
    }
  };

  const performCheckOut = async (isManual = false) => {
    if (!userPresenceId) return;

    console.log("[ParkDetail] Check-out initiated", {
      isManual,
      userPresenceId,
      parkId,
      distance: distanceTopark,
      timestamp: new Date().toISOString()
    });

    setIsManualAction(true);
    try {
      const { error } = await supabase
        .from("presence")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", userPresenceId);

      if (error) {
        console.error("[ParkDetail] Check-out failed:", {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log("[ParkDetail] ✓ Check-out successful");
      setUserPresenceId(null);
      toast.success(isManual ? "Checked out from park" : "Auto-checked out from park");
      loadParkData();
    } catch (error: any) {
      console.error("[ParkDetail] Check-out error:", error);
      toast.error(`Failed to check out: ${error.message || "Unknown error"}`);
    } finally {
      setIsManualAction(false);
    }
  };

  const performCheckIn = async (isManual = false) => {
    if (!userId || !parkId) return;

    console.log("[ParkDetail] Check-in initiated", {
      isManual,
      userId,
      parkId,
      parkName: park?.name,
      distance: distanceTopark,
      locationPermissionGranted,
      timestamp: new Date().toISOString()
    });

    setIsManualAction(true);
    try {
      const { data, error } = await supabase
        .from("presence")
        .insert({
          user_id: userId,
          park_id: parkId,
          auto_checked_in: !isManual,
        })
        .select()
        .single();

      if (error) {
        console.error("[ParkDetail] Check-in failed:", {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log("[ParkDetail] ✓ Check-in successful", {
        presenceId: data.id,
        auto_checked_in: data.auto_checked_in
      });
      
      setUserPresenceId(data.id);
      toast.success(isManual ? "Checked in to park" : "Auto-checked in to park");
      loadParkData(); // Refresh the list
    } catch (error: any) {
      console.error("[ParkDetail] Check-in error:", error);
      toast.error(`Failed to check in: ${error.message || "Unknown error"}`);
    } finally {
      setIsManualAction(false);
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

      // Apply skill filter
      let filteredPresences = presenceData || [];
      if (skillRange[0] > 2.0 || skillRange[1] < 8.0) {
        filteredPresences = filteredPresences.filter((p) => {
          const rating = p.profiles?.dupr_rating;
          if (!rating) return false;
          return rating >= skillRange[0] && rating <= skillRange[1];
        });
      }

      setPresences(filteredPresences);
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

              {/* Manual check-in/out buttons */}
              <div className="mt-4 flex gap-2">
                {userPresenceId ? (
                  <Button
                    onClick={() => performCheckOut(true)}
                    variant="outline"
                    size="sm"
                    disabled={isManualAction}
                  >
                    {isManualAction ? "Checking out..." : "Check Out"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => performCheckIn(true)}
                    size="sm"
                    disabled={isManualAction}
                  >
                    {isManualAction ? "Checking in..." : "Check In"}
                  </Button>
                )}
              </div>

              {/* Location permission warning */}
              {locationPermissionGranted === false && (
                <Card className="mt-3 p-3 bg-muted/50 border-muted">
                  <p className="text-xs text-muted-foreground">
                    📍 Enable location in Profile settings to see distance and use auto check-in
                  </p>
                </Card>
              )}
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
                  {distanceTopark <= 150 ? "You're at the park!" : `${Math.round(distanceTopark)}m away`}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-headline mb-1">who's here now</h2>
            <p className="text-sm text-muted-foreground">
              {presences.length} {presences.length === 1 ? "player" : "players"}
              {(skillRange[0] > 2.0 || skillRange[1] < 8.0) && " (filtered)"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSkillFilter(true)}
            >
              <Filter className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowStackDialog(true)}
              disabled={!isTracking || (distanceTopark !== null && distanceTopark > 150)}
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              stacks
            </Button>
          </div>
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
                            {formatDuprRating(presence.profiles.dupr_rating)} DUPR
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

      <StackReportDialog
        parkId={parkId!}
        isOpen={showStackDialog}
        onClose={() => setShowStackDialog(false)}
        onReported={() => {
          toast.success("Stack count updated!");
        }}
        isInGeofence={distanceTopark !== null && distanceTopark <= 150}
      />

      <SkillFilterDialog
        isOpen={showSkillFilter}
        onClose={() => setShowSkillFilter(false)}
        onApply={(range) => {
          setSkillRange(range);
          toast.success("Filter applied");
        }}
        currentRange={skillRange}
        parkId={parkId!}
      />
    </div>
  );
};

export default ParkDetail;
