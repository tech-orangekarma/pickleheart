import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Park {
  id: string;
  name: string;
}

interface PlannedVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentParkId?: string;
}

export function PlannedVisitDialog({ open, onOpenChange, currentParkId }: PlannedVisitDialogProps) {
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>("12:00");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadParks();
      if (currentParkId) {
        setSelectedParkId(currentParkId);
      }
    }
  }, [open, currentParkId]);

  const loadParks = async () => {
    try {
      const { data } = await supabase
        .from("parks")
        .select("id, name")
        .order("name");
      
      if (data) {
        setParks(data);
        if (!selectedParkId && data.length > 0) {
          setSelectedParkId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading parks:", error);
    }
  };

  const handleSave = async () => {
    if (!date || !selectedParkId) {
      toast.error("Please select both a park and date");
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to plan a visit");
        return;
      }

      // Combine date and time
      const [hours, minutes] = time.split(':');
      const plannedDateTime = new Date(date);
      plannedDateTime.setHours(parseInt(hours), parseInt(minutes));

      // Delete any existing planned visit for this user (one at a time)
      await supabase
        .from("planned_visits")
        .delete()
        .eq("user_id", session.user.id);

      // Insert new planned visit
      const { error } = await supabase
        .from("planned_visits")
        .insert({
          user_id: session.user.id,
          park_id: selectedParkId,
          planned_at: plannedDateTime.toISOString(),
        });

      if (error) throw error;

      const selectedPark = parks.find(p => p.id === selectedParkId);
      toast.success(`Visit planned at ${selectedPark?.name || "park"} on ${format(plannedDateTime, "PPP 'at' p")}`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving planned visit:", error);
      toast.error("Failed to save planned visit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan Your Next Visit</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Park</label>
            <Select value={selectedParkId} onValueChange={setSelectedParkId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a park" />
              </SelectTrigger>
              <SelectContent>
                {parks.map((park) => (
                  <SelectItem key={park.id} value={park.id}>
                    {park.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Time</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i.toString().padStart(2, '0');
                  return [
                    <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                      {format(new Date().setHours(i, 0), "h:mm a")}
                    </SelectItem>,
                    <SelectItem key={`${hour}:30`} value={`${hour}:30`}>
                      {format(new Date().setHours(i, 30), "h:mm a")}
                    </SelectItem>
                  ];
                }).flat()}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !date || !selectedParkId} className="flex-1">
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
