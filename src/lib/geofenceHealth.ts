import { supabase } from "@/integrations/supabase/client";

export interface GeofenceHealthReport {
  timestamp: string;
  browserLocationSupport: boolean;
  locationPermission: PermissionState | "unknown";
  locationEnabled: boolean;
  userId: string | null;
  privacySettings: {
    location_permission_granted: boolean | null;
  } | null;
  activePresence: {
    park_id: string;
    park_name: string | null;
    arrived_at: string;
    auto_checked_in: boolean;
  } | null;
  issues: string[];
}

export async function checkGeofenceHealth(): Promise<GeofenceHealthReport> {
  const issues: string[] = [];
  const timestamp = new Date().toISOString();

  // Check browser geolocation support
  const browserLocationSupport = "geolocation" in navigator;
  if (!browserLocationSupport) {
    issues.push("Browser does not support geolocation");
  }

  // Check location permission
  let locationPermission: PermissionState | "unknown" = "unknown";
  try {
    const permissionStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    locationPermission = permissionStatus.state;
    if (permissionStatus.state === "denied") {
      issues.push("Location permission denied by browser");
    } else if (permissionStatus.state === "prompt") {
      issues.push("Location permission not yet granted");
    }
  } catch (error) {
    console.warn("Could not query location permission:", error);
  }

  // Get user session
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;
  
  if (!userId) {
    issues.push("User not logged in");
  }

  // Check privacy settings
  let privacySettings = null;
  let locationEnabled = false;
  
  if (userId) {
    const { data, error } = await supabase
      .from("privacy_settings")
      .select("location_permission_granted")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      issues.push(`Error fetching privacy settings: ${error.message}`);
    } else {
      privacySettings = data;
      locationEnabled = data?.location_permission_granted || false;
      
      if (!locationEnabled) {
        issues.push("Location permission not granted in privacy settings");
      }
    }
  }

  // Check active presence
  let activePresence = null;
  
  if (userId) {
    const { data, error } = await supabase
      .from("presence")
      .select("park_id, arrived_at, auto_checked_in, parks(name)")
      .eq("user_id", userId)
      .is("checked_out_at", null)
      .maybeSingle();

    if (error) {
      issues.push(`Error checking active presence: ${error.message}`);
    } else if (data) {
      activePresence = {
        park_id: data.park_id,
        park_name: (data as any).parks?.name || null,
        arrived_at: data.arrived_at,
        auto_checked_in: data.auto_checked_in,
      };
    }
  }

  return {
    timestamp,
    browserLocationSupport,
    locationPermission,
    locationEnabled,
    userId,
    privacySettings,
    activePresence,
    issues,
  };
}

// Helper function to format health report for display
export function formatHealthReport(report: GeofenceHealthReport): string {
  const lines = [
    `=== Geofence Health Check ===`,
    `Time: ${new Date(report.timestamp).toLocaleString()}`,
    ``,
    `Browser Support: ${report.browserLocationSupport ? "✓" : "✗"}`,
    `Browser Permission: ${report.locationPermission}`,
    `App Location Enabled: ${report.locationEnabled ? "✓" : "✗"}`,
    `User ID: ${report.userId ? report.userId.substring(0, 8) + "..." : "Not logged in"}`,
    ``,
    `Active Check-in: ${report.activePresence ? `${report.activePresence.park_name} (${report.activePresence.auto_checked_in ? "Auto" : "Manual"})` : "None"}`,
    ``,
    `Issues (${report.issues.length}):`,
    ...report.issues.map(issue => `  - ${issue}`),
  ];

  return lines.join("\n");
}
