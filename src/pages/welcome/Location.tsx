import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
  address: string;
}

const Location = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedPark, setSelectedPark] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setUserId(session.user.id);
    });

    loadParks();
  }, [navigate]);

  const loadParks = async () => {
    const { data, error } = await supabase
      .from("parks")
      .select("id, name, address")
      .order("name");

    if (error) {
      console.error("Error loading parks:", error);
      return;
    }

    setParks(data || []);
  };

  const handleContinue = async () => {
    if (!userId) return;

    try {
      if (selectedPark) {
        await supabase
          .from("profiles")
          .update({ home_park_id: selectedPark })
          .eq("id", userId);
      }

      await supabase.from("welcome_progress").upsert({
        user_id: userId,
        completed_location: true,
        current_step: "privacy",
      });

      navigate("/welcome/privacy");
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    }
  };

  const handleSkip = async () => {
    if (!userId) return;

    await supabase.from("welcome_progress").upsert({
      user_id: userId,
      completed_location: true,
      current_step: "privacy",
    });

    navigate("/welcome/privacy");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">where do you play?</h1>
          <p className="text-muted-foreground">
            Choose your home park (you can change this later)
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {parks.map((park) => (
            <Card
              key={park.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedPark === park.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedPark(park.id)}
            >
              <h3 className="font-semibold mb-1">{park.name}</h3>
              <p className="text-sm text-muted-foreground">{park.address}</p>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleContinue} 
            className="w-full" 
            size="lg"
            disabled={!selectedPark}
          >
            continue
          </Button>

          <Button onClick={handleSkip} variant="ghost" className="w-full">
            skip for now
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/level")}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          step 5 of 7
        </p>
      </div>
    </div>
  );
};

export default Location;
