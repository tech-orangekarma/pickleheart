import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, MapPin, CheckCircle, XCircle, Clock, Wifi } from "lucide-react";

interface Park {
  id: string;
  name: string;
  location: any;
}

interface DebugEvent {
  timestamp: Date;
  type: "success" | "error" | "info";
  message: string;
}

export const GeofenceDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [parks, setParks] = useState<Park[]>([]);
  const [activePresence, setActivePresence] = useState<any>(null);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Get user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    // Load parks
    supabase
      .from("parks")
      .select("id, name, location")
      .then(({ data }) => setParks(data || []));

    // Setup location watch
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLastUpdate(new Date());
        addEvent("info", "Location updated");
      },
      (error) => {
        addEvent("error", `Geolocation error: ${error.message}`);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOpen]);

  useEffect(() => {
    if (!userId || !isOpen) return;

    // Check privacy settings
    supabase
      .from("privacy_settings")
      .select("location_permission_granted")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setLocationEnabled(data?.location_permission_granted || false));

    // Load active presence
    const loadPresence = () => {
      supabase
        .from("presence")
        .select("*, parks(name)")
        .eq("user_id", userId)
        .is("checked_out_at", null)
        .maybeSingle()
        .then(({ data }) => setActivePresence(data));
    };

    loadPresence();
    const interval = setInterval(loadPresence, 5000);

    return () => clearInterval(interval);
  }, [userId, isOpen]);

  const addEvent = (type: "success" | "error" | "info", message: string) => {
    setEvents((prev) => [{ timestamp: new Date(), type, message }, ...prev].slice(0, 10));
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const exportLogs = () => {
    const data = {
      timestamp: new Date().toISOString(),
      userId,
      locationEnabled,
      currentLocation,
      activePresence,
      events,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geofence-debug-${Date.now()}.json`;
    a.click();
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        🔍 Debug
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4">
        <Card className="max-w-2xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-headline">Geofence Debug Panel</h2>
            <Button onClick={() => setIsOpen(false)} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Status Section */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2">
              {locationEnabled ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm">
                Location Permission: {locationEnabled ? "Granted" : "Denied"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {currentLocation ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm">
                Geolocation Active: {currentLocation ? "Yes" : "No"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">
                User ID: {userId ? userId.substring(0, 8) : "Not logged in"}
              </span>
            </div>

            {lastUpdate && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">
                  Last Update: {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {/* Current Location */}
          {currentLocation && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Current Coordinates</h3>
              <div className="bg-muted p-3 rounded text-xs font-mono">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </div>
            </div>
          )}

          {/* Park Distances */}
          {currentLocation && parks.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Distance to Parks</h3>
              <div className="space-y-2">
                {parks
                  .map((park) => {
                    const parkLat = park.location?.coordinates?.[1];
                    const parkLng = park.location?.coordinates?.[0];
                    if (!parkLat || !parkLng) return null;
                    const distance = calculateDistance(
                      currentLocation.lat,
                      currentLocation.lng,
                      parkLat,
                      parkLng
                    );
                    return { ...park, distance };
                  })
                  .filter(Boolean)
                  .sort((a: any, b: any) => a.distance - b.distance)
                  .map((park: any) => (
                    <div key={park.id} className="flex items-center justify-between bg-muted p-2 rounded">
                      <span className="text-sm">{park.name}</span>
                      <span
                        className={`text-sm font-mono ${
                          park.distance <= 150 ? "text-green-500 font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {Math.round(park.distance)}m {park.distance <= 150 ? "✓" : ""}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Active Check-in */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Active Check-in</h3>
            {activePresence ? (
              <div className="bg-green-500/10 border border-green-500/20 p-3 rounded">
                <p className="text-sm font-medium">{(activePresence as any).parks?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Since: {new Date(activePresence.arrived_at).toLocaleTimeString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Auto: {activePresence.auto_checked_in ? "Yes" : "No"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not checked in</p>
            )}
          </div>

          {/* Event Log */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Event Log</h3>
            <div className="bg-muted p-3 rounded max-h-48 overflow-y-auto space-y-1">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events yet</p>
              ) : (
                events.map((event, i) => (
                  <div key={i} className="text-xs font-mono">
                    <span className="text-muted-foreground">
                      [{event.timestamp.toLocaleTimeString()}]
                    </span>{" "}
                    <span
                      className={
                        event.type === "success"
                          ? "text-green-500"
                          : event.type === "error"
                          ? "text-red-500"
                          : "text-blue-500"
                      }
                    >
                      {event.type.toUpperCase()}
                    </span>
                    : {event.message}
                  </div>
                ))
              )}
            </div>
          </div>

          <Button onClick={exportLogs} variant="outline" className="w-full">
            Export Logs
          </Button>
        </Card>
      </div>
    </div>
  );
};
