import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import heartIcon from "@/assets/heart-icon.png";

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
        <img src={heartIcon} alt="heart" className="w-20 h-20 mx-auto mb-6" />
        
        <h1 className="text-4xl font-headline mb-6">
          here's our promise
        </h1>
        
        <div className="space-y-6 text-left bg-card p-6 rounded-2xl mb-8">
          <div>
            <h3 className="font-headline text-lg mb-2">🎯 always accurate</h3>
            <p className="text-muted-foreground text-sm">
              Real-time data you can trust to make the trip worth it
            </p>
          </div>
          
          <div>
            <h3 className="font-headline text-lg mb-2">🔒 privacy first</h3>
            <p className="text-muted-foreground text-sm">
              Your data is yours. We'll never share it with other users without your permission.
            </p>
          </div>
          
          <div>
            <h3 className="font-headline text-lg mb-2">💝 built with care</h3>
            <p className="text-muted-foreground text-sm">
              Made by players, for players. Simple, honest, helpful.
            </p>
          </div>
        </div>

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
