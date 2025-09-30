import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Users, Heart, TrendingUp, Clock } from "lucide-react";

interface Profile {
  display_name: string | null;
  dupr_rating: number | null;
  avatar_url: string | null;
}

interface RecentActivity {
  park_name: string;
  visited_at: string;
}

const Home = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, dupr_rating, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (profileData) setProfile(profileData);

      // Count friends
      const { data: friendsData } = await supabase
        .from("friendships")
        .select("id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`);

      setFriendsCount(friendsData?.length || 0);

      // Get recent visits
      const { data: visitsData } = await supabase
        .from("visits")
        .select(`
          visited_at,
          parks(name)
        `)
        .eq("user_id", session.user.id)
        .order("visited_at", { ascending: false })
        .limit(3);

      if (visitsData) {
        setRecentActivity(
          visitsData.map((v: any) => ({
            park_name: v.parks.name,
            visited_at: v.visited_at,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading home data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-headline">
            welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {profile?.dupr_rating?.toFixed(2) || "—"}
                </p>
                <p className="text-xs text-muted-foreground">DUPR Rating</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{friendsCount}</p>
                <p className="text-xs text-muted-foreground">Friends</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">quick actions</h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/parks")}
            >
              <MapPin className="w-4 h-4 mr-2" />
              find nearby parks
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/friends")}
            >
              <Users className="w-4 h-4 mr-2" />
              see who's playing
            </Button>
          </div>
        </Card>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              recent activity
            </h2>
            <div className="space-y-2">
              {recentActivity.map((activity, idx) => (
                <div
                  key={idx}
                  className="text-sm flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="text-muted-foreground">
                    {activity.park_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.visited_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <Button
            variant="ghost"
            size="sm"
            className="flex-col h-auto gap-1"
          >
            <Heart className="w-5 h-5 text-primary" />
            <span className="text-xs text-primary">home</span>
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
            onClick={() => navigate("/profile")}
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">me</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Home;
