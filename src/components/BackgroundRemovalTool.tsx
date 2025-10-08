import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { removeBackground, loadImage } from "@/utils/removeBackground";
import { toast } from "sonner";
import arrowIcon from "@/assets/arrow-icon.png";

export const BackgroundRemovalTool = () => {
  const [processing, setProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);

  const handleRemoveBackground = async () => {
    setProcessing(true);
    try {
      toast.info("Loading AI model... This may take a moment on first run");
      
      // Load the arrow icon
      const response = await fetch(arrowIcon);
      const blob = await response.blob();
      const img = await loadImage(blob);
      
      toast.info("Processing image...");
      const resultBlob = await removeBackground(img);
      
      // Create a URL for the processed image
      const url = URL.createObjectURL(resultBlob);
      setProcessedImage(url);
      
      toast.success("Background removed! Right-click the image below and save it as arrow-icon.png");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to remove background");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-headline mb-4">Arrow Icon Background Removal</h1>
        <p className="text-muted-foreground mb-6">
          Click the button below to remove the background from the arrow icon using AI.
          This will process the image in your browser.
        </p>
        
        <Button 
          onClick={handleRemoveBackground} 
          disabled={processing}
          className="mb-6"
        >
          {processing ? "Processing..." : "Remove Background"}
        </Button>

        {processedImage && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-foreground/20 rounded-lg p-8 bg-muted/20">
              <img 
                src={processedImage} 
                alt="Processed arrow icon" 
                className="max-w-full h-auto mx-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Right-click the image above and "Save image as..." to download it.
              Then replace src/assets/arrow-icon.png with this new image.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
