import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const Delight = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const handleContinue = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from("welcome_progress").upsert({
      user_id: session.user.id,
      completed_delight: true,
      current_step: "promise",
    });

    navigate("/welcome/promise");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Sparkles className="w-20 h-20 mx-auto mb-6 text-primary animate-pulse" />
        
        <h1 className="text-4xl font-headline mb-4">
          imagine this
        </h1>
        
        <div className="space-y-4 text-lg text-muted-foreground mb-8">
          <p>
            It's Saturday morning. You check your phone.
          </p>
          <p className="text-foreground font-medium">
            "8 players at Riverside. Sarah and Tom are there. Great vibe."
          </p>
          <p>
            You grab your paddle. You know it's worth the trip.
          </p>
          <p className="text-foreground font-medium">
            That's pickleheart.
          </p>
        </div>

        <Button onClick={handleContinue} size="lg" className="w-full">
          love it
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">step 2 of 6</p>
      </div>
    </div>
  );
};

export default Delight;
