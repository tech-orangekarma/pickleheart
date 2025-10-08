import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SkillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: [number, number]) => void;
  currentRange: [number, number];
  parkId: string;
}

interface PlayerAtPark {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  dupr_rating: number | null;
}

export const SkillFilterDialog = ({
  isOpen,
  onClose,
  onApply,
  currentRange,
  parkId,
}: SkillFilterDialogProps) => {
  const [range, setRange] = useState<[number, number]>(currentRange);
  const [players, setPlayers] = useState<PlayerAtPark[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && parkId) {
      loadPlayers();
    }
  }, [isOpen, parkId, range]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      
      // Get all players currently at this park
      const { data: presenceData, error: presenceError } = await supabase
        .from("presence")
        .select("user_id")
        .eq("park_id", parkId)
        .is("checked_out_at", null);

      if (presenceError) throw presenceError;

      if (!presenceData || presenceData.length === 0) {
        setPlayers([]);
        return;
      }

      const userIds = presenceData.map(p => p.user_id);

      // Get profiles for these users filtered by skill range
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, dupr_rating")
        .in("id", userIds)
        .gte("dupr_rating", range[0])
        .lte("dupr_rating", range[1]);

      if (profilesError) throw profilesError;

      setPlayers(profilesData || []);
    } catch (error) {
      console.error("Error loading players:", error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    onApply(range);
    onClose();
  };

  const handleReset = () => {
    setRange([2.0, 5.0]);
    onApply([2.0, 5.0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="font-headline">filter by skill level</DialogTitle>
          <DialogDescription>
            Show only players within your DUPR rating range
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {range[0].toFixed(2)} - {range[1].toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">DUPR Rating Range</p>
          </div>

          <div className="space-y-2 px-2">
            <Slider
              value={[range[0], range[1]]}
              onValueChange={(vals) => setRange([vals[0], vals[1]])}
              min={2.0}
              max={5.0}
              step={0.25}
              minStepsBetweenThumbs={1}
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground px-2">
            <span>2.0</span>
            <span>5.0+</span>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-3">
            Players at Park ({players.length})
          </h3>
          <ScrollArea className="h-[200px]">
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading players...
              </div>
            ) : players.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No players in this skill range at the park
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={player.avatar_url || undefined} />
                      <AvatarFallback>
                        {player.display_name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {player.display_name || "Anonymous"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        DUPR: {player.dupr_rating?.toFixed(2) || "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            apply filter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
