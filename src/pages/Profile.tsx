import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MapPin, Settings, Edit, Heart, Users } from "lucide-react";
import { toast } from "sonner";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { formatDuprRating } from "@/lib/utils";

interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
  dupr_rating: number | null;
  home_park_id: string | null;
  avatar_url: string | null;
  gender: string | null;
  birthday: string | null;
}

interface Park {
  id: string;
  name: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [homePark, setHomePark] = useState<Park | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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

      // Check if user has completed welcome flow
      const { data: welcomeProgress } = await supabase
        .from("welcome_progress")
        .select("completed_ready, current_step")
        .eq("user_id", user.id)
        .single();

      // If welcome flow not completed, redirect to appropriate step
      if (!welcomeProgress?.completed_ready) {
        const step = welcomeProgress?.current_step || "delight";
        navigate(`/welcome/${step}`);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);

      // Load home park if set
      if (data?.home_park_id) {
        const { data: parkData } = await supabase
          .from("parks")
          .select("id, name")
          .eq("id", data.home_park_id)
          .maybeSingle();
        if (parkData) setHomePark(parkData);
      }
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

  const calculateAge = (birthday: string | null) => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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
                <AvatarImage src={profile?.avatar_url || ""} />
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
                  <p className="text-3xl font-bold">{formatDuprRating(profile.dupr_rating)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mb-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => toast.info("Settings coming soon")}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {profile && (
          <EditProfileDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            profile={profile}
            onProfileUpdated={loadProfile}
          />
        )}

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

            {profile?.gender && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Gender</p>
                <p className="text-lg">
                  {profile.gender === 'prefer_not_to_say' 
                    ? 'Prefer not to say' 
                    : profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}
                </p>
              </div>
            )}

            {profile?.birthday && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Age</p>
                <p className="text-lg">{calculateAge(profile.birthday)} years</p>
              </div>
            )}

            {homePark && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Home Park</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="text-lg">{homePark.name}</p>
                </div>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/")}
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">home</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/parks")}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-xs">parks</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
            onClick={() => navigate("/friends")}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">friends</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
          >
            <Heart className="w-5 h-5 text-primary" />
            <span className="text-xs text-primary">me</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Profile;
