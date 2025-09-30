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

interface SkillFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: [number, number]) => void;
  currentRange: [number, number];
}

export const SkillFilterDialog = ({
  isOpen,
  onClose,
  onApply,
  currentRange,
}: SkillFilterDialogProps) => {
  const [range, setRange] = useState<[number, number]>(currentRange);

  const handleApply = () => {
    onApply(range);
    onClose();
  };

  const handleReset = () => {
    setRange([2.0, 8.0]);
    onApply([2.0, 8.0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">filter by skill level</DialogTitle>
          <DialogDescription>
            Show only players within your DUPR rating range
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2">
              {range[0].toFixed(2)} - {range[1].toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">DUPR Rating Range</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Minimum Rating: {range[0].toFixed(2)}
              </label>
              <Slider
                value={[range[0]]}
                onValueChange={(vals) => setRange([vals[0], range[1]])}
                min={2.0}
                max={range[1]}
                step={0.25}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Maximum Rating: {range[1].toFixed(2)}
              </label>
              <Slider
                value={[range[1]]}
                onValueChange={(vals) => setRange([range[0], vals[0]])}
                min={range[0]}
                max={8.0}
                step={0.25}
              />
            </div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2.0 (beginner)</span>
            <span>8.0 (pro)</span>
          </div>
        </div>

        <div className="flex gap-3">
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
