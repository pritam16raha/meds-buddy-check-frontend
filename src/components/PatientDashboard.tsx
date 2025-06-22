import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar as CalendarIcon, Image, User } from "lucide-react";
import MedicationTracker from "./MedicationTracker";
import {
  format,
  isToday,
  isBefore,
  startOfDay,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { AddMedicationForm } from "./AddMedicationForm";
import { supabase } from "../supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo } from "react";
import { ProofUploader } from "./ProofUploader";
import { ImageViewer } from "./ImageViewer";

type Medication = {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  user_id: string;
};

type MedicationLog = {
  id: number;
  medication_id: number;
  taken_at: string;
  proof_image_url: string | null;
  medications: Medication;
};

const PatientDashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<{ [key: string]: string }>(
    {}
  );
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const isTodaySelected = isToday(selectedDate);
  const queryClient = useQueryClient();

  const [selectedFiles, setSelectedFiles] = useState<{ [key: number]: File }>(
    {}
  );

  const handleFileSelect = (medicationId: number, file: File) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [medicationId]: file,
    }));
  };

  const fetchMedications = async (): Promise<Medication[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found.");
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return data || [];
  };

  const {
    data: medications,
    isLoading: isLoadingMeds,
    error: errorMeds,
  } = useQuery({
    queryKey: ["medications"],
    queryFn: fetchMedications,
  });

  const fetchMedicationLogs = async (): Promise<MedicationLog[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("medication_logs")
      .select("*, medications(*)")
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return data || [];
  };

  const { data: medicationLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["medication_logs"],
    queryFn: fetchMedicationLogs,
  });

  const takenDatesSet = useMemo(() => {
    if (!medicationLogs) return new Set<string>();
    return new Set(
      medicationLogs.map((log) => format(new Date(log.taken_at), "yyyy-MM-dd"))
    );
  }, [medicationLogs]);

  const logsForSelectedDate = useMemo(() => {
    if (!medicationLogs) return [];
    return medicationLogs.filter(
      (log) =>
        format(new Date(log.taken_at), "yyyy-MM-dd") ===
        format(selectedDate, "yyyy-MM-dd")
    );
  }, [medicationLogs, selectedDate]);

  const pendingMedsForSelectedDate = useMemo(() => {
    if (!medications) return [];
    const takenMedIds = new Set(
      logsForSelectedDate.map((log) => log.medication_id)
    );
    return medications.filter((med) => !takenMedIds.has(med.id));
  }, [medications, logsForSelectedDate]);

  const markAsTakenMutation = useMutation({
    mutationFn: async ({
      medicationId,
      date,
      proofImageFile,
    }: {
      medicationId: number;
      date: Date;
      proofImageFile?: File;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      let imagePath: string | null = null;

      if (proofImageFile) {
        const fileExt = proofImageFile.name.split(".").pop();
        const filePath = `${
          user.id
        }/${medicationId}-${new Date().getTime()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("proof16photos")
          .upload(filePath, proofImageFile);

        if (uploadError)
          throw new Error(`Image Upload Failed: ${uploadError.message}`);
        imagePath = filePath;
      }

      const { error: insertError, data } = await supabase
        .from("medication_logs")
        .insert({
          medication_id: medicationId,
          user_id: user.id,
          taken_at: date.toISOString(),
          proof_image_url: imagePath,
        })
        .select();

      if (insertError) throw insertError;
      return data[0];
    },
    onMutate: async ({ date }) => {
      await queryClient.cancelQueries({ queryKey: ["medication_logs"] });
      const previousLogs = queryClient.getQueryData<any[]>(["medication_logs"]);

      queryClient.setQueryData<any[]>(["medication_logs"], (old = []) => {
        const newLog = {
          taken_at: date.toISOString(),
        };
        return [...old, newLog];
      });

      return { previousLogs };
    },
    onError: (err, variables, context) => {
      toast.error(`Failed to mark as taken. Please try again.`);
      if (context?.previousLogs) {
        queryClient.setQueryData(["medication_logs"], context.previousLogs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["medication_logs"] });
    },
  });

  const getStreakCount = () => {
    let streak = 0;
    let currentDate = new Date();
    while (takenDatesSet.has(format(currentDate, "yyyy-MM-dd"))) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    return streak;
  };

  const getMonthlyRate = () => {
    const today = new Date();
    const start = startOfMonth(today);
    const end = today;

    const daysInPeriod = eachDayOfInterval({ start, end });
    const takenCount = daysInPeriod.filter((day) =>
      takenDatesSet.has(format(day, "yyyy-MM-dd"))
    ).length;

    return Math.round((takenCount / daysInPeriod.length) * 100);
  };

  useEffect(() => {
    if (!medicationLogs || medicationLogs.length === 0) {
      return;
    }

    const fetchThumbnailUrls = async () => {
      const imagePaths = medicationLogs
        .map((log) => log.proof_image_url)
        .filter((path): path is string => !!path);

      if (imagePaths.length === 0) return;

      const { data, error } = await supabase.storage
        .from("proof16photos")
        .createSignedUrls(imagePaths, 60 * 5);

      if (error) {
        console.error("Error creating signed URLs for thumbnails:", error);
        return;
      }

      const urlMap = imagePaths.reduce((acc, path, index) => {
        acc[path] = data[index].signedUrl;
        return acc;
      }, {} as { [key: string]: string });

      setThumbnailUrls(urlMap);
    };

    fetchThumbnailUrls();
  }, [medicationLogs]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">
              Good{" "}
              {new Date().getHours() < 12
                ? "Morning"
                : new Date().getHours() < 18
                ? "Afternoon"
                : "Evening"}
              !
            </h2>
            <p className="text-white/90 text-lg">
              Ready to stay on track with your medication?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">{getStreakCount()}</div>
            <div className="text-white/80">Day Streak</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">
              <div className="text-2xl font-bold">
                {takenDatesSet.has(todayStr) ? "✓" : "○"}
              </div>
            </div>
            <div className="text-white/80">Today's Status</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">{getMonthlyRate()}%</div>
            <div className="text-white/80">Monthly Rate</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-fit">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
                Medication for {format(selectedDate, "MMMM d, yyyy")}
              </CardTitle>
              <Dialog
                open={isAddMedicationOpen}
                onOpenChange={setIsAddMedicationOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Medication
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a New Medication</DialogTitle>
                    <DialogDescription>
                      Fill in the details below to add a new medication to your
                      schedule.
                    </DialogDescription>
                  </DialogHeader>
                  <AddMedicationForm
                    onSuccess={() => setIsAddMedicationOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent>
              {(isLoadingMeds || isLoadingLogs) && (
                <p className="text-center p-4">Loading medications...</p>
              )}
              {errorMeds && (
                <p className="text-red-500 p-4">Error: {errorMeds.message}</p>
              )}
              {logsForSelectedDate.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-sm text-gray-500 mb-2 border-b pb-2">
                    Taken
                  </h4>
                  <ul className="space-y-2 pt-2">
                    {logsForSelectedDate.map((log) => (
                      <li
                        key={log.id}
                        className="p-3 border rounded-lg flex justify-between items-center bg-green-50/70"
                      >
                        <div className="flex items-center gap-4">
                          {log.proof_image_url &&
                            thumbnailUrls[log.proof_image_url] && (
                              <img
                                src={thumbnailUrls[log.proof_image_url]}
                                alt={`Proof for ${log.medications?.name}`}
                                className="w-12 h-12 object-cover rounded-md cursor-pointer hover:scale-110 transition-transform"
                                onClick={() =>
                                  setViewingImage(log.proof_image_url)
                                }
                              />
                            )}
                          <div>
                            <p className="font-medium">
                              {log.medications?.name || "Medication"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {log.medications?.dosage} -{" "}
                              {log.medications?.frequency}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <Check className="w-5 h-5" />
                          <span>Taken</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pendingMedsForSelectedDate.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-500 mb-2 border-b pb-2">
                    Pending
                  </h4>
                  <ul className="space-y-4 pt-2">
                    {pendingMedsForSelectedDate.map((med) => {
                      const isThisMedicationBeingMarked =
                        markAsTakenMutation.isPending &&
                        markAsTakenMutation.variables?.medicationId === med.id;
                      const selectedFile = selectedFiles[med.id];

                      return (
                        <li
                          key={med.id}
                          className="p-4 border rounded-lg bg-white"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-bold">{med.name}</p>
                              <p className="text-sm text-gray-500">
                                {med.dosage} - {med.frequency}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() =>
                                markAsTakenMutation.mutate({
                                  medicationId: med.id,
                                  date: selectedDate,
                                  proofImageFile: selectedFile,
                                })
                              }
                              disabled={isThisMedicationBeingMarked}
                            >
                              {isThisMedicationBeingMarked
                                ? "Marking..."
                                : "Mark as Taken"}
                            </Button>
                          </div>
                          <ProofUploader
                            medicationId={med.id}
                            onFileSelect={handleFileSelect}
                          />
                          {selectedFile && (
                            <p className="text-xs text-gray-500 mt-1">
                              File selected: {selectedFile.name}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {!isLoadingMeds &&
                !isLoadingLogs &&
                pendingMedsForSelectedDate.length === 0 &&
                logsForSelectedDate.length > 0 && (
                  <div className="text-center p-4 bg-green-50 text-green-700 rounded-lg">
                    <p>All medications for this day have been logged!</p>
                  </div>
                )}

              {!isLoadingMeds && medications?.length === 0 && (
                <p className="p-4">
                  You haven't added any medications yet. Click "+ Add
                  Medication" to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Medication Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="w-full"
                modifiers={{
                  taken: (date) =>
                    takenDatesSet.has(format(date, "yyyy-MM-dd")),
                  missed: (date) =>
                    isBefore(date, startOfDay(today)) &&
                    !isToday(date) &&
                    !takenDatesSet.has(format(date, "yyyy-MM-dd")),
                }}
                modifiersClassNames={{
                  selected: "bg-blue-600 hover:bg-blue-700",
                  today: "bg-blue-100 border-blue-300",
                  taken: "bg-green-300 text-green-800",
                  missed: "bg-red-50 text-red-600",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isTaken = takenDatesSet.has(dateStr);

                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <span>{date.getDate()}</span>
                        {isTaken && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  },
                }}
              />

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Medication taken</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span>Missed medication</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Today</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ImageViewer
        filePath={viewingImage}
        onClose={() => setViewingImage(null)}
      />
    </div>
  );
};

export default PatientDashboard;
