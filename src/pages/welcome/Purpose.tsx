import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Target, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const purposeOptions = [
  { value: "getting-started", label: "I'm just getting started" },
  { value: "fun-with-friends", label: "I play for fun with friends" },
  { value: "fun-and-competition", label: "I like to mix fun with a bit of competition" },
  { value: "compete-and-improve", label: "I love to compete and improve" },
];

const Purpose = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const handleSelectPurpose = async (purposeValue: string) => {
    if (!userId) return;
    
    setSelectedPurpose(purposeValue);

    try {
      await supabase.from("welcome_progress").upsert({
        user_id: userId,
        completed_purpose: true,
        selected_purpose: purposeValue,
        current_step: "level",
      }, {
        onConflict: 'user_id'
      });

      // Auto-navigate after a brief delay
      setTimeout(() => {
        navigate("/welcome/level");
      }, 300);
    } catch (error) {
      console.error("Error saving purpose:", error);
      toast.error("Failed to save your response");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Target className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">which best describes why you pickle?</h1>
          <p className="text-muted-foreground">
            Help us tailor your experience
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {purposeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelectPurpose(option.value)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selectedPurpose === option.value
                  ? "border-[#F5E6B3] bg-[#FFF9E6]"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <p className="font-medium">{option.label}</p>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/profile")}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          step 3 of 7
        </p>
      </div>
    </div>
  );
};

export default Purpose;
