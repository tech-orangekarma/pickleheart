import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Users, Eye, EyeOff, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Privacy = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [nameVisibility, setNameVisibility] = useState<"everyone" | "friends" | "none" | null>(null);
  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const handleLocationSelection = async (allowed: boolean) => {
    if (allowed === false) {
      // Show warning dialog for "don't allow"
      setLocationPermission(false);
      setShowLocationWarning(true);
      return;
    }

    setLocationPermission(allowed);

    // If user wants location, request browser permission
    if (allowed === true) {
      try {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            (error) => reject(error),
            { timeout: 10000 }
          );
        });
        toast.success("Location permission granted");
      } catch (error) {
        toast.error("Location permission denied. You can enable it later in settings.");
        setLocationPermission(false);
      }
    }
    
    // Automatically move to next step
    setStep(2);
  };

  const handleLocationWarningContinue = () => {
    setShowLocationWarning(false);
    setStep(2);
  };

  const handleNameVisibilitySelection = async (visibility: "everyone" | "friends" | "none") => {
    setNameVisibility(visibility);

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
          share_name: visibility === "everyone",
          do_not_share_at_all: false,
          location_permission_granted: locationPermission,
        }, { onConflict: 'user_id' });

      if (privacyError) throw privacyError;

      // Update welcome progress
      const { error: progressError } = await supabase
        .from("welcome_progress")
        .upsert({
          user_id: userId,
          completed_privacy: true,
          current_step: "connect",
        }, { onConflict: 'user_id' });

      if (progressError) throw progressError;

      navigate("/welcome/connect");
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
            <p className="text-muted-foreground mb-4">
              Pickleheart uses your location only to automatically check you in at supported park. Your location is never stored or tracked.
            </p>
            
            <Collapsible open={isMoreInfoOpen} onOpenChange={setIsMoreInfoOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 mx-auto text-sm text-primary hover:underline">
                more info
                {isMoreInfoOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-3">
                  <p>
                    Pickleheart uses your location to make check-ins easy and automatic. Every few minutes, the app simply checks whether you're at one of our supported parks.
                  </p>
                  <p>
                    If you are, we'll mark you as "checked in" so friends can see who's playing. If you're not at a park, your location is immediately ignored.
                  </p>
                  <p>
                    We don't store, track, or share your location data — ever. Location access is only used in the moment to help you connect with your local pickleball community seamlessly and securely.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="space-y-3 mb-8">
            <Card
              className={`p-4 cursor-pointer transition-all border ${
                locationPermission === true
                  ? "border-[hsl(var(--light-butter))] bg-[hsl(var(--light-butter))]"
                  : "border-border bg-background hover:border-primary/50"
              }`}
              onClick={() => handleLocationSelection(true)}
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
              className={`p-4 cursor-pointer transition-all border ${
                locationPermission === false
                  ? "border-[hsl(var(--light-butter))] bg-[hsl(var(--light-butter))]"
                  : "border-border bg-background hover:border-primary/50"
              }`}
              onClick={() => handleLocationSelection(false)}
            >
              <div className="flex items-start gap-3">
                <EyeOff className="w-5 h-5 mt-1 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold mb-1">Don't allow location</h3>
                  <p className="text-sm text-muted-foreground">
                    You'll have to manually check-in to help your community
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/welcome/location")}
            className="mt-4 w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            back
          </Button>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              step 6 of 7 (part 1 of 2) • you can change this anytime
            </p>
          </div>
        </div>

        <AlertDialog open={showLocationWarning} onOpenChange={setShowLocationWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Location Access Disabled</AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-3">
                We get it, privacy matters. Just keep in mind, without location access, Pickleheart won't automatically check you in. So unless you check in, your friends want know you're there. You can update your settings anytime if you change your mind.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleLocationWarningContinue}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Users className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">who can see your name?</h1>
          <p className="text-muted-foreground">
            everyone else will see your skill level, age, and gender, but not know its you
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <div
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              nameVisibility === "everyone"
                ? "border-[hsl(var(--light-butter))] bg-[hsl(var(--light-butter))]"
                : "border-border bg-background hover:border-primary/50"
            }`}
            onClick={() => handleNameVisibilitySelection("everyone")}
          >
            <h3 className="font-semibold text-center">everyone can see it</h3>
          </div>

          <div
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              nameVisibility === "friends"
                ? "border-[hsl(var(--light-butter))] bg-[hsl(var(--light-butter))]"
                : "border-border bg-background hover:border-primary/50"
            }`}
            onClick={() => handleNameVisibilitySelection("friends")}
          >
            <h3 className="font-semibold text-center">only friends can see it</h3>
          </div>

          <div
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              nameVisibility === "none"
                ? "border-[hsl(var(--light-butter))] bg-[hsl(var(--light-butter))]"
                : "border-border bg-background hover:border-primary/50"
            }`}
            onClick={() => handleNameVisibilitySelection("none")}
          >
            <h3 className="font-semibold text-center">no one can see it</h3>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep(1)}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            step 6 of 7 (part 2 of 2) • you can change this anytime
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
