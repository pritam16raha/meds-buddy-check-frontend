import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/supabaseClient";
import { useQuery } from "@tanstack/react-query";

interface ImageViewerProps {
  filePath: string | null;
  onClose: () => void;
}

export function ImageViewer({ filePath, onClose }: ImageViewerProps) {
  const isOpen = !!filePath;
  const { data: signedUrlData, isLoading } = useQuery({
    queryKey: ["proof-image", filePath],
    queryFn: async () => {
      if (!filePath) return null;
      const { data, error } = await supabase.storage
        .from("proof16photos")
        .createSignedUrl(filePath, 60);

      if (error) throw new Error("Could not create signed URL.");
      return data.signedUrl;
    },
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Proof Photo</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex justify-center items-center min-h-[50vh]">
          {isLoading && <p>Loading image...</p>}
          {signedUrlData && (
            <img
              src={signedUrlData}
              alt="Medication proof enlargement"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
