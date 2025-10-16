import { Link, useLocation, Outlet } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  UserPlus, 
  FileText, 
  Mail,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/admin/users", icon: Users, label: "Users" },
  { path: "/admin/parks", icon: MapPin, label: "Parks" },
  { path: "/admin/friendships", icon: UserPlus, label: "Friendships" },
  { path: "/admin/reports", icon: FileText, label: "Reports" },
  { path: "/admin/invites", icon: Mail, label: "Invites" },
];

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-card border-r transition-all duration-300 z-50 ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-headline text-xl">Admin Portal</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>
                  {profile?.display_name?.[0] || "A"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.display_name || "Admin"}
                </p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? "lg:ml-64" : "ml-0"
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-card border-b p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-headline">
              {navItems.find((item) => item.path === location.pathname)?.label || "Admin"}
            </h1>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
