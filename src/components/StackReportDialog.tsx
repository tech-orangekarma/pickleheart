import { useState } from "react";
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
import { toast } from "sonner";

interface StackReportDialogProps {
  parkId: string;
  isOpen: boolean;
  onClose: () => void;
  onReported: () => void;
  isInGeofence: boolean;
}

export const StackReportDialog = ({
  parkId,
  isOpen,
  onClose,
  onReported,
  isInGeofence,
}: StackReportDialogProps) => {
  const [stackCount, setStackCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!isInGeofence) {
      toast.error("You must be at the park to report stack count");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.from("stack_reports").insert({
        user_id: session.user.id,
        park_id: parkId,
        stack_count: stackCount,
      });

      if (error) throw error;

      toast.success("Stack count reported! Thanks for helping the community.");
      onReported();
      onClose();
    } catch (error) {
      console.error("Error reporting stack:", error);
      toast.error("Failed to report stack count");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">report stack count</DialogTitle>
          <DialogDescription>
            How many people are waiting to play? This helps others decide if
            it's worth the trip.
          </DialogDescription>
        </DialogHeader>

        {!isInGeofence && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
            You must be within 150m of the park to report stack count
          </div>
        )}

        <div className="py-6">
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-primary mb-2">
              {stackCount}
            </div>
            <div className="text-sm text-muted-foreground">
              {stackCount === 0 && "No wait"}
              {stackCount === 1 && "1 person waiting"}
              {stackCount > 1 && `${stackCount} people waiting`}
            </div>
          </div>

          <Slider
            value={[stackCount]}
            onValueChange={(value) => setStackCount(value[0])}
            min={0}
            max={15}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isInGeofence || submitting}
            className="flex-1"
          >
            {submitting ? "reporting..." : "report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
