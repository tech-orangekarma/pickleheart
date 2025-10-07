import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import homePreview from "@/assets/home-preview.png";

const Promise = () => {
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
      completed_promise: true,
      current_step: "profile",
    });

    navigate("/welcome/profile");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-headline mb-6">
          what you get
        </h1>
        
        <img src={homePreview} alt="Home screen preview" className="w-full rounded-2xl mb-8 shadow-lg" />

        <Button onClick={handleContinue} size="lg" className="w-full">
          i'm in
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/delight")}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">step 2 of 7</p>
      </div>
    </div>
  );
};

export default Promise;
