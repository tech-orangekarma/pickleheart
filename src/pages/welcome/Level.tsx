import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Award, HelpCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDuprRating } from "@/lib/utils";

const getSkillLabel = (rating: number) => {
  if (rating < 2.5) return "beginner/casual";
  if (rating < 3.5) return "intermediate";
  if (rating < 4.5) return "advanced";
  return "expert";
};

const Level = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [duprRating, setDuprRating] = useState(2.0);
  const [showAssessment, setShowAssessment] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setUserId(session.user.id);
    });
  }, [navigate]);

  const handleManualEntry = async () => {
    if (!userId) return;

    try {
      await supabase.from("profiles").update({
        dupr_rating: duprRating,
        dupr_source: "manual",
      }).eq("id", userId);

      await supabase.from("welcome_progress").upsert({
        user_id: userId,
        completed_level: true,
        current_step: "location",
      });

      navigate("/welcome/location");
    } catch (error) {
      console.error("Error saving level:", error);
      toast.error("Failed to save skill level");
    }
  };

  const handleSelfAssessment = () => {
    setShowAssessment(true);
  };

  const handleSkip = async () => {
    if (!userId) return;
    
    await supabase.from("welcome_progress").upsert({
      user_id: userId,
      completed_level: true,
      current_step: "location",
    });

    navigate("/welcome/location");
  };

  if (showAssessment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-headline mb-6 text-center">
            quick skill assessment
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            (Self-assessment questionnaire would go here - simplified for MVP)
          </p>
          <Button onClick={handleManualEntry} className="w-full">
            use rating: {formatDuprRating(duprRating)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Award className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">what's your level?</h1>
          <p className="text-muted-foreground">
            This helps you find matches at your skill level
          </p>
        </div>

        <Card className="p-6 mb-6">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">DUPR Rating</span>
                <span className="text-3xl font-bold text-primary">
                  {formatDuprRating(duprRating)}
                  {duprRating >= 5.0 && "+"}
                </span>
              </div>
              <Slider
                value={[duprRating]}
                onValueChange={(vals) => setDuprRating(vals[0])}
                min={2.0}
                max={5.0}
                step={0.25}
                className="mb-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <div className="flex flex-col items-center">
                  <span className="font-semibold">2.0</span>
                  <span className="text-[10px]">beginner/casual</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-semibold">3.0</span>
                  <span className="text-[10px]">intermediate</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-semibold">4.0</span>
                  <span className="text-[10px]">advanced</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-semibold">5.0+</span>
                  <span className="text-[10px]">expert</span>
                </div>
              </div>
            </div>

            <Button onClick={handleManualEntry} className="w-full">
              set my rating
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          <Button
            onClick={handleSelfAssessment}
            variant="outline"
            className="w-full"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            take quick assessment
          </Button>

          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
          >
            skip for now
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/purpose")}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          step 5 of 8
        </p>
      </div>
    </div>
  );
};

export default Level;
