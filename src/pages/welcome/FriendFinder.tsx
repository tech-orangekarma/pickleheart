import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";

type FriendFinderMode = "everyone" | "auto_friends" | "auto_requests" | "receive_all" | "manual";

const FriendFinder = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<FriendFinderMode>("receive_all");
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 100]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
  const [ratingRange, setRatingRange] = useState<[number, number]>([2.0, 5.0]);
  const [loading, setLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      
      // Load pending friend requests
      const { data: requests } = await supabase
        .from("friendships")
        .select(`
          id,
          requester_id,
          created_at,
          profiles!friendships_requester_id_fkey (
            display_name,
            avatar_url,
            dupr_rating
          )
        `)
        .eq("addressee_id", session.user.id)
        .eq("status", "pending");
      
      setPendingRequests(requests || []);
    };

    init();
  }, [navigate]);

  const handleContinue = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Save friend finder settings
      const settings = {
        user_id: userId,
        mode,
        min_age: ageRange[0],
        max_age: ageRange[1],
        gender_filter: genderFilter.length === 0 ? 'all' : genderFilter.join(','),
        min_rating: ratingRange[0],
        max_rating: ratingRange[1],
      };

      const { error: settingsError } = await supabase
        .from("friend_finder_settings")
        .upsert(settings, { onConflict: 'user_id' });

      if (settingsError) throw settingsError;

      // Process friend matches
      await supabase.functions.invoke('process-friend-finder');

      // Mark welcome as complete
      await supabase.from("welcome_progress").update({
        completed_ready: true,
      }).eq("user_id", userId);

      toast.success("Friend settings saved!");
      navigate("/");
    } catch (error) {
      console.error("Error saving friend finder settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Users className="w-16 h-16 text-primary" />
          </div>
          {pendingRequests.length > 0 ? (
            <>
              <h1 className="text-4xl font-headline mb-4">
                {pendingRequests.length} {pendingRequests.length === 1 ? 'person wants' : 'people want'} to be friends with you
              </h1>
              <p className="text-muted-foreground mb-6">
                Choose how you want to proceed
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-headline mb-2">find your people</h1>
              <p className="text-muted-foreground">
                Choose how you want to connect with other players
              </p>
            </>
          )}
        </div>

        <div className="bg-card p-6 rounded-2xl space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">How do you want to connect?</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as FriendFinderMode)}>
              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="everyone" id="everyone" />
                <div className="space-y-1">
                  <Label htmlFor="everyone" className="cursor-pointer font-medium">
                    I want to be friends with everyone
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-Friend (Everyone)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="auto_friends" id="auto_friends" />
                <div className="space-y-1">
                  <Label htmlFor="auto_friends" className="cursor-pointer font-medium">
                    I want to be friends with people in my range
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-Friend (Range)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="auto_requests" id="auto_requests" />
                <div className="space-y-1">
                  <Label htmlFor="auto_requests" className="cursor-pointer font-medium">
                    I want to see friend requests from people in my range
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-Request (Range)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="receive_all" id="receive_all" />
                <div className="space-y-1">
                  <Label htmlFor="receive_all" className="cursor-pointer font-medium">
                    I want to see all requests
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive All
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2 p-3 rounded-lg hover:bg-accent">
                <RadioGroupItem value="manual" id="manual" />
                <div className="space-y-1">
                  <Label htmlFor="manual" className="cursor-pointer font-medium">
                    I don't want to be friends with anyone
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Closed
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {(mode === "auto_friends" || mode === "auto_requests") && (
            <>
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

              <div className="space-y-3">
                <Label className="text-base font-semibold">Gender</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
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
                            if (checked) setGenderFilter([]);
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

              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  DUPR Rating: {ratingRange[0].toFixed(1)} - {ratingRange[1].toFixed(1)}
                </Label>
                <Slider
                  min={2.0}
                  max={5.0}
                  step={0.1}
                  value={ratingRange}
                  onValueChange={(value) => setRatingRange(value as [number, number])}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>

        <Button onClick={handleContinue} size="lg" className="w-full mt-6" disabled={loading}>
          {loading ? "Saving..." : "continue"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/location")}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>
      </div>
    </div>
  );
};

export default FriendFinder;
