import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const handleContinue = async () => {
    if (!userId || !displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          display_name: displayName.trim(),
          phone: phone.trim() || null,
          gender: gender || null,
          birthday: birthday || null,
        });

      if (profileError) throw profileError;

      await supabase.from("welcome_progress").upsert({
        user_id: userId,
        completed_profile: true,
        current_step: "level",
      });

      navigate("/welcome/level");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <User className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-headline mb-2">what should we call you?</h1>
          <p className="text-muted-foreground">
            Your name helps friends recognize you
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <div>
            <Label htmlFor="displayName" className="text-base">
              display name *
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="e.g., Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gender" className="text-base">
                gender (optional)
              </Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender" className="mt-2">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="birthday" className="text-base">
                birthday (optional)
              </Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="mt-2"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="text-base">
              phone number (optional)
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g., (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              We'll only use this for important app updates
            </p>
          </div>
        </div>

        <Button 
          onClick={handleContinue} 
          className="w-full" 
          size="lg"
          disabled={!displayName.trim()}
        >
          continue
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          step 4 of 6
        </p>
      </div>
    </div>
  );
};

export default Profile;
