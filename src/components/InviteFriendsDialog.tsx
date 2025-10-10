import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Share2, QrCode } from "lucide-react";
import QRCodeReact from "react-qr-code";

interface InviteFriendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendsDialog({ open, onOpenChange }: InviteFriendsDialogProps) {
  const [inviteLink, setInviteLink] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const { toast } = useToast();

  const generateInvite = async () => {

    setIsGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate unique invite code
      const inviteCode = crypto.randomUUID().split('-')[0];
      
      // Set expiration to 7 days from now
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);

      const { error } = await supabase
        .from("invites")
        .insert({
          inviter_id: user.id,
          park_id: null,
          invite_code: inviteCode,
          expires_at: expirationDate.toISOString(),
        });

      if (error) throw error;

      const link = `${window.location.origin}/invite/${inviteCode}`;
      setInviteLink(link);
      setExpiresAt(expirationDate);

      toast({
        title: "Friend invite created!",
        description: "Share the QR code or link to become friends",
      });
    } catch (error) {
      console.error("Error generating invite:", error);
      toast({
        title: "Failed to create invite",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Copied to clipboard!",
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const shareInvite = async () => {
    const shareData = {
      title: "Let's be friends on PicklePlay!",
      text: "Join me on PicklePlay - Let's play pickleball together!",
      url: inviteLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      copyToClipboard();
    }
  };

  // Auto-generate invite when dialog opens
  useEffect(() => {
    if (open && !inviteLink) {
      generateInvite();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Friends</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Generating invite link...</p>
            </div>
          ) : inviteLink ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                  />
                  <Button size="icon" variant="outline" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={shareInvite}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {expiresAt && (
                <p className="text-sm text-muted-foreground text-center">
                  Expires on {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}
                </p>
              )}

              {showQR && (
                <div className="flex justify-center p-6 bg-white rounded-lg">
                  <QRCodeReact value={inviteLink} size={200} />
                </div>
              )}

              <Button 
                onClick={() => setShowQR(!showQR)}
                variant="outline"
                className="w-full"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {showQR ? "Hide QR Code" : "Show QR Code"}
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
