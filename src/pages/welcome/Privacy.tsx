import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Users, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const Privacy = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [nameVisibility, setNameVisibility] = useState<"everyone" | "friends" | "none">("friends");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const handleLocationStep = () => {
    if (locationPermission === null) {
      toast.error("Please select a location permission option");
      return;
    }
    setStep(2);
  };

  const handleContinue = async () => {
    if (!userId) return;

    try {
      // Create privacy settings
      const { error: privacyError } = await supabase
        .from("privacy_settings")
        .upsert({
          user_id: userId,
          mode: "standard",
          share_skill_level: true,
          share_arrival_time: true,
          share_name: nameVisibility === "everyone",
          do_not_share_at_all: false,
        }, { onConflict: 'user_id' });

      if (privacyError) throw privacyError;

      // Update welcome progress
      const { error: progressError } = await supabase
        .from("welcome_progress")
        .upsert({
          user_id: userId,
          completed_privacy: true,
          current_step: "ready",
        }, { onConflict: 'user_id' });

      if (progressError) throw progressError;

      navigate("/welcome/ready");
    } catch (error) {
      console.error("Error saving privacy:", error);
      toast.error("Failed to save settings");
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h1 className="text-3xl font-headline mb-2">location permission</h1>
            <p className="text-muted-foreground">
              Pickleheart needs your location to be most useful for the community. Pickleheart only cares about your location when you are at the park.
            </p>
          </div>

          <div className="space-y-3 mb-8">
            <Card
              className={`p-4 cursor-pointer transition-all ${
                locationPermission === true
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setLocationPermission(true)}
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-1 text-primary" />
                <div>
                  <h3 className="font-semibold mb-1">Allow location access</h3>
                  <p className="text-sm text-muted-foreground">
                    Help the community by sharing your location at parks
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={`p-4 cursor-pointer transition-all ${
                locationPermission === false
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setLocationPermission(false)}
            >
              <div className="flex items-start gap-3">
                <EyeOff className="w-5 h-5 mt-1 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold mb-1">Don't allow location</h3>
                  <p className="text-sm text-muted-foreground">
                    Limited features available without location
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Button onClick={handleLocationStep} className="w-full" size="lg">
            continue
          </Button>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              step 6 of 7 (part 1 of 2)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Users className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">name visibility</h1>
          <p className="text-muted-foreground">
            When you're at the park, who can see your name?
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <Card
            className={`p-4 cursor-pointer transition-all ${
              nameVisibility === "everyone"
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => setNameVisibility("everyone")}
          >
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 mt-1 text-primary" />
              <div>
                <h3 className="font-semibold mb-1">Everyone can see it</h3>
                <p className="text-sm text-muted-foreground">
                  All players at the park can see your name
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer transition-all ${
              nameVisibility === "friends"
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => setNameVisibility("friends")}
          >
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 mt-1 text-primary" />
              <div>
                <h3 className="font-semibold mb-1">Only friends can see it</h3>
                <p className="text-sm text-muted-foreground">
                  Your name is visible only to your friends
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer transition-all ${
              nameVisibility === "none"
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => setNameVisibility("none")}
          >
            <div className="flex items-start gap-3">
              <EyeOff className="w-5 h-5 mt-1 text-muted-foreground" />
              <div>
                <h3 className="font-semibold mb-1">No one can see it</h3>
                <p className="text-sm text-muted-foreground">
                  Your name stays private from everyone
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Button onClick={handleContinue} className="w-full" size="lg">
          continue
        </Button>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            step 6 of 7 (part 2 of 2) • you can change this anytime
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
