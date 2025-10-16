import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminUsers() {
  const { data: users, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, dupr_rating, gender, birthday, created_at")
        .order("created_at", { ascending: false });

      return data?.map((user) => ({
        ...user,
        age: user.birthday ? new Date().getFullYear() - new Date(user.birthday).getFullYear() : null,
      })) || [];
    },
  });

  const handleDeleteAllUsers = async () => {
    try {
      const { error } = await supabase.functions.invoke("delete-all-users");
      if (error) throw error;
      
      toast.success("All users deleted successfully");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete users");
    }
  };

  const handleResetAllPasswords = async () => {
    try {
      const { error } = await supabase.functions.invoke("reset-all-passwords");
      if (error) throw error;
      
      toast.success("All passwords reset successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset passwords");
    }
  };

  const columns = [
    {
      header: "User",
      accessor: (row: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.avatar_url} />
            <AvatarFallback>{row.display_name?.[0] || "?"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.display_name || "Unknown"}</p>
          </div>
        </div>
      ),
    },
    {
      header: "DUPR Rating",
      accessor: "dupr_rating" as const,
      cell: (value: any) => value || "N/A",
    },
    {
      header: "Gender",
      accessor: "gender" as const,
      cell: (value: any) => value || "N/A",
    },
    {
      header: "Age",
      accessor: "age" as const,
      cell: (value: any) => value || "N/A",
    },
    {
      header: "Joined",
      accessor: "created_at" as const,
      cell: (value: any) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline mb-2">User Management</h2>
          <p className="text-muted-foreground">Manage all registered users</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset All Passwords
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset All Passwords?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all user passwords to the default. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetAllPasswords}>
                  Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete All Users
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Users?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all users and their data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAllUsers}>
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <DataTable
        data={users || []}
        columns={columns}
        searchPlaceholder="Search users by name..."
      />
    </div>
  );
}
