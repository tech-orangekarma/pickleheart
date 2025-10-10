import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDuprRating } from "@/lib/utils";
import { formatPlannedVisitDate } from "@/utils/dateFormat";
import { format } from "date-fns";
import { UserX, MapPin, Calendar, Star } from "lucide-react";

interface Park {
  id: string;
  name: string;
}

interface FriendParks {
  favorite: Park | null;
  park2: Park | null;
  park3: Park | null;
}

interface PlannedVisit {
  park_name: string;
  planned_at: string;
}

interface FriendDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendId: string;
  friendName: string | null;
  friendAvatar: string | null;
  friendAge: number | null;
  friendGender: string | null;
  friendRating: number | null;
  onRemoveFriend: () => void;
}

export function FriendDetailDialog({
  open,
  onOpenChange,
  friendId,
  friendName,
  friendAvatar,
  friendAge,
  friendGender,
  friendRating,
  onRemoveFriend,
}: FriendDetailDialogProps) {
  const [friendParks, setFriendParks] = useState<FriendParks>({
    favorite: null,
    park2: null,
    park3: null,
  });
  const [plannedVisits, setPlannedVisits] = useState<PlannedVisit[]>([]);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && friendId) {
      loadFriendDetails();
    }
  }, [open, friendId]);

  const loadFriendDetails = async () => {
    setLoading(true);
    try {
      // Get friend's parks from user_parks table
      const { data: userParksData } = await supabase
        .from("user_parks")
        .select("favorite_park_id, park2_id, park3_id")
        .eq("user_id", friendId)
        .maybeSingle();

      const parks: FriendParks = {
        favorite: null,
        park2: null,
        park3: null,
      };

      if (userParksData) {
        // Fetch park details for each park ID
        const parkIds = [
          userParksData.favorite_park_id,
          userParksData.park2_id,
          userParksData.park3_id,
        ].filter(Boolean);

        if (parkIds.length > 0) {
          const { data: parksData } = await supabase
            .from("parks")
            .select("id, name")
            .in("id", parkIds);

          if (parksData) {
            const parkMap = new Map(parksData.map((p) => [p.id, p]));
            
            if (userParksData.favorite_park_id) {
              parks.favorite = parkMap.get(userParksData.favorite_park_id) || null;
            }
            if (userParksData.park2_id) {
              parks.park2 = parkMap.get(userParksData.park2_id) || null;
            }
            if (userParksData.park3_id) {
              parks.park3 = parkMap.get(userParksData.park3_id) || null;
            }
          }
        }
      }

      setFriendParks(parks);

      // Get all planned visits
      const { data: visitsData } = await supabase
        .from("planned_visits")
        .select(`
          planned_at,
          parks (name)
        `)
        .eq("user_id", friendId)
        .order("planned_at", { ascending: true });

      if (visitsData) {
        setPlannedVisits(
          visitsData.map((visit) => ({
            park_name: (visit.parks as any)?.name || "Unknown Park",
            planned_at: visit.planned_at,
          }))
        );
      } else {
        setPlannedVisits([]);
      }
    } catch (error) {
      console.error("Error loading friend details:", error);
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

  const handleRemoveClick = () => {
    setShowRemoveDialog(true);
  };

  const handleConfirmRemove = () => {
    setShowRemoveDialog(false);
    onOpenChange(false);
    onRemoveFriend();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Friend Profile</DialogTitle>
            <DialogDescription className="sr-only">
              View friend details and manage friendship
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="w-24 h-24 border-4 border-dashed border-foreground">
                  <AvatarImage src={friendAvatar || undefined} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(friendName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center">
                  <h3 className="text-2xl font-semibold mb-1">
                    {friendName || "Anonymous"}
                  </h3>
                  {(friendAge || friendGender) && (
                    <p className="text-muted-foreground">
                      {friendAge && <span>{friendAge} years old</span>}
                      {friendAge && friendGender && <span> • </span>}
                      {friendGender && <span>{friendGender}</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Rating */}
              {friendRating && (
                <div className="flex items-center justify-center gap-2 text-lg">
                  <span className="text-2xl">🎾</span>
                  <span className="font-medium">
                    DUPR Rating: {formatDuprRating(friendRating)}
                  </span>
                </div>
              )}

              {/* Friend's Parks */}
              {(friendParks.favorite || friendParks.park2 || friendParks.park3) && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Parks
                    </span>
                  </div>
                  <div className="space-y-2 ml-6">
                    {friendParks.favorite && (
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 fill-primary text-primary" />
                        <p className="font-medium">{friendParks.favorite.name}</p>
                      </div>
                    )}
                    {friendParks.park2 && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium">{friendParks.park2.name}</p>
                      </div>
                    )}
                    {friendParks.park3 && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium">{friendParks.park3.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Planned Visits */}
              {plannedVisits.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Upcoming Visits
                    </span>
                  </div>
                  <div className="space-y-2 ml-6">
                    {plannedVisits.map((visit, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">
                          {formatPlannedVisitDate(new Date(visit.planned_at))}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          at {format(new Date(visit.planned_at), "h:mm a")}
                        </span>
                        <p className="text-muted-foreground">{visit.park_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remove Friend Button */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleRemoveClick}
              >
                <UserX className="w-4 h-4 mr-2" />
                Remove Friend
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {friendName || "this friend"}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
