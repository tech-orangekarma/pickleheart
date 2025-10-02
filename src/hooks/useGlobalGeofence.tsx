import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
  location: any;
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
        // Get all parks
        const { data: parks, error: parksError } = await supabase
          .from("parks")
          .select("id, name, location");

        if (parksError) throw parksError;

        // Check if already checked in anywhere
        const { data: existingPresence } = await supabase
          .from("presence")
          .select("id, park_id")
          .eq("user_id", userId)
          .is("checked_out_at", null)
          .single();

        for (const park of parks || []) {
          const parkLng = (park.location as any)?.coordinates?.[0];
          const parkLat = (park.location as any)?.coordinates?.[1];
          if (!parkLng || !parkLat) continue;
          const distance = calculateDistance(lat, lng, parkLat, parkLng);

          if (distance <= 150) {
            // Within geofence
            if (existingPresence?.park_id === park.id) {
              // Already checked in at this park
              return;
            }

            if (existingPresence && existingPresence.park_id !== park.id) {
              // Checked in at different park, check out first
              await supabase
                .from("presence")
                .update({ checked_out_at: new Date().toISOString() })
                .eq("id", existingPresence.id);
            }

            // Prevent duplicate check-ins
            if (lastCheckInAttempt.current === park.id) return;

            lastCheckInAttempt.current = park.id;
            checkInCooldown.current = Date.now();

            // Auto check-in
            const { error: insertError } = await supabase
              .from("presence")
              .insert({
                user_id: userId,
                park_id: park.id,
                auto_checked_in: true,
              });

            if (!insertError) {
              toast.success(`Auto-checked in to ${park.name}`);
            }

            return;
          }
        }

        // Not within any geofence - check out if checked in
        if (existingPresence) {
          await supabase
            .from("presence")
            .update({ checked_out_at: new Date().toISOString() })
            .eq("id", existingPresence.id);
          
          lastCheckInAttempt.current = null;
          toast.info("Auto-checked out");
        }
      } catch (error) {
        console.error("Error checking nearby parks:", error);
      }
    };

    // Start watching location
    const id = navigator.geolocation.watchPosition(
      (position) => {
        checkNearbyParks(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
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
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [userId, locationEnabled]);

  return { locationEnabled };
};
