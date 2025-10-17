import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
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
  const [isImporting, setIsImporting] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  
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

  const handleBackfillProfiles = async () => {
    setIsBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-profiles");
      if (error) throw error;
      
      const parts = [];
      if (data.created > 0) parts.push(`${data.created} profiles created`);
      if (data.already_existing > 0) parts.push(`${data.already_existing} already exist`);
      
      const message = parts.length > 0 ? `Backfill complete: ${parts.join(', ')}` : 'Backfill complete';
      toast.success(message);
      
      if (data.errors?.length > 0) {
        console.error('Backfill errors:', data.errors);
      }
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to backfill profiles");
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleDeleteAllUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-all-users");
      if (error) throw error;
      
      const parts = [];
      if (data.deleted > 0) parts.push(`${data.deleted} deleted`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped (admins)`);
      if (data.failed > 0) parts.push(`${data.failed} failed`);
      
      const message = parts.length > 0 ? `${parts.join(', ')}` : 'All users deleted';
      toast.success(message);
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

  const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // Skip first 3 lines (empty + header)
    const dataLines = lines.slice(3);
    
    const users = dataLines.map(line => {
      const cols = line.split(',');
      return {
        user_id: cols[1]?.trim(),
        display_name: cols[2]?.trim(),
        dupr_rating: cols[3]?.trim(),
        gender: cols[4]?.trim(),
        birthday: cols[5]?.trim(),
        first_name: cols[6]?.trim(),
        last_name: cols[7]?.trim(),
        favorite_park_id: cols[8]?.trim(),
        park2_id: cols[9]?.trim(),
        park3_id: cols[10]?.trim(),
        mode: cols[11]?.trim(),
        min_age: cols[12]?.trim(),
        max_age: cols[13]?.trim(),
        gender_filter: cols[14]?.trim(),
        min_rating: cols[15]?.trim(),
        max_rating: cols[16]?.trim(),
      };
    }).filter(u => u.display_name);

      const { data, error } = await supabase.functions.invoke("bulk-import-users", {
        body: { users },
      });

      if (error) throw error;

      const parts = [];
      if (data.created > 0) parts.push(`${data.created} created`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.failed > 0) parts.push(`${data.failed} failed`);
      
      const message = parts.length > 0 ? `Import complete: ${parts.join(', ')}` : 'Import complete';
      toast.success(message);
      
      if (data.failed > 0) {
        console.error('Import errors:', data.errors);
      }
      if (data.unmatched?.length > 0) {
        console.log('Unmatched users (first 10):', data.unmatched.slice(0, 10));
      }
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to import users");
    } finally {
      setIsImporting(false);
      event.target.value = '';
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
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleBackfillProfiles}
            disabled={isBackfilling}
          >
            <RefreshCw className={`w-4 h-4 ${isBackfilling ? 'animate-spin' : ''}`} />
            {isBackfilling ? 'Backfilling...' : 'Backfill Profiles'}
          </Button>

          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => document.getElementById('csv-upload')?.click()}
            disabled={isImporting}
          >
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importing...' : 'Import CSV'}
          </Button>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleBulkImport}
          />

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
