import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import heartIcon from "@/assets/heart-icon.png";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      
      toast.success("Check your email for the magic link to continue!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      
      toast.success("Check your email for the magic link to sign in!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;
      toast.success("Password reset email sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
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
          {isSignUp ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-headline mb-2">create account</h2>
                <p className="text-sm text-muted-foreground">
                  Join the community and never miss a good game
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="signup-email">email</Label>
                  <Input
                    id="signup-email"
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
                  {loading ? "sending magic link..." : "get started"}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <Button
                  variant="ghost"
                  onClick={() => setIsSignUp(false)}
                  className="text-sm"
                >
                  already have an account? <span className="underline ml-1">sign in</span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-headline mb-2">welcome back</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to see who's playing
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">email</Label>
                  <Input
                    id="signin-email"
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
                  {loading ? "sending magic link..." : "send magic link"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setIsSignUp(true)}
                  className="text-sm"
                >
                  don't have an account? <span className="underline ml-1">sign up</span>
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;
