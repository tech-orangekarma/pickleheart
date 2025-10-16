import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminInvites() {
  const { data: invites } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invites")
        .select(`
          id,
          invite_code,
          expires_at,
          created_at,
          inviter:profiles!invites_inviter_id_fkey(display_name),
          park:parks(name)
        `)
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied to clipboard");
  };

  const columns = [
    {
      header: "Invite Code",
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <code className="px-2 py-1 bg-muted rounded text-sm">{row.invite_code}</code>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => copyInviteCode(row.invite_code)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      header: "Inviter",
      accessor: (row: any) => row.inviter?.display_name || "Unknown",
    },
    {
      header: "Park",
      accessor: (row: any) => row.park?.name || "N/A",
    },
    {
      header: "Status",
      accessor: (row: any) => {
        const isExpired = new Date(row.expires_at) < new Date();
        return (
          <Badge variant={isExpired ? "destructive" : "default"}>
            {isExpired ? "Expired" : "Active"}
          </Badge>
        );
      },
    },
    {
      header: "Expires",
      accessor: "expires_at" as const,
      cell: (value: string) => new Date(value).toLocaleString(),
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
        <h2 className="text-3xl font-headline mb-2">Invites Management</h2>
        <p className="text-muted-foreground">View and manage all invite codes</p>
      </div>

      <DataTable
        data={invites || []}
        columns={columns}
        searchPlaceholder="Search invites..."
      />
    </div>
  );
}
