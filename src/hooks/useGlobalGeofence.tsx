import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
}

export const useGlobalGeofence = () => {
  const [watchId, setWatchId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const lastCheckInAttempt = useRef<string | null>(null);
  const checkInCooldown = useRef<number>(0);

  useEffect(() => {
    // Get user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    // Check privacy settings
    const checkPrivacySettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("privacy_settings")
        .select("location_permission_granted")
        .eq("user_id", session.user.id)
        .single();

      setLocationEnabled(data?.location_permission_granted || false);
    };

    checkPrivacySettings();
  }, []);

  useEffect(() => {
    if (!userId || !locationEnabled) return;

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3; // Earth's radius in meters
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

    const checkNearbyParks = async (lat: number, lng: number) => {
      // Cooldown check
      if (Date.now() - checkInCooldown.current < 30000) return;

      try {
        console.log("[Geofence] Checking nearby parks", { 
          userId, 
          currentLocation: { lat, lng },
          timestamp: new Date().toISOString()
        });

        // Get all parks
      const { data: parks, error: parksError } = await supabase
        .rpc("get_parks_with_coordinates");

        if (parksError) {
          console.error("[Geofence] Error fetching parks:", parksError);
          throw parksError;
        }

        console.log("[Geofence] Parks fetched:", parks?.length || 0);

        // Check if already checked in anywhere (FIXED: using maybeSingle instead of single)
        const { data: existingPresence, error: presenceError } = await supabase
          .from("presence")
          .select("id, park_id")
          .eq("user_id", userId)
          .is("checked_out_at", null)
          .maybeSingle();

        if (presenceError) {
          console.error("[Geofence] Error checking existing presence:", presenceError);
        }

        console.log("[Geofence] Existing presence:", existingPresence ? `Checked in at park ${existingPresence.park_id}` : "None");

        for (const park of parks || []) {
        const parkLng = park.longitude;
        const parkLat = park.latitude;
          if (!parkLng || !parkLat) {
            console.warn("[Geofence] Park missing coordinates:", park.name);
            continue;
          }
          const distance = calculateDistance(lat, lng, parkLat, parkLng);
          
          console.log(`[Geofence] Distance to ${park.name}:`, Math.round(distance), "m");

          if (distance <= 150) {
            // Within geofence
            console.log(`[Geofence] ✓ Within geofence of ${park.name} (${Math.round(distance)}m)`);
            
            if (existingPresence?.park_id === park.id) {
              // Already checked in at this park
              console.log("[Geofence] Already checked in at this park");
              return;
            }

            if (existingPresence && existingPresence.park_id !== park.id) {
              // Checked in at different park, check out first
              console.log(`[Geofence] Checking out from previous park: ${existingPresence.park_id}`);
              const { error: checkoutError } = await supabase
                .from("presence")
                .update({ checked_out_at: new Date().toISOString() })
                .eq("id", existingPresence.id);
              
              if (checkoutError) {
                console.error("[Geofence] Error checking out from previous park:", checkoutError);
              }
            }

            // Prevent duplicate check-ins
            if (lastCheckInAttempt.current === park.id) {
              console.log("[Geofence] Duplicate check-in prevented for:", park.name);
              return;
            }

            lastCheckInAttempt.current = park.id;
            checkInCooldown.current = Date.now();

            console.log(`[Geofence] Attempting auto check-in to ${park.name}...`);
            
            // Auto check-in
            const { error: insertError } = await supabase
              .from("presence")
              .insert({
                user_id: userId,
                park_id: park.id,
                auto_checked_in: true,
              });

            if (insertError) {
              console.error("[Geofence] Error during check-in:", insertError);
              toast.error(`Failed to check in to ${park.name}: ${insertError.message}`);
            } else {
              console.log(`[Geofence] ✓ Successfully checked in to ${park.name}`);
              toast.success(`Auto-checked in to ${park.name}`);
            }

            return;
          }
        }

        // Not within any geofence - check out if checked in
        console.log("[Geofence] Not within any park geofence (150m)");
        
        if (existingPresence) {
          console.log(`[Geofence] Auto checking out from park: ${existingPresence.park_id}`);
          
          const { error: checkoutError } = await supabase
            .from("presence")
            .update({ checked_out_at: new Date().toISOString() })
            .eq("id", existingPresence.id);
          
          if (checkoutError) {
            console.error("[Geofence] Error during auto checkout:", checkoutError);
          } else {
            console.log("[Geofence] ✓ Auto-checked out successfully");
            lastCheckInAttempt.current = null;
            toast.info("Auto-checked out");
          }
        }
      } catch (error) {
        console.error("[Geofence] Error checking nearby parks:", error);
        toast.error("Location tracking error - please try manual check-in");
      }
    };

    console.log("[Geofence] Starting location watch for user:", userId);
    
    // Start watching location
    const id = navigator.geolocation.watchPosition(
      (position) => {
        console.log("[Geofence] Location update received:", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        });
        checkNearbyParks(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error("[Geofence] Geolocation error:", {
          code: error.code,
          message: error.message,
          details: error.code === 1 ? "PERMISSION_DENIED" : 
                   error.code === 2 ? "POSITION_UNAVAILABLE" : 
                   error.code === 3 ? "TIMEOUT" : "UNKNOWN"
        });
        
        const errorMessages = {
          1: "Location permission denied. Please enable location access in your browser settings.",
          2: "Unable to determine your location. Please check your GPS/network connection.",
          3: "Location request timed out. Please try again."
        };
        
        toast.error(errorMessages[error.code as 1 | 2 | 3] || "Location tracking error");
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 10000,
      }
    );

    setWatchId(id);

    return () => {
      if (id) {
        console.log("[Geofence] Stopping location watch");
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [userId, locationEnabled]);

  return { locationEnabled };
};
