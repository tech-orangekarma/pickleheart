import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: {
    id: string;
    display_name: string | null;
    dupr_rating: number | null;
    avatar_url: string | null;
    gender: string | null;
    birthday: string | null;
  };
  onProfileUpdated: () => void;
}

export const EditProfileDialog = ({
  open,
  onOpenChange,
  profile,
  onProfileUpdated,
}: EditProfileDialogProps) => {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [duprRating, setDuprRating] = useState(
    profile.dupr_rating?.toString() || ""
  );
  const [gender, setGender] = useState<string>(profile.gender || "");
  const [birthday, setBirthday] = useState<Date | undefined>(
    profile.birthday ? new Date(profile.birthday) : undefined
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url
  );
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return profile.avatar_url;

    const fileExt = avatarFile.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Delete old avatar if exists
    if (profile.avatar_url) {
      const oldPath = profile.avatar_url.split("/").slice(-2).join("/");
      await supabase.storage.from("avatars").remove([oldPath]);
    }

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, avatarFile);

    if (uploadError) {
      toast.error("Failed to upload avatar");
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const avatarUrl = await uploadAvatar(profile.id);

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          dupr_rating: duprRating ? parseFloat(duprRating) : null,
          avatar_url: avatarUrl,
          gender: gender || null,
          birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      onProfileUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview || ""} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>

            <Label
              htmlFor="avatar-upload"
              className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Photo
            </Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dupr-rating">DUPR Rating</Label>
            <Input
              id="dupr-rating"
              type="number"
              step="0.01"
              min="1"
              max="8"
              value={duprRating}
              onChange={(e) => setDuprRating(e.target.value)}
              placeholder="e.g., 4.5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Birthday</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !birthday && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthday ? format(birthday, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={birthday}
                  onSelect={setBirthday}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
