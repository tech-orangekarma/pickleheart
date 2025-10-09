import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FriendFinderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FriendFinderMode = "everyone" | "auto_friends" | "auto_requests" | "manual";

export function FriendFinderDialog({ open, onOpenChange }: FriendFinderDialogProps) {
  const [mode, setMode] = useState<FriendFinderMode>("auto_requests");
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 65]);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [ratingRange, setRatingRange] = useState<[number, number]>([2.0, 5.0]);
  const [loading, setLoading] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("friend_finder_settings")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setMode(data.mode as FriendFinderMode);
        if (data.min_age && data.max_age) {
          setAgeRange([data.min_age, data.max_age]);
        }
        if (data.gender_filter) {
          setGenderFilter(data.gender_filter);
        }
        if (data.min_rating && data.max_rating) {
          setRatingRange([data.min_rating, data.max_rating]);
        }
      }
    } catch (error) {
      console.error("Error loading friend finder settings:", error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use Friend Finder");
        return;
      }

      const settings = {
        user_id: session.user.id,
        mode,
        min_age: ageRange[0],
        max_age: ageRange[1],
        gender_filter: genderFilter,
        min_rating: ratingRange[0],
        max_rating: ratingRange[1],
      };

      const { error } = await supabase
        .from("friend_finder_settings")
        .upsert(settings, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Process friend matches
      const { error: matchError } = await supabase.functions.invoke('process-friend-finder');
      
      if (matchError) {
        console.error('Error processing matches:', matchError);
        toast.error("Settings saved but failed to process matches");
        return;
      }

      toast.success("Friend Finder settings saved and matches processed!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving friend finder settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline">Friend Finder Settings</DialogTitle>
        </DialogHeader>

        {isLoadingSettings ? (
          <div className="py-8 text-center text-muted-foreground">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            {/* Mode Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Friend Matching Mode</Label>
              <RadioGroup value={mode} onValueChange={(value) => setMode(value as FriendFinderMode)}>
                <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                  <RadioGroupItem value="everyone" id="everyone" />
                  <div className="space-y-1">
                    <Label htmlFor="everyone" className="cursor-pointer font-medium">
                      Everyone
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically be friends with all users
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                  <RadioGroupItem value="auto_friends" id="auto_friends" />
                  <div className="space-y-1">
                    <Label htmlFor="auto_friends" className="cursor-pointer font-medium">
                      Auto-Accept in Range
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically be friends with people matching your filters
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                  <RadioGroupItem value="auto_requests" id="auto_requests" />
                  <div className="space-y-1">
                    <Label htmlFor="auto_requests" className="cursor-pointer font-medium">
                      Auto-Send Requests
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send/receive friend requests from people in your range
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                  <RadioGroupItem value="manual" id="manual" />
                  <div className="space-y-1">
                    <Label htmlFor="manual" className="cursor-pointer font-medium">
                      Manual Only
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Only connect with people you manually select
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {mode !== "manual" && (
              <>
                {/* Age Range */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Age Range: {ageRange[0]} - {ageRange[1]}
                  </Label>
                  <Slider
                    min={18}
                    max={100}
                    step={1}
                    value={ageRange}
                    onValueChange={(value) => setAgeRange(value as [number, number])}
                    className="w-full"
                  />
                </div>

                {/* Gender Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Gender</Label>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non-binary">Non-binary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Rating Range */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    DUPR Rating: {ratingRange[0].toFixed(1)} - {ratingRange[1].toFixed(1)}
                  </Label>
                  <Slider
                    min={1.0}
                    max={5.0}
                    step={0.1}
                    value={ratingRange}
                    onValueChange={(value) => setRatingRange(value as [number, number])}
                    className="w-full"
                  />
                </div>
              </>
            )}

            {/* Save Button */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}