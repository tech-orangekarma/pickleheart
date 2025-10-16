import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AdminFriendships() {
  const { data: friendships } = useQuery({
    queryKey: ["admin-friendships"],
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships")
        .select(`
          id,
          status,
          created_at,
          requester:profiles!friendships_requester_id_fkey(display_name, avatar_url),
          addressee:profiles!friendships_addressee_id_fkey(display_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  const columns = [
    {
      header: "Requester",
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.requester?.avatar_url} />
            <AvatarFallback>{row.requester?.display_name?.[0] || "?"}</AvatarFallback>
          </Avatar>
          <span>{row.requester?.display_name || "Unknown"}</span>
        </div>
      ),
    },
    {
      header: "Addressee",
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.addressee?.avatar_url} />
            <AvatarFallback>{row.addressee?.display_name?.[0] || "?"}</AvatarFallback>
          </Avatar>
          <span>{row.addressee?.display_name || "Unknown"}</span>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status" as const,
      cell: (value: string) => (
        <Badge
          variant={
            value === "accepted"
              ? "default"
              : value === "pending"
              ? "secondary"
              : "destructive"
          }
        >
          {value}
        </Badge>
      ),
    },
    {
      header: "Created",
      accessor: "created_at" as const,
      cell: (value: string) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline mb-2">Friendships Overview</h2>
        <p className="text-muted-foreground">View and manage all friendships</p>
      </div>

      <DataTable
        data={friendships || []}
        columns={columns}
        searchPlaceholder="Search friendships..."
      />
    </div>
  );
}
