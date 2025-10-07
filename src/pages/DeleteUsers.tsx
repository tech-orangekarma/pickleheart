import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const DeleteUsers = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const navigate = useNavigate();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-all-users", {
        body: {},
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Successfully deleted ${data.deleted} users`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete users");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-headline mb-4">Delete All Users</h1>
        <p className="text-muted-foreground mb-6">
          This will permanently delete all users from the database.
        </p>

        <Button
          onClick={handleDelete}
          disabled={loading}
          size="lg"
          variant="destructive"
          className="w-full mb-4"
        >
          {loading ? "Deleting..." : "Delete All Users"}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2">Results:</p>
            <p>Total users: {result.total}</p>
            <p className="text-green-600">Successfully deleted: {result.deleted}</p>
            <p className="text-red-600">Failed: {result.failed}</p>
            
            {result.results && result.results.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold mb-2">Details:</p>
                <div className="space-y-1 text-sm">
                  {result.results.map((r: any, i: number) => (
                    <div key={i} className={r.success ? "text-green-600" : "text-red-600"}>
                      {r.email}: {r.success ? "✓" : `✗ (${r.error})`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => navigate("/auth")}
          className="w-full mt-4"
        >
          Back to Auth
        </Button>
      </Card>
    </div>
  );
};

export default DeleteUsers;
