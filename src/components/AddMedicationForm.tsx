import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
});

type AddMedicationFormProps = {
  onSuccess?: () => void;
};

export function AddMedicationForm({ onSuccess }: AddMedicationFormProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dosage: "",
      frequency: "",
    },
  });

  const addMedicationMutation = useMutation({
    mutationFn: async (newMedication: z.infer<typeof formSchema>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");
      const { error, data } = await supabase
        .from("medications")
        .insert({
          ...newMedication,
          user_id: user.id,
        })
        .select();

      if (error) throw error;
      return data;
    },

    onSuccess: () => {
      toast.success("Medication added successfully!");
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    addMedicationMutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medication Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Paracetamol" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dosage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dosage (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 500mg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Twice a day" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={addMedicationMutation.isPending}
          className="w-full"
        >
          {addMedicationMutation.isPending ? "Adding..." : "Add Medication"}
        </Button>
      </form>
    </Form>
  );
}
