import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import heartIcon from "@/assets/heart-icon.png";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Check for pending invite code first
        const pendingInviteCode = localStorage.getItem("pending_invite_code");
        if (pendingInviteCode) {
          localStorage.removeItem("pending_invite_code");
          navigate(`/invite/${pendingInviteCode}`);
          return;
        }

        // Check if user profile exists in the database
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) {
          // Profile exists, send to home page
          navigate("/");
        } else {
          // Profile doesn't exist, send through welcome process
          navigate("/welcome/delight");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const parsedEmail = z.string().trim().email().max(255).parse(email);
      const emailToUse = parsedEmail.toLowerCase();

      // Use a default password behind the scenes (no user input)
      const defaultPassword = "pickleheart2024";

      // Call edge function to ensure user exists or create new user
      const { data, error: functionError } = await supabase.functions.invoke("email-login", {
        body: { email: emailToUse },
      });

      if (functionError) throw functionError;
      
      if (!data?.ok) {
        throw new Error(data?.error || "Failed to authenticate");
      }

      // Now sign in silently with the default password (retry to avoid race conditions)
      let lastError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: defaultPassword,
        });
        if (!signInError) {
          toast.success("Welcome!");
          lastError = null;
          break;
        }
        lastError = signInError;
        // small backoff before retry
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
      if (lastError) throw lastError;
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={heartIcon} alt="heart" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl font-headline mb-2">pickleheart</h1>
          <p className="text-muted-foreground">find your people at the park</p>
        </div>

        <Card className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-headline mb-2">
              welcome to pickleheart
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your email to continue
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="email">email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "continuing..." : "continue"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
