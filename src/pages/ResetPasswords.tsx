import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ResetPasswords = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const navigate = useNavigate();

  const handleReset = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-all-passwords", {
        body: {},
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Successfully reset ${data.updated} user passwords`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset passwords");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-headline mb-4">Reset All Passwords</h1>
        <p className="text-muted-foreground mb-6">
          This will reset all user passwords to the default password for email-only authentication.
        </p>

        <Button
          onClick={handleReset}
          disabled={loading}
          size="lg"
          className="w-full mb-4"
        >
          {loading ? "Resetting..." : "Reset All Passwords"}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="font-semibold mb-2">Results:</p>
            <p>Total users: {result.total}</p>
            <p className="text-green-600">Successfully updated: {result.updated}</p>
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

export default ResetPasswords;