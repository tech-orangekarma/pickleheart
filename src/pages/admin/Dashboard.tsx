import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatsCard } from "@/components/admin/StatsCard";
import { Users, MapPin, UserCheck, MessageSquare, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalParks },
        { count: activePresence },
        { count: pendingRequests },
        { count: stackReports },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("parks").select("*", { count: "exact", head: true }),
        supabase.from("presence").select("*", { count: "exact", head: true }).is("checked_out_at", null),
        supabase.from("friendships").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("stack_reports").select("*", { count: "exact", head: true }),
      ]);

      return {
        totalUsers: totalUsers || 0,
        totalParks: totalParks || 0,
        activePresence: activePresence || 0,
        pendingRequests: pendingRequests || 0,
        stackReports: stackReports || 0,
      };
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const { data: recentUsers } = await supabase
        .from("profiles")
        .select("display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      return { recentUsers: recentUsers || [] };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline mb-2">Dashboard Overview</h2>
        <p className="text-muted-foreground">Welcome to the admin portal</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          description="Registered users"
        />
        <StatsCard
          title="Total Parks"
          value={stats?.totalParks || 0}
          icon={MapPin}
          description="Pickleball parks"
        />
        <StatsCard
          title="Active Presence"
          value={stats?.activePresence || 0}
          icon={UserCheck}
          description="Users currently at parks"
        />
        <StatsCard
          title="Pending Requests"
          value={stats?.pendingRequests || 0}
          icon={MessageSquare}
          description="Friend requests"
        />
        <StatsCard
          title="Stack Reports"
          value={stats?.stackReports || 0}
          icon={AlertCircle}
          description="Recent reports"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity?.recentUsers.map((user, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{user.display_name || "Unknown User"}</p>
                <p className="text-sm text-muted-foreground">New user registered</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
