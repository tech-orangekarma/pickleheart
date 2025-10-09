import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Park {
  id: string;
  name: string;
  address: string;
}

const Location = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParks, setSelectedParks] = useState<string[]>([]);
  const [favoritePark, setFavoritePark] = useState<string | null>(null);
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [suggestedParkName, setSuggestedParkName] = useState("");

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

  const toggleParkSelection = (parkId: string) => {
    setSelectedParks(prev => 
      prev.includes(parkId) 
        ? prev.filter(id => id !== parkId)
        : [...prev, parkId]
    );
  };

  const toggleFavorite = (parkId: string) => {
    setFavoritePark(prev => prev === parkId ? null : parkId);
  };

  const handleContinue = async () => {
    if (!userId) return;

    try {
      if (favoritePark) {
        await supabase
          .from("profiles")
          .update({ home_park_id: favoritePark })
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

  const handleSuggestPark = async () => {
    if (!userId || !suggestedParkName.trim()) return;

    try {
      const { error } = await supabase
        .from("park_suggestions")
        .insert({
          user_id: userId,
          park_name: suggestedParkName.trim(),
        });

      if (error) throw error;

      toast.success("Park suggestion submitted!");
      setShowSuggestDialog(false);
      setSuggestedParkName("");
    } catch (error) {
      console.error("Error submitting suggestion:", error);
      toast.error("Failed to submit suggestion");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">where do you play?</h1>
          <p className="text-muted-foreground">
            Select parks you play at and favorite your home park
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {parks.map((park) => {
            const isSelected = selectedParks.includes(park.id);
            const isFavorite = favoritePark === park.id;
            
            return (
              <div
                key={park.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "border-[hsl(var(--light-butter))] bg-[hsl(var(--light-butter))]"
                    : "border-border bg-background hover:border-primary/50"
                }`}
                onClick={() => toggleParkSelection(park.id)}
              >
                <div className="flex items-center justify-center">
                  <h3 className="font-semibold text-center">{park.name}</h3>
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(park.id);
                      }}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          isFavorite
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={() => setShowSuggestDialog(true)}
          className="w-full mb-6"
        >
          suggest a new park
        </Button>

        <div className="space-y-3">
          <Button 
            onClick={handleContinue} 
            className="w-full" 
            size="lg"
            disabled={!favoritePark}
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
          step 5 of 8
        </p>
      </div>

      <Dialog open={showSuggestDialog} onOpenChange={setShowSuggestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest a New Park</DialogTitle>
            <DialogDescription>
              Enter the name of a park you'd like to see added
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="park-name">Park Name</Label>
              <Input
                id="park-name"
                placeholder="Enter park name"
                value={suggestedParkName}
                onChange={(e) => setSuggestedParkName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSuggestDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSuggestPark}
              disabled={!suggestedParkName.trim()}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Location;
