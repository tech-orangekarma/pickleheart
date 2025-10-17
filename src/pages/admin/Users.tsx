import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Upload, RefreshCw } from "lucide-react";
import Papa from "papaparse";
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

      // Robust CSV parsing (handles quotes, commas, CRLF)
      const parsed = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
      });

      const rows = (parsed.data as unknown as string[][])
        .filter((r) => Array.isArray(r) && r.length > 0);

      // Detect a header row and skip it; also keep prior behavior of skipping preface lines
      let startIndex = 0;
      const first = rows[0]?.map((c) => String(c).toLowerCase());
      if (first && first.some((c) => c.includes('display') || c.includes('name'))) {
        startIndex = 1; // header detected
      }
      const dataLines = rows.slice(Math.max(startIndex, 3));

      const users = dataLines
        .map((cols) => {
          const get = (i: number) => (cols[i] ?? '').toString().trim();
          const entry: any = {
            user_id: get(1) || undefined,
            display_name: get(2) || undefined,
            dupr_rating: get(3) || undefined,
            gender: get(4) || undefined,
            birthday: get(5) || undefined,
            first_name: get(6) || undefined,
            last_name: get(7) || undefined,
            favorite_park_id: get(8) || undefined,
            park2_id: get(9) || undefined,
            park3_id: get(10) || undefined,
            mode: get(11) || undefined,
            min_age: get(12) || undefined,
            max_age: get(13) || undefined,
            gender_filter: get(14) || undefined,
            min_rating: get(15) || undefined,
            max_rating: get(16) || undefined,
          };

          // Strip any extra characters from UUID-looking fields
          ['favorite_park_id', 'park2_id', 'park3_id'].forEach((k) => {
            const v = entry[k] as string | undefined;
            if (v) {
              const match = v.match(/[0-9a-fA-F-]{36}/);
              entry[k] = match ? match[0] : undefined;
            }
          });

          // Normalize MM/DD/YYYY to YYYY-MM-DD for Postgres
          if (entry.birthday && entry.birthday.includes('/')) {
            const parts = entry.birthday.split('/').map((p: string) => p.trim());
            if (parts.length === 3) {
              const [m, d, y] = parts;
              if (y.length === 4) {
                const mm = m.padStart(2, '0');
                const dd = d.padStart(2, '0');
                entry.birthday = `${y}-${mm}-${dd}`;
              }
            }
          }

          return entry;
        })
        .filter((u) => u.display_name);

      const { data, error } = await supabase.functions.invoke("bulk-import-users", {
        body: { users },
      });

      if (error) throw error;

      const parts: string[] = [];
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
