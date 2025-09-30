import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
  dupr_rating: number | null;
  home_park_id: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-headline">profile</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(profile?.display_name || null)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h2 className="text-2xl font-headline mb-1">
                  {profile?.display_name || "No name"}
                </h2>
                <p className="text-muted-foreground">
                  @{profile?.display_name?.toLowerCase().replace(/\s+/g, "") || "unknown"}
                </p>
              </div>

              {profile?.dupr_rating && (
                <div className="bg-muted rounded-lg px-6 py-3">
                  <p className="text-sm text-muted-foreground mb-1">DUPR Rating</p>
                  <p className="text-3xl font-bold">{profile.dupr_rating.toFixed(2)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Display Name</p>
              <p className="text-lg">{profile?.display_name || "Not set"}</p>
            </div>

            {profile?.phone && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="text-lg">{profile.phone}</p>
              </div>
            )}

            {profile?.home_park_id && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Home park set</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;
