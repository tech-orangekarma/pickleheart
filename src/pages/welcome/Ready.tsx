import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";
import heartIcon from "@/assets/heart-icon.png";

const Ready = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else setUserId(session.user.id);
    });
  }, [navigate]);

  const handleGetStarted = async () => {
    if (!userId) return;

    await supabase.from("welcome_progress").update({
      completed_ready: true,
    }).eq("user_id", userId);

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="relative mb-8">
          <img src={heartIcon} alt="heart" className="w-24 h-24 mx-auto animate-pulse" />
          <Sparkles className="w-8 h-8 absolute top-0 right-1/3 text-accent animate-bounce" />
          <Sparkles className="w-6 h-6 absolute bottom-0 left-1/3 text-secondary animate-bounce delay-100" />
        </div>

        <h1 className="text-4xl font-headline mb-4">
          you're all set!
        </h1>

        <p className="text-lg text-muted-foreground mb-8">
          Welcome to pickleheart. Let's find your people and make every trip to the park worth it.
        </p>

        <div className="bg-card p-6 rounded-2xl mb-8 space-y-4">
          <div className="text-left">
            <h3 className="font-headline mb-1">✨ what's next?</h3>
            <ul className="text-sm text-muted-foreground space-y-2 ml-4">
              <li>• Check live player counts at NYC parks</li>
              <li>• See which friends are playing</li>
              <li>• Find matches at your skill level</li>
              <li>• Report stack counts to help others</li>
            </ul>
          </div>
        </div>

        <Button onClick={handleGetStarted} size="lg" className="w-full">
          let's play!
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/privacy")}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          🎉 Welcome complete!
        </p>
      </div>
    </div>
  );
};

export default Ready;
