import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
import { toast } from "sonner";

const months = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const getDaysInMonth = (month: string, year: string) => {
  if (!month || !year) return 31;
  return new Date(parseInt(year), parseInt(month), 0).getDate();
};

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear; i >= currentYear - 100; i--) {
    years.push(i.toString());
  }
  return years;
};

const Profile = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");

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

    // Construct birthday if all parts are present
    let birthdayString = null;
    if (birthMonth && birthDay && birthYear) {
      birthdayString = `${birthYear}-${birthMonth}-${birthDay}`;
    }

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          display_name: displayName.trim(),
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

            <div className="col-span-2">
              <Label className="text-base">birthday (optional)</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Select value={birthMonth} onValueChange={setBirthMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={birthDay} onValueChange={setBirthDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: getDaysInMonth(birthMonth, birthYear) }, (_, i) => {
                      const day = (i + 1).toString().padStart(2, '0');
                      return (
                        <SelectItem key={day} value={day}>
                          {i + 1}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                <Select value={birthYear} onValueChange={setBirthYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateYears().map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
          step 3 of 7
        </p>
      </div>
    </div>
  );
};

export default Profile;
