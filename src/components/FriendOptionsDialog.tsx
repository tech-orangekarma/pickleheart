import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, QrCode } from "lucide-react";

interface FriendOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchUsers: () => void;
  onQRInvite: () => void;
}

export function FriendOptionsDialog({ 
  open, 
  onOpenChange, 
  onSearchUsers, 
  onQRInvite 
}: FriendOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add or Invite Friends</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            onClick={() => {
              onOpenChange(false);
              onSearchUsers();
            }}
            className="w-full h-20 text-lg"
            variant="outline"
          >
            <Search className="w-6 h-6 mr-3" />
            Search Users
          </Button>

          <Button
            onClick={() => {
              onOpenChange(false);
              onQRInvite();
            }}
            className="w-full h-20 text-lg"
            variant="outline"
          >
            <QrCode className="w-6 h-6 mr-3" />
            QR Code Invite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
