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
  const [isSignUp, setIsSignUp] = useState(true);

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
      // Validate email input
      const parsedEmail = z.string().trim().email().max(255).parse(email);

      // Use a default password behind the scenes (no user input)
      const defaultPassword = "pickleheart2024";

      // Call edge function to ensure user exists/is created based on mode
      const { data, error: functionError } = await supabase.functions.invoke("email-login", {
        body: { 
          email: parsedEmail,
          mode: isSignUp ? "signup" : "signin"
        },
      });

      if (functionError) throw functionError;
      
      if (!data?.ok) {
        throw new Error(data?.error || "Failed to authenticate");
      }

      // Now sign in silently with the default password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsedEmail,
        password: defaultPassword,
      });
      if (signInError) throw signInError;

      toast.success("Welcome!");
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
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={isSignUp ? "default" : "outline"}
              onClick={() => setIsSignUp(true)}
              className="flex-1"
            >
              sign up
            </Button>
            <Button
              type="button"
              variant={!isSignUp ? "default" : "outline"}
              onClick={() => setIsSignUp(false)}
              className="flex-1"
            >
              sign in
            </Button>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-headline mb-2">
              {isSignUp ? "create account" : "welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSignUp 
                ? "Join the community and never miss a good game" 
                : "Sign in to see who's playing"}
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
              {loading ? "continuing..." : isSignUp ? "get started" : "sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
