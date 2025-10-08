import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
  const [assessmentAnswers, setAssessmentAnswers] = useState({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
  });

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

  const calculateDuprFromAssessment = () => {
    const q1Score = parseInt(assessmentAnswers.q1) || 0;
    const q2Score = parseInt(assessmentAnswers.q2) || 0;
    const q3Score = parseInt(assessmentAnswers.q3) || 0;
    const q4Score = parseInt(assessmentAnswers.q4) || 0;

    const weightedScore = (q1Score * 0.8) + (q2Score * 1.2) + (q3Score * 1.2) + (q4Score * 0.8);

    // Convert weighted score to DUPR
    if (weightedScore <= 5.40) return 2.0;
    if (weightedScore <= 6.80) return 2.25;
    if (weightedScore <= 8.20) return 2.5;
    if (weightedScore <= 9.60) return 2.75;
    if (weightedScore <= 11.00) return 3.0;
    if (weightedScore <= 12.40) return 3.25;
    if (weightedScore <= 13.80) return 3.5;
    if (weightedScore <= 15.20) return 3.75;
    if (weightedScore < 16.80) return 4.0;
    return 4.0;
  };

  const handleAssessmentSubmit = async () => {
    if (!assessmentAnswers.q1 || !assessmentAnswers.q2 || !assessmentAnswers.q3 || !assessmentAnswers.q4) {
      toast.error("Please answer all questions");
      return;
    }

    const calculatedRating = calculateDuprFromAssessment();
    setDuprRating(calculatedRating);
    setRatingInput(formatDuprRating(calculatedRating));
    setShowAssessment(false);
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
        <div className="w-full max-w-2xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAssessment(false)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            back
          </Button>

          <h1 className="text-2xl font-headline mb-6 text-center">
            quick skill assessment
          </h1>

          <div className="space-y-6 mb-6">
            {/* Question 1: Serve & Return */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">1. Serve & Return</h3>
              <RadioGroup value={assessmentAnswers.q1} onValueChange={(val) => setAssessmentAnswers({...assessmentAnswers, q1: val})}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="1" id="q1-1" />
                    <Label htmlFor="q1-1" className="font-normal cursor-pointer">
                      Serve usually lands; control and pace are still waking up.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="2" id="q1-2" />
                    <Label htmlFor="q1-2" className="font-normal cursor-pointer">
                      Depth or angle appears in spots—just not on command yet.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="3" id="q1-3" />
                    <Label htmlFor="q1-3" className="font-normal cursor-pointer">
                      I can start points with depth/spin/placement, but the rhythm wobbles.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="4" id="q1-4" />
                    <Label htmlFor="q1-4" className="font-normal cursor-pointer">
                      I use serve/return to set the tone and adjust on the fly.
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </Card>

            {/* Question 2: Dinking & Net Play */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">2. Dinking & Net Play</h3>
              <RadioGroup value={assessmentAnswers.q2} onValueChange={(val) => setAssessmentAnswers({...assessmentAnswers, q2: val})}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="1" id="q2-1" />
                    <Label htmlFor="q2-1" className="font-normal cursor-pointer">
                      Dinks are polite; the net still charges a small toll.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="2" id="q2-2" />
                    <Label htmlFor="q2-2" className="font-normal cursor-pointer">
                      Short exchanges stay tidy—until someone nudges the volume.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="3" id="q2-3" />
                    <Label htmlFor="q2-3" className="font-normal cursor-pointer">
                      I can hang in longer dinks, but sharp/fast ones still jam me; turning defense into pressure isn't automatic yet.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="4" id="q2-4" />
                    <Label htmlFor="q2-4" className="font-normal cursor-pointer">
                      I steer the kitchen: absorb heat, reset to neutral, and pick smart attack moments.
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </Card>

            {/* Question 3: Fast Rallies & Point Conversion */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">3. Fast Rallies & Point Conversion</h3>
              <RadioGroup value={assessmentAnswers.q3} onValueChange={(val) => setAssessmentAnswers({...assessmentAnswers, q3: val})}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="1" id="q3-1" />
                    <Label htmlFor="q3-1" className="font-normal cursor-pointer">
                      When rallies speed up, my shots scatter.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="2" id="q3-2" />
                    <Label htmlFor="q3-2" className="font-normal cursor-pointer">
                      I can block a few; real resets and counters are still more theory than habit.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="3" id="q3-3" />
                    <Label htmlFor="q3-3" className="font-normal cursor-pointer">
                      Blocks, resets, and counters work in stretches, but the wheels wobble under pressure.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="4" id="q3-4" />
                    <Label htmlFor="q3-4" className="font-normal cursor-pointer">
                      I shut down speed-ups and finish with counters or precise placement.
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </Card>

            {/* Question 4: Self-Estimate */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">4. Self-Estimate (pick the closest)</h3>
              <RadioGroup value={assessmentAnswers.q4} onValueChange={(val) => setAssessmentAnswers({...assessmentAnswers, q4: val})}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="1" id="q4-1" />
                    <Label htmlFor="q4-1" className="font-normal cursor-pointer">
                      2.0: Still learning the rules—occasional "wait, that's a rule?" cameo.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="2" id="q4-2" />
                    <Label htmlFor="q4-2" className="font-normal cursor-pointer">
                      2.5: Rules are in; keeping the ball in is the current boss level.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="3" id="q4-3" />
                    <Label htmlFor="q4-3" className="font-normal cursor-pointer">
                      3.0: I can rally; I'm learning when and how to play certain shots.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="4" id="q4-4" />
                    <Label htmlFor="q4-4" className="font-normal cursor-pointer">
                      3.5: I've got the shots; sometimes I choose the wrong one—or the right one misfires.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="5" id="q4-5" />
                    <Label htmlFor="q4-5" className="font-normal cursor-pointer">
                      4.0+: I make good choices under pressure and control pace and placement.
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </Card>
          </div>

          <div className="space-y-3">
            <Button onClick={handleAssessmentSubmit} className="w-full">
              calculate my rating
            </Button>
            <Button
              onClick={() => setShowAssessment(false)}
              variant="outline"
              className="w-full"
            >
              cancel
            </Button>
          </div>
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
              <Slider
                value={[duprRating]}
                onValueChange={handleSliderChange}
                min={2.0}
                max={5.0}
                step={0.25}
                className="mb-2"
              />
              <div className="relative text-xs text-muted-foreground mt-2 h-8">
                <div className="absolute left-0 flex flex-col items-start">
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
                <div className="absolute right-0 flex flex-col items-end">
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
