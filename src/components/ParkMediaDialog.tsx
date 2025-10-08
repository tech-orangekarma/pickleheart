import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParkMedia {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
}

interface ParkMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parkId: string;
  parkName: string;
}

export const ParkMediaDialog = ({ isOpen, onClose, parkId, parkName }: ParkMediaDialogProps) => {
  const [media, setMedia] = useState<ParkMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, parkId]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("park_media")
        .select("*")
        .eq("park_id", parkId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error("Error loading media:", error);
      toast({
        title: "Error",
        description: "Failed to load photos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    
    if (!isImage && !isVideo) {
      toast({
        title: "Invalid file",
        description: "Please upload an image or video file",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("park-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("park-media")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from("park_media")
        .insert({
          user_id: session.user.id,
          park_id: parkId,
          media_url: publicUrl,
          media_type: isImage ? "photo" : "video",
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Media uploaded successfully",
      });

      loadMedia();
    } catch (error) {
      console.error("Error uploading media:", error);
      toast({
        title: "Error",
        description: "Failed to upload media",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{parkName} Photos & Videos</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor="media-upload">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-accent/50 transition-colors">
              {uploading ? (
                <div className="text-muted-foreground">Uploading...</div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Upload Photo or Video</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to select a file</p>
                </>
              )}
            </div>
            <input
              id="media-upload"
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : media.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No photos or videos yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to share!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {media.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-accent">
                  {item.media_type === "photo" ? (
                    <img
                      src={item.media_url}
                      alt={item.caption || "Park photo"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.media_url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button className="w-full mt-4" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};
