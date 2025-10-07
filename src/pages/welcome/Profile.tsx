import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  displayName: z.string().trim().min(1, "Display name is required").max(50, "Display name must be less than 50 characters"),
});

const generateAgeOptions = () => {
  const ages = [];
  for (let i = 18; i <= 100; i++) {
    ages.push(i.toString());
  }
  return ages;
};

const Profile = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");

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
    if (!userId) return;

    // Validate input
    const validation = profileSchema.safeParse({
      firstName,
      lastName,
      displayName,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    // Calculate birthday from age if provided
    let birthdayString = null;
    if (age) {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - parseInt(age);
      birthdayString = `${birthYear}-01-01`;
    }

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          first_name: validation.data.firstName,
          last_name: validation.data.lastName,
          display_name: validation.data.displayName,
          gender: gender || null,
          birthday: birthdayString,
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="text-base">
                first name *
              </Label>
              <Input
                id="firstName"
                type="text"
                placeholder="e.g., Alex"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-2"
                autoFocus
                maxLength={50}
              />
            </div>

            <div>
              <Label htmlFor="lastName" className="text-base">
                last name *
              </Label>
              <Input
                id="lastName"
                type="text"
                placeholder="e.g., Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-2"
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="displayName" className="text-base">
              display name *
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="e.g., Alex S."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-2"
              maxLength={50}
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
                  <SelectItem value="non-binary">Non-binary</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="age" className="text-base">
                how old are you? (optional)
              </Label>
              <Select value={age} onValueChange={setAge}>
                <SelectTrigger id="age" className="mt-2">
                  <SelectValue placeholder="Select age" />
                </SelectTrigger>
                <SelectContent>
                  {generateAgeOptions().map((ageOption) => (
                    <SelectItem key={ageOption} value={ageOption}>
                      {ageOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleContinue} 
          className="w-full" 
          size="lg"
          disabled={!firstName.trim() || !lastName.trim() || !displayName.trim()}
        >
          continue
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/welcome/promise")}
          className="mt-4 w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          step 3 of 7
        </p>
      </div>
    </div>
  );
};

export default Profile;
