import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CourtConditionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parkId: string;
  parkName: string;
}

type CourtCondition = "dry" | "wet" | "damp" | "snowy" | "icy";

const conditions: { value: CourtCondition; label: string; emoji: string }[] = [
  { value: "dry", label: "Dry", emoji: "☀️" },
  { value: "wet", label: "Wet", emoji: "💧" },
  { value: "damp", label: "Damp", emoji: "🌧️" },
  { value: "snowy", label: "Snowy", emoji: "❄️" },
  { value: "icy", label: "Icy", emoji: "🧊" },
];

export const CourtConditionsDialog = ({
  isOpen,
  onClose,
  parkId,
  parkName,
}: CourtConditionsDialogProps) => {
  const [selectedCondition, setSelectedCondition] = useState<CourtCondition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!selectedCondition) {
      toast({
        title: "Please select a condition",
        description: "Choose a court condition before submitting",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Save court condition report to database
      const { error } = await supabase
        .from("court_conditions")
        .insert({
          user_id: session.user.id,
          park_id: parkId,
          condition: selectedCondition,
          reported_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Court condition reported as ${selectedCondition}`,
      });

      setSelectedCondition(null);
      onClose();
    } catch (error) {
      console.error("Error submitting court condition:", error);
      toast({
        title: "Error",
        description: "Failed to submit court condition",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Court Conditions</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Report the current court conditions at {parkName}
        </p>

        <div className="space-y-3 mb-6">
          {conditions.map((condition) => (
            <button
              key={condition.value}
              onClick={() => setSelectedCondition(condition.value)}
              className={`w-full p-4 rounded-lg border-2 transition-colors text-left flex items-center gap-3 ${
                selectedCondition === condition.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent"
              }`}
            >
              <span className="text-2xl">{condition.emoji}</span>
              <span className="font-medium">{condition.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </div>
    </div>
  );
};
