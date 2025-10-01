import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const InviteAccept = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"processing" | "success" | "error" | "expired">("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    handleInvite();
  }, [code]);

  const handleInvite = async () => {
    if (!code) {
      setStatus("error");
      setMessage("Invalid invite link");
      setLoading(false);
      return;
    }

    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Store invite code in localStorage and redirect to auth
        localStorage.setItem("pending_invite_code", code);
        navigate("/auth");
        return;
      }

      // User is authenticated, process the invite
      await processInvite(session.user.id, code);
    } catch (error) {
      console.error("Error handling invite:", error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const processInvite = async (userId: string, inviteCode: string) => {
    try {
      // Get the invite
      const { data: invite, error: inviteError } = await supabase
        .from("invites")
        .select("*, inviter:profiles!invites_inviter_id_fkey(display_name)")
        .eq("invite_code", inviteCode)
        .single();

      if (inviteError || !invite) {
        setStatus("error");
        setMessage("Invite not found");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(invite.expires_at) < new Date()) {
        setStatus("expired");
        setMessage("This invite has expired");
        setLoading(false);
        return;
      }

      // Check if trying to friend yourself
      if (invite.inviter_id === userId) {
        setStatus("error");
        setMessage("You cannot use your own invite link");
        setLoading(false);
        return;
      }

      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from("friendships")
        .select("id, status")
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${invite.inviter_id}),and(requester_id.eq.${invite.inviter_id},addressee_id.eq.${userId})`
        )
        .single();

      if (existingFriendship) {
        if (existingFriendship.status === "accepted") {
          setStatus("success");
          setMessage(`You're already friends with ${invite.inviter.display_name || "this user"}!`);
        } else {
          setStatus("success");
          setMessage("Friend request already pending");
        }
        setLoading(false);
        setTimeout(() => navigate("/friends"), 2000);
        return;
      }

      // Create friendship
      const { error: friendshipError } = await supabase
        .from("friendships")
        .insert({
          requester_id: invite.inviter_id,
          addressee_id: userId,
          status: "accepted", // Auto-accept since it's from an invite
        });

      if (friendshipError) {
        throw friendshipError;
      }

      setStatus("success");
      setMessage(`You're now friends with ${invite.inviter.display_name || "this user"}!`);
      setLoading(false);

      toast.success("Friend added successfully!");
      
      // Redirect to friends page after a delay
      setTimeout(() => navigate("/friends"), 2000);
    } catch (error) {
      console.error("Error processing invite:", error);
      setStatus("error");
      setMessage("Failed to process invite. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {loading ? (
          <>
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
            <h2 className="text-2xl font-headline">Processing invite...</h2>
          </>
        ) : (
          <>
            {status === "success" && (
              <>
                <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
                <h2 className="text-2xl font-headline text-green-500">Success!</h2>
              </>
            )}
            
            {status === "error" && (
              <>
                <XCircle className="w-16 h-16 mx-auto text-destructive" />
                <h2 className="text-2xl font-headline text-destructive">Oops!</h2>
              </>
            )}
            
            {status === "expired" && (
              <>
                <XCircle className="w-16 h-16 mx-auto text-yellow-500" />
                <h2 className="text-2xl font-headline text-yellow-500">Expired</h2>
              </>
            )}
            
            <p className="text-lg text-muted-foreground">{message}</p>
            
            <Button 
              onClick={() => navigate("/friends")} 
              className="w-full"
            >
              <Users className="w-5 h-5 mr-2" />
              Go to Friends
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default InviteAccept;
