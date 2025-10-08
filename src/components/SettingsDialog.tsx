import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Navigation, Bell, Lock } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PrivacySettings {
  share_name_with: 'everyone' | 'friends' | 'no_one';
  share_photo_with: 'everyone' | 'friends' | 'no_one';
  do_not_share_at_all: boolean;
  location_permission_granted: boolean | null;
}

export const SettingsDialog = ({ isOpen, onClose }: SettingsDialogProps) => {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    share_name_with: 'everyone',
    share_photo_with: 'everyone',
    do_not_share_at_all: false,
    location_permission_granted: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("privacy_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPrivacySettings({
          share_name_with: data.share_name_with || 'everyone',
          share_photo_with: data.share_photo_with || 'everyone',
          do_not_share_at_all: data.do_not_share_at_all,
          location_permission_granted: data.location_permission_granted,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    }
  };

  const updateSetting = async (key: keyof PrivacySettings, value: any) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // If enabling location, request browser permission first
      if (key === "location_permission_granted" && value === true) {
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              (error) => reject(error),
              { timeout: 10000 }
            );
          });
        } catch (error) {
          toast.error("Location permission denied by browser");
          return;
        }
      }

      const { error } = await supabase
        .from("privacy_settings")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      setPrivacySettings((prev) => ({ ...prev, [key]: value }));
      toast.success("Setting updated");
    } catch (error) {
      console.error("Error updating setting:", error);
      toast.error("Failed to update setting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your privacy, location, and notification preferences
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Privacy Settings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Privacy Settings</h3>
              </div>
              <div className="space-y-4 ml-7">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Share Name</label>
                  <Select
                    value={privacySettings.share_name_with}
                    onValueChange={(value: 'everyone' | 'friends' | 'no_one') => updateSetting("share_name_with", value)}
                    disabled={loading || privacySettings.do_not_share_at_all}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border z-50">
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="friends">Friends Only</SelectItem>
                      <SelectItem value="no_one">No One</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Who can see your display name
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Share Photo</label>
                  <Select
                    value={privacySettings.share_photo_with}
                    onValueChange={(value: 'everyone' | 'friends' | 'no_one') => updateSetting("share_photo_with", value)}
                    disabled={loading || privacySettings.do_not_share_at_all}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border z-50">
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="friends">Friends Only</SelectItem>
                      <SelectItem value="no_one">No One</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Who can see your profile photo
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="font-medium text-sm">Private Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Hide all your information from others
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.do_not_share_at_all}
                    onCheckedChange={(value) => updateSetting("do_not_share_at_all", value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Location Settings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Location Settings</h3>
              </div>
              <div className="space-y-4 ml-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Location Services</p>
                    <p className="text-xs text-muted-foreground">
                      Enable auto check-in and distance tracking
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.location_permission_granted === true}
                    onCheckedChange={(value) => updateSetting("location_permission_granted", value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Notification Settings</h3>
              </div>
              <div className="space-y-4 ml-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Friend Requests</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when someone sends you a friend request
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled={true}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Park Activity</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when friends arrive at your home park
                    </p>
                  </div>
                  <Switch
                    checked={false}
                    disabled={true}
                  />
                </div>

                <p className="text-xs text-muted-foreground italic">
                  More notification options coming soon
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};