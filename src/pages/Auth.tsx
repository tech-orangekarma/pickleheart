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
import pickleheartLogo from "@/assets/pickleheart-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event, !!session);
      
      if (session) {
        // Defer async operations to prevent deadlock
        setTimeout(() => {
          (async () => {
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
              console.log('[Auth] Profile exists, navigating to home');
              navigate("/");
            } else {
              // Profile doesn't exist, send through welcome process
              console.log('[Auth] No profile, navigating to welcome');
              navigate("/welcome/promise");
            }
          })();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusText("");

    // Global timeout - abort if this takes too long
    const globalTimeout = setTimeout(() => {
      setLoading(false);
      setStatusText("");
      toast.error("This is taking too long. Please try again.");
    }, 20000);

    try {
      const parsedEmail = z.string().trim().email().max(255).parse(email);
      const emailToUse = parsedEmail.toLowerCase();

      if (isSignUp) {
        console.log('[Auth] Creating account for:', emailToUse);
        setStatusText("creating account...");
        
        // Sign up flow with timeout
        const functionPromise = supabase.functions.invoke("email-login", {
          body: { email: emailToUse },
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Account creation timed out")), 10000)
        );

        const { data, error: functionError } = await Promise.race([
          functionPromise,
          timeoutPromise
        ]) as any;

        if (functionError) throw functionError;
        
        if (!data?.ok) {
          throw new Error(data?.error || "Failed to create account");
        }

        console.log('[Auth] Account created, waiting for propagation');
        // Wait for password update to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Sign in with password with retry logic
      console.log('[Auth] Signing in...');
      setStatusText("signing you in...");
      
      let signInError = null;
      const delays = [0, 500, 1000, 1500, 2000]; // Backoff delays
      
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (attempt > 0) {
          console.log(`[Auth] Retry attempt ${attempt} after ${delays[attempt]}ms`);
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
        
        const { error } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: "pickle",
        });

        if (!error) {
          signInError = null;
          break;
        }
        
        signInError = error;
      }

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          toast.error(isSignUp ? "Failed to create account" : "No account found with this email");
        } else {
          throw signInError;
        }
        return;
      }

      console.log('[Auth] Signed in successfully');
      toast.success(isSignUp ? "Account created! Welcome!" : "Welcome back!");
    } catch (error: any) {
      console.error('[Auth] Error:', error);
      toast.error(error?.message || "Failed to sign in");
    } finally {
      clearTimeout(globalTimeout);
      setLoading(false);
      setStatusText("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
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

            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? "continuing..." : isSignUp ? "sign up" : "sign in"}
              </Button>
              {statusText && (
                <p className="text-xs text-center text-muted-foreground">
                  {statusText}
                </p>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
