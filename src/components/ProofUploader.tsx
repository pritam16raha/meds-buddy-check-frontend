import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProofUploaderProps = {
  medicationId: number;
  onFileSelect: (medicationId: number, file: File) => void;
};

export function ProofUploader({ medicationId, onFileSelect }: ProofUploaderProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(medicationId, file);
    }
  };

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5 mt-2">
      <Label htmlFor={`proof-photo-${medicationId}`}>Add Proof (Optional)</Label>
      <Input id={`proof-photo-${medicationId}`} type="file" onChange={handleFileChange} accept="image/*" />
    </div>
  );
}