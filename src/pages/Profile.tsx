import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MapPin, Settings, Edit, Users, Navigation, Calendar, X, Star } from "lucide-react";
import { formatPlannedVisitDate } from "@/utils/dateFormat";
import { Switch } from "@/components/ui/switch";
import heartIcon from "@/assets/heart-icon.png";
import { toast } from "sonner";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { PlannedVisitDialog } from "@/components/PlannedVisitDialog";
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

interface UserPark extends Park {
  isHome: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userParks, setUserParks] = useState<UserPark[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [plannedVisitDialogOpen, setPlannedVisitDialogOpen] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [plannedVisits, setPlannedVisits] = useState<Array<{
    id: string;
    park_id: string;
    park_name: string;
    planned_at: string;
  }>>([]);

  useEffect(() => {
    loadProfile();
    loadPlannedVisits();
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

      // Load user's parks
      if (data) {
        const { data: userParksData } = await supabase
          .from("user_parks")
          .select(`
            favorite_park_id,
            park2_id,
            park3_id
          `)
          .eq("user_id", user.id)
          .maybeSingle();

        if (userParksData) {
          const parkIds = [
            userParksData.favorite_park_id,
            userParksData.park2_id,
            userParksData.park3_id
          ].filter(Boolean);

          if (parkIds.length > 0) {
            const { data: parksData } = await supabase
              .from("parks")
              .select("id, name")
              .in("id", parkIds);

            if (parksData) {
              const parks: UserPark[] = parksData
                .map(park => ({
                  id: park.id,
                  name: park.name,
                  isHome: park.id === data.home_park_id
                }))
                .sort((a, b) => {
                  // Sort home park first
                  if (a.isHome) return -1;
                  if (b.isHome) return 1;
                  return a.name.localeCompare(b.name);
                });
              
              setUserParks(parks);
            }
          }
        }
      }

      // Load location permission
      const { data: privacyData } = await supabase
        .from("privacy_settings")
        .select("location_permission_granted")
        .eq("user_id", user.id)
        .maybeSingle();

      setLocationPermission(privacyData?.location_permission_granted ?? null);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadPlannedVisits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("planned_visits")
        .select(`
          id,
          park_id,
          planned_at,
          parks (
            name
          )
        `)
        .eq("user_id", user.id)
        .order("planned_at", { ascending: true });

      if (error) {
        console.error("Error loading planned visits:", error);
        setPlannedVisits([]);
        return;
      }

      if (data) {
        setPlannedVisits(data.map(visit => ({
          id: visit.id,
          park_id: visit.park_id,
          park_name: (visit.parks as any)?.name || "Unknown",
          planned_at: visit.planned_at,
        })));
      }
    } catch (error) {
      console.error("Error loading planned visits:", error);
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

  const handleLocationToggle = async () => {
    if (updatingLocation) return;

    const newValue = !locationPermission;
    
    // If enabling, request browser permission
    if (newValue) {
      try {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            (error) => reject(error),
            { timeout: 10000 }
          );
        });
      } catch (error) {
        toast.error("Location permission denied by browser");
        return;
      }
    }

    setUpdatingLocation(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("privacy_settings")
        .update({ location_permission_granted: newValue })
        .eq("user_id", user.id);

      if (error) throw error;

      setLocationPermission(newValue);
      toast.success(newValue ? "Location enabled" : "Location disabled");
    } catch (error) {
      console.error("Error updating location permission:", error);
      toast.error("Failed to update location permission");
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleRemovePlannedVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from("planned_visits")
        .delete()
        .eq("id", visitId);

      if (error) throw error;

      setPlannedVisits(prev => prev.filter(v => v.id !== visitId));
      toast.success("Planned visit removed");
    } catch (error) {
      console.error("Error removing planned visit:", error);
      toast.error("Failed to remove planned visit");
    }
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
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {profile && (
          <>
            <EditProfileDialog
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              profile={profile}
              onProfileUpdated={loadProfile}
            />
            
            <SettingsDialog
              isOpen={settingsDialogOpen}
              onClose={() => setSettingsDialogOpen(false)}
            />
          </>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            {/* Location Permission Setting */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-3">
                <Navigation className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Location Services</p>
                  <p className="text-xs text-muted-foreground">
                    Enable auto check-in and distance tracking
                  </p>
                </div>
              </div>
              <Switch
                checked={locationPermission === true}
                onCheckedChange={handleLocationToggle}
                disabled={updatingLocation}
              />
            </div>

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

            {userParks.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">My Parks</p>
                <div className="space-y-2">
                  {userParks.map(park => (
                    <div 
                      key={park.id}
                      className={`flex items-center gap-2 p-3 rounded-lg ${
                        park.isHome 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'bg-muted/50'
                      }`}
                    >
                      <MapPin className={`h-4 w-4 ${park.isHome ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-base flex-1">{park.name}</p>
                      {park.isHome && <Star className="h-4 w-4 text-primary fill-primary" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-2">Planned Visits ({plannedVisits.length}/3)</p>
              {plannedVisits.length > 0 ? (
                <div className="space-y-2">
                  {plannedVisits.map(visit => (
                    <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium">{visit.park_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPlannedVisitDate(new Date(visit.planned_at))} at {format(new Date(visit.planned_at), "h:mm a")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePlannedVisit(visit.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {plannedVisits.length < 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlannedVisitDialogOpen(true)}
                      className="w-full"
                    >
                      Add another visit
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPlannedVisitDialogOpen(true)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Plan your next visit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {profile && (
          <PlannedVisitDialog
            open={plannedVisitDialogOpen}
        onOpenChange={(open) => {
          setPlannedVisitDialogOpen(open);
          if (!open) loadPlannedVisits();
        }}
            currentParkId={profile.home_park_id || undefined}
          />
        )}

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
            <img src={heartIcon} alt="heart" className="w-5 h-5" />
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
            <img src={heartIcon} alt="heart" className="w-5 h-5" />
            <span className="text-xs text-primary">me</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Profile;
