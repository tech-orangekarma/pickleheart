import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
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
  const [ratingInput, setRatingInput] = useState("2.0");
  const [showAssessment, setShowAssessment] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);

      // Fetch the selected purpose
      const { data: progressData } = await supabase
        .from("welcome_progress")
        .select("selected_purpose")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (progressData?.selected_purpose) {
        setSelectedPurpose(progressData.selected_purpose);
      }
    });
  }, [navigate]);

  const handleRatingInputChange = (value: string) => {
    setRatingInput(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 2.0 && numValue <= 5.0) {
      setDuprRating(numValue);
    }
  };

  const handleSliderChange = (vals: number[]) => {
    const newRating = vals[0];
    setDuprRating(newRating);
    setRatingInput(formatDuprRating(newRating));
  };

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

  const showAssessmentFirst = selectedPurpose === "getting-started" || selectedPurpose === "fun-with-friends";

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

        {showAssessmentFirst && (
          <Button
            onClick={handleSelfAssessment}
            variant="outline"
            className="w-full mb-6 h-12"
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            take quick assessment
          </Button>
        )}

        <Card className="p-6 mb-6">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">DUPR Rating</span>
                <Input
                  type="text"
                  value={ratingInput}
                  onChange={(e) => handleRatingInputChange(e.target.value)}
                  className="w-24 text-3xl font-bold text-primary text-center border-0 focus-visible:ring-0 p-0"
                />
              </div>
              <div className="px-2">
                <Slider
                  value={[duprRating]}
                  onValueChange={handleSliderChange}
                  min={2.0}
                  max={5.0}
                  step={0.25}
                  className="mb-2"
                />
              </div>
              <div className="relative text-xs text-muted-foreground mt-2 h-8 px-2">
                <div className="absolute left-0 flex flex-col items-center -translate-x-1/2">
                  <span className="font-semibold">2.0</span>
                  <span className="text-[10px] whitespace-nowrap">beginner/casual</span>
                </div>
                <div className="absolute left-[33.33%] flex flex-col items-center -translate-x-1/2">
                  <span className="font-semibold">3.0</span>
                  <span className="text-[10px]">intermediate</span>
                </div>
                <div className="absolute left-[66.67%] flex flex-col items-center -translate-x-1/2">
                  <span className="font-semibold">4.0</span>
                  <span className="text-[10px]">advanced</span>
                </div>
                <div className="absolute left-full flex flex-col items-center -translate-x-1/2">
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

        {!showAssessmentFirst && (
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
        )}

        {showAssessmentFirst && (
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
          >
            skip for now
          </Button>
        )}

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
