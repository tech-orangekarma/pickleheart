import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FriendFinderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FriendFinderMode = "everyone" | "auto_friends" | "auto_requests" | "receive_all" | "manual";

export function FriendFinderDialog({ open, onOpenChange }: FriendFinderDialogProps) {
  const [mode, setMode] = useState<FriendFinderMode>("receive_all");
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 100]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
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
          // Parse gender_filter from comma-separated string to array
          const genders = data.gender_filter === 'all' ? [] : data.gender_filter.split(',').filter(Boolean);
          setGenderFilter(genders);
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
        gender_filter: genderFilter.length === 0 ? 'all' : genderFilter.join(','),
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
                      Auto-Friend (Everyone)
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
                      Auto-Friend (Range)
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
                      Auto-Request (Range)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send/receive friend requests from people in your range
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                  <RadioGroupItem value="receive_all" id="receive_all" />
                  <div className="space-y-1">
                    <Label htmlFor="receive_all" className="cursor-pointer font-medium">
                      Receive All
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive friend requests from all users
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                  <RadioGroupItem value="manual" id="manual" />
                  <div className="space-y-1">
                    <Label htmlFor="manual" className="cursor-pointer font-medium">
                      Closed
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Don't send or receive requests from anyone
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {(mode === "auto_friends" || mode === "auto_requests") && (
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        <span>
                          {genderFilter.length === 0
                            ? "All Genders"
                            : genderFilter.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(", ")}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-3 bg-background border border-border z-50">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                          <Checkbox
                            id="all-genders"
                            checked={genderFilter.length === 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setGenderFilter([]);
                              }
                            }}
                          />
                          <Label htmlFor="all-genders" className="cursor-pointer flex-1">
                            All Genders
                          </Label>
                        </div>
                        {['male', 'female', 'non-binary'].map((gender) => (
                          <div key={gender} className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                            <Checkbox
                              id={gender}
                              checked={genderFilter.includes(gender)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setGenderFilter([...genderFilter, gender]);
                                } else {
                                  setGenderFilter(genderFilter.filter(g => g !== gender));
                                }
                              }}
                            />
                            <Label htmlFor={gender} className="cursor-pointer flex-1 capitalize">
                              {gender}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
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
                {loading ? "Saving..." : 
                  (mode === "everyone" || mode === "auto_friends" || mode === "auto_requests") 
                    ? "Save settings and send requests" 
                    : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}