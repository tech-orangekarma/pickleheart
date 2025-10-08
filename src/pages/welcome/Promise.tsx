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
        
        <div className="relative mb-8 group">
          <img src={homePreview} alt="Home screen preview" className="w-full rounded-2xl shadow-lg" />
          
          {/* Hover box for parks */}
          <div className="absolute top-[18%] left-1/2 -translate-x-1/2 bg-[hsl(var(--light-butter))] text-foreground px-3 py-2 rounded-lg text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            info for three parks, adding more!
          </div>
          
          {/* Hover box for center algorithm */}
          <div className="absolute top-[32%] left-1/2 -translate-x-1/2 bg-[hsl(var(--light-butter))] text-foreground px-3 py-2 rounded-lg text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity max-w-[200px] text-center">
            A quick check that tells you if now&apos;s the moment to hit the courts
          </div>
          
          {/* Hover box for bottom options */}
          <div className="absolute top-[74%] left-1/2 -translate-x-1/2 bg-[hsl(var(--light-butter))] text-foreground px-3 py-2 rounded-lg text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity max-w-[240px] text-center">
            see your friends, players at your skill level, stack count, and court conditions
          </div>
        </div>

        <Button onClick={handleContinue} size="lg" className="w-full">
          i'm in
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">step 1 of 6</p>
      </div>
    </div>
  );
};

export default Promise;
