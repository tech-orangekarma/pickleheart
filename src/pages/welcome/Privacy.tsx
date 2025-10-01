import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const Privacy = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<
    "basic" | "standard" | "custom"
  >("standard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const handleContinue = async () => {
    if (!userId) return;

    try {
      // Create privacy settings
      const { error: privacyError } = await supabase
        .from("privacy_settings")
        .upsert({
          user_id: userId,
          mode: selectedMode,
          share_skill_level: selectedMode !== "basic",
          share_arrival_time: selectedMode === "standard",
          share_name: false,
          do_not_share_at_all: false,
        }, { onConflict: 'user_id' });

      if (privacyError) throw privacyError;

      // Update welcome progress
      const { error: progressError } = await supabase
        .from("welcome_progress")
        .upsert({
          user_id: userId,
          completed_privacy: true,
          current_step: "ready",
        }, { onConflict: 'user_id' });

      if (progressError) throw progressError;

      navigate("/welcome/ready");
    } catch (error) {
      console.error("Error saving privacy:", error);
      toast.error("Failed to save settings");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">your privacy matters</h1>
          <p className="text-muted-foreground">
            choose how much you want to share with other players
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <Card
            className={`p-4 cursor-pointer transition-all ${
              selectedMode === "basic"
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => setSelectedMode("basic")}
          >
            <div className="flex items-start gap-3">
              <EyeOff className="w-5 h-5 mt-1 text-primary" />
              <div>
                <h3 className="font-semibold mb-1">basic</h3>
                <p className="text-sm text-muted-foreground">
                  Just show I'm here. No skill level or timing shared.
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer transition-all ${
              selectedMode === "standard"
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => setSelectedMode("standard")}
          >
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 mt-1 text-primary" />
              <div>
                <h3 className="font-semibold mb-1">standard (recommended)</h3>
                <p className="text-sm text-muted-foreground">
                  Share skill level and arrival time. Help others find their
                  match.
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer transition-all ${
              selectedMode === "custom"
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => setSelectedMode("custom")}
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 mt-1 text-primary" />
              <div>
                <h3 className="font-semibold mb-1">custom</h3>
                <p className="text-sm text-muted-foreground">
                  I'll customize exactly what to share later.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Button onClick={handleContinue} className="w-full" size="lg">
          continue
        </Button>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            step 6 of 7 • you can change this anytime
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
