import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/admin/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function AdminReports() {
  const { data: stackReports } = useQuery({
    queryKey: ["admin-stack-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stack_reports")
        .select(`
          id,
          stack_count,
          reported_at,
          user:profiles!stack_reports_user_id_fkey(display_name),
          park:parks(name)
        `)
        .order("reported_at", { ascending: false });

      return data || [];
    },
  });

  const { data: courtConditions } = useQuery({
    queryKey: ["admin-court-conditions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("court_conditions")
        .select(`
          id,
          condition,
          reported_at,
          user:profiles!court_conditions_user_id_fkey(display_name),
          park:parks(name)
        `)
        .order("reported_at", { ascending: false });

      return data || [];
    },
  });

  const stackColumns = [
    {
      header: "Park",
      accessor: (row: any) => row.park?.name || "Unknown",
    },
    {
      header: "Reporter",
      accessor: (row: any) => row.user?.display_name || "Unknown",
    },
    {
      header: "Stack Count",
      accessor: "stack_count" as const,
      cell: (value: number) => (
        <Badge variant={value > 3 ? "destructive" : "default"}>
          {value} stacks
        </Badge>
      ),
    },
    {
      header: "Reported",
      accessor: "reported_at" as const,
      cell: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  const conditionColumns = [
    {
      header: "Park",
      accessor: (row: any) => row.park?.name || "Unknown",
    },
    {
      header: "Reporter",
      accessor: (row: any) => row.user?.display_name || "Unknown",
    },
    {
      header: "Condition",
      accessor: "condition" as const,
      cell: (value: string) => (
        <Badge
          variant={
            value === "excellent"
              ? "default"
              : value === "good"
              ? "secondary"
              : "destructive"
          }
        >
          {value}
        </Badge>
      ),
    },
    {
      header: "Reported",
      accessor: "reported_at" as const,
      cell: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-headline mb-2">Reports & Analytics</h2>
        <p className="text-muted-foreground">View stack reports and court conditions</p>
      </div>

      <Tabs defaultValue="stack-reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stack-reports">Stack Reports</TabsTrigger>
          <TabsTrigger value="court-conditions">Court Conditions</TabsTrigger>
        </TabsList>

        <TabsContent value="stack-reports">
          <DataTable
            data={stackReports || []}
            columns={stackColumns}
            searchPlaceholder="Search stack reports..."
          />
        </TabsContent>

        <TabsContent value="court-conditions">
          <DataTable
            data={courtConditions || []}
            columns={conditionColumns}
            searchPlaceholder="Search court conditions..."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
