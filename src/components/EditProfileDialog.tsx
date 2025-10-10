import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, GraduationCap, Star, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

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
    home_park_id: string | null;
  };
  onProfileUpdated: () => void;
}

export const EditProfileDialog = ({
  open,
  onOpenChange,
  profile,
  onProfileUpdated,
}: EditProfileDialogProps) => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [duprRating, setDuprRating] = useState(
    profile.dupr_rating?.toString() || ""
  );
  const [gender, setGender] = useState<string>(profile.gender || "");
  
  const birthdayDate = profile.birthday ? new Date(profile.birthday) : null;
  const [birthMonth, setBirthMonth] = useState<string>(
    birthdayDate ? (birthdayDate.getMonth() + 1).toString() : ""
  );
  const [birthDay, setBirthDay] = useState<string>(
    birthdayDate ? birthdayDate.getDate().toString() : ""
  );
  const [birthYear, setBirthYear] = useState<string>(
    birthdayDate ? birthdayDate.getFullYear().toString() : ""
  );
  
  const [selectedParks, setSelectedParks] = useState<string[]>([]);
  const [favoritePark, setFavoritePark] = useState<string | null>(null);
  const [parks, setParks] = useState<{ id: string; name: string }[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url
  );
  const [loading, setLoading] = useState(false);
  
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    loadParks();
    loadUserParks();
  }, []);

  const loadParks = async () => {
    const { data } = await supabase
      .from("parks")
      .select("id, name")
      .order("name");
    if (data) setParks(data);
  };

  const loadUserParks = async () => {
    const { data } = await supabase
      .from("user_parks")
      .select("favorite_park_id, park2_id, park3_id")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (data) {
      const parks = [data.favorite_park_id, data.park2_id, data.park3_id].filter(Boolean) as string[];
      setSelectedParks(parks);
      setFavoritePark(data.favorite_park_id);
    }
  };

  const toggleParkSelection = (parkId: string) => {
    setSelectedParks(prev => {
      if (prev.includes(parkId)) {
        if (favoritePark === parkId) {
          setFavoritePark(null);
        }
        return prev.filter(id => id !== parkId);
      }
      if (prev.length >= 3) {
        toast.error("You can only select up to 3 parks");
        return prev;
      }
      return [...prev, parkId];
    });
  };

  const toggleFavorite = (parkId: string) => {
    if (!selectedParks.includes(parkId)) {
      toast.error("Please select this park first");
      return;
    }
    setFavoritePark(favoritePark === parkId ? null : parkId);
  };

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
      
      // Construct birthday from month, day, year
      let birthdayString = null;
      if (birthMonth && birthDay && birthYear) {
        const date = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
        birthdayString = format(date, "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          dupr_rating: duprRating ? parseFloat(duprRating) : null,
          avatar_url: avatarUrl,
          gender: gender || null,
          birthday: birthdayString,
        })
        .eq("id", profile.id);

      if (error) throw error;

      // Save user parks
      if (selectedParks.length > 0) {
        // Ensure favorite is in the selected parks, otherwise use the first one
        const finalFavorite = favoritePark && selectedParks.includes(favoritePark) 
          ? favoritePark 
          : selectedParks[0];
        
        // Get remaining parks (excluding favorite)
        const otherParks = selectedParks.filter(id => id !== finalFavorite);
        
        const { error: parksError } = await supabase
          .from("user_parks")
          .upsert({
            user_id: profile.id,
            favorite_park_id: finalFavorite,
            park2_id: otherParks[0] || null,
            park3_id: otherParks[1] || null,
          });

        if (parksError) throw parksError;
      }

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
            <div className="flex items-center justify-between">
              <Label htmlFor="dupr-rating">DUPR Rating</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/welcome/level");
                }}
              >
                <GraduationCap className="w-3 h-3 mr-1" />
                retake assessment
              </Button>
            </div>
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
            <div className="grid grid-cols-3 gap-2">
              <Select value={birthMonth} onValueChange={setBirthMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {months.map((month, index) => (
                      <SelectItem key={month} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              
              <Select value={birthDay} onValueChange={setBirthDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {days.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              
              <Select value={birthYear} onValueChange={setBirthYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>My Parks (select up to 3)</Label>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {parks.map((park) => {
                  const isSelected = selectedParks.includes(park.id);
                  const isFavorite = favoritePark === park.id;
                  
                  return (
                    <Card
                      key={park.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10 border-primary" : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2 flex-1"
                          onClick={() => toggleParkSelection(park.id)}
                        >
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{park.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(park.id);
                          }}
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Click a park to select it, click the star to mark as favorite
            </p>
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
