import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Share2 } from "lucide-react";
import QRCode from "react-qr-code";

interface Park {
  id: string;
  name: string;
}

interface InviteFriendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendsDialog({ open, onOpenChange }: InviteFriendsDialogProps) {
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [inviteLink, setInviteLink] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadParks();
  }, []);

  const loadParks = async () => {
    const { data, error } = await supabase
      .from("parks")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error loading parks:", error);
      return;
    }

    setParks(data || []);
    if (data && data.length > 0) {
      setSelectedParkId(data[0].id);
    }
  };

  const generateInvite = async () => {
    if (!selectedParkId) {
      toast({
        title: "Please select a park",
        variant: "destructive",
      });
      return;
    }

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
          park_id: selectedParkId,
          invite_code: inviteCode,
          expires_at: expirationDate.toISOString(),
        });

      if (error) throw error;

      const link = `${window.location.origin}/invite/${inviteCode}`;
      setInviteLink(link);
      setExpiresAt(expirationDate);

      toast({
        title: "Invite created!",
        description: "Share the QR code or link with your friends",
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
    const parkName = parks.find(p => p.id === selectedParkId)?.name || "park";
    const shareData = {
      title: "Join me at the park!",
      text: `Let's play pickleball at ${parkName}!`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Friends</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Park</label>
            <Select value={selectedParkId} onValueChange={setSelectedParkId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a park" />
              </SelectTrigger>
              <SelectContent>
                {parks.map((park) => (
                  <SelectItem key={park.id} value={park.id}>
                    {park.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!inviteLink ? (
            <Button 
              onClick={generateInvite} 
              disabled={isGenerating || !selectedParkId}
              className="w-full"
            >
              {isGenerating ? "Generating..." : "Generate Invite"}
            </Button>
          ) : (
            <>
              <div className="flex justify-center p-6 bg-white rounded-lg">
                <QRCode value={inviteLink} size={200} />
              </div>

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

              <Button 
                onClick={() => {
                  setInviteLink("");
                  setExpiresAt(null);
                }} 
                variant="outline"
                className="w-full"
              >
                Generate New Invite
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
