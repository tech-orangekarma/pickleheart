import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { MapPin } from "lucide-react";

export default function AdminParks() {
  const { data: parks } = useQuery({
    queryKey: ["admin-parks"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_parks_with_coordinates");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: parkStats } = useQuery({
    queryKey: ["admin-park-stats"],
    queryFn: async () => {
      if (!parks) return {};

      const stats: Record<string, number> = {};
      for (const park of parks) {
        const { count } = await supabase
          .from("presence")
          .select("*", { count: "exact", head: true })
          .eq("park_id", park.id)
          .is("checked_out_at", null);
        
        stats[park.id] = count || 0;
      }
      return stats;
    },
    enabled: !!parks,
  });

  const columns = [
    {
      header: "Park Name",
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      header: "Address",
      accessor: "address" as const,
    },
    {
      header: "Courts",
      accessor: "court_count" as const,
    },
    {
      header: "Active Players",
      accessor: (row: any) => parkStats?.[row.id] || 0,
    },
    {
      header: "Coordinates",
      accessor: (row: any) => (
        <span className="text-sm text-muted-foreground">
          {row.latitude?.toFixed(4)}, {row.longitude?.toFixed(4)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline mb-2">Parks Management</h2>
        <p className="text-muted-foreground">Manage all pickleball parks</p>
      </div>

      <DataTable
        data={parks || []}
        columns={columns}
        searchPlaceholder="Search parks by name or address..."
      />
    </div>
  );
}
