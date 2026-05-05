import { useState, useEffect, useMemo } from "react";
import { format, startOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, Star, MapPin, ChevronLeft, ChevronRight, 
  Calendar as CalendarIcon, User, Globe, CheckCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Coach, CoachAvailability, BlockedDate, Session, TimeSlot } from "@/types/coaching";
import { generateTimeSlots } from "@/lib/scheduling";
import { formatInTimeZone } from "date-fns-tz";
import { getTimezoneLabel } from "@/lib/timezones";

interface BookSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerTimezone: string;
  connectedCoaches: Coach[];
  onSessionBooked: () => void;
}

export function BookSessionDialog({
  open,
  onOpenChange,
  playerId,
  playerTimezone,
  connectedCoaches,
  onSessionBooked,
}: BookSessionDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"select-coach" | "select-slot" | "confirm">("select-coach");
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [availability, setAvailability] = useState<CoachAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [existingSessions, setExistingSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);

  const timezone = playerTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneLabel = `${getTimezoneLabel(timezone)} (${timezone})`;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep("select-coach");
      setSelectedCoach(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setAvailability([]);
      setBlockedDates([]);
      setExistingSessions([]);
    }
  }, [open]);

  // Fetch coach availability when coach is selected
  useEffect(() => {
    if (selectedCoach) {
      fetchCoachAvailability();
    }
  }, [selectedCoach]);

  const fetchCoachAvailability = async () => {
    if (!selectedCoach) return;

    setLoading(true);
    try {
      const [availRes, blockedRes, sessionsRes] = await Promise.all([
        supabase
          .from("coach_availability")
          .select("*")
          .eq("coach_id", selectedCoach.id)
          .order("day_of_week", { ascending: true }),
        supabase
          .from("blocked_dates")
          .select("*")
          .eq("coach_id", selectedCoach.id)
          .gte("blocked_date", new Date().toISOString().split("T")[0]),
        supabase
          .from("sessions")
          .select("*")
          .eq("coach_id", selectedCoach.id)
          .gte("session_date_time_utc", new Date().toISOString())
          .neq("status", "canceled"),
      ]);

      if (availRes.data) setAvailability(availRes.data as CoachAvailability[]);
      if (blockedRes.data) setBlockedDates(blockedRes.data as BlockedDate[]);
      if (sessionsRes.data) setExistingSessions(sessionsRes.data as Session[]);
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableSlots = (): TimeSlot[] => {
    if (!selectedDate || availability.length === 0) return [];

    return generateTimeSlots(
      selectedDate,
      availability,
      existingSessions,
      blockedDates,
      duration,
      0,
      30,
      {
        coachTimezone: selectedCoach?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        displayTimezone: timezone,
      }
    );
  };

  const availableSlots = useMemo(() => {
    return getAvailableSlots().filter(s => s.available);
  }, [selectedDate, availability, existingSessions, blockedDates, duration]);

  const formatTimeInTimezone = (date: Date | string, format: string = "h:mm a") => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    try {
      return formatInTimeZone(dateObj, timezone, format);
    } catch {
      return dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  };

  const formatDateInTimezone = (date: Date | string, format: string = "EEEE, MMMM d, yyyy") => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    try {
      return formatInTimeZone(dateObj, timezone, format);
    } catch {
      return dateObj.toLocaleDateString();
    }
  };

  const handleSelectCoach = (coach: Coach) => {
    setSelectedCoach(coach);
    setStep("select-slot");
    setSelectedDate(new Date());
  };

  const handleBookSession = async () => {
    if (!selectedSlot || !selectedCoach) return;

    setBooking(true);
    try {
      // More precise conflict check
      const { data: conflictCheck } = await supabase
        .from("sessions")
        .select("id, session_date_time_utc, duration_minutes")
        .eq("coach_id", selectedCoach.id)
        .neq("status", "canceled")
        .gte("session_date_time_utc", new Date(selectedSlot.start.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .lte("session_date_time_utc", new Date(selectedSlot.start.getTime() + 24 * 60 * 60 * 1000).toISOString());

      if (conflictCheck && conflictCheck.length > 0) {
        const slotStart = selectedSlot.start.getTime();
        const slotEnd = slotStart + duration * 60000;
        
        for (const session of conflictCheck) {
          const existingStart = new Date(session.session_date_time_utc).getTime();
          const existingEnd = existingStart + (session.duration_minutes || 60) * 60000;
          
          // Check if times overlap
          if (slotStart < existingEnd && slotEnd > existingStart) {
            throw new Error("This time slot is no longer available. Please select another time.");
          }
        }
      }

      // Insert session
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .insert([
          {
            coach_id: selectedCoach.id,
            student_id: playerId,
            session_date_time_utc: selectedSlot.start.toISOString(),
            duration_minutes: duration,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Fetch player info for email
      const { data: playerData } = await supabase
        .from("players")
        .select("name, email")
        .eq("id", playerId)
        .single();

      // Send notification emails
      try {
        await supabase.functions.invoke("send-session-notification", {
          body: {
            sessionId: sessionData.id,
            coachEmail: selectedCoach.email,
            coachName: selectedCoach.name,
            playerEmail: playerData?.email || "",
            playerName: playerData?.name || "Player",
            sessionDateTime: selectedSlot.start.toISOString(),
            durationMinutes: duration,
            timezone: timezone,
            action: "booked",
          },
        });
      } catch (emailError) {
        console.error("Error sending notification:", emailError);
        // Don't fail the booking if email fails
      }

      toast({
        title: "Session Booked!",
        description: `Your session with ${selectedCoach.name} is pending confirmation.`,
      });

      onSessionBooked();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error booking session:", error);
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  // Get dates with availability (considering specific_date field)
  const datesWithAvailability = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const generatedSlots = generateTimeSlots(
        date,
        availability,
        existingSessions,
        blockedDates,
        duration,
        0,
        30,
        {
          coachTimezone: selectedCoach?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          displayTimezone: timezone,
        },
      );

      if (generatedSlots.some((slot) => slot.available)) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [availability, blockedDates, existingSessions, duration, selectedCoach, timezone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            {step === "select-coach" && "Select a Coach"}
            {step === "select-slot" && `Book with ${selectedCoach?.name}`}
            {step === "confirm" && "Confirm Booking"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {/* Step 1: Select Coach */}
          {step === "select-coach" && (
            <div className="space-y-4 py-4">
              {connectedCoaches.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No connected coaches yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect with a coach first to book sessions
                  </p>
                </div>
              ) : (
                connectedCoaches.map((coach) => (
                  <div
                    key={coach.id}
                    onClick={() => handleSelectCoach(coach)}
                    className="p-4 rounded-xl bg-secondary/30 border border-border hover:border-primary/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {coach.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{coach.name}</h4>
                          {coach.is_verified && (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          {coach.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {coach.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            {coach.average_rating?.toFixed(1) || "0.0"}
                          </span>
                          <span>{coach.years_experience} yrs exp</span>
                        </div>
                        {coach.specialties && coach.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {coach.specialties.slice(0, 3).map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 2: Select Slot */}
          {step === "select-slot" && selectedCoach && (
            <div className="space-y-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("select-coach");
                  setSelectedCoach(null);
                  setSelectedDate(undefined);
                  setSelectedSlot(null);
                }}
                className="mb-2"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to coaches
              </Button>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : availability.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No availability set</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This coach hasn't set their availability yet
                  </p>
                </div>
              ) : (
                <>
                  {/* Duration Selection */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Session Duration</Label>
                    <div className="flex gap-2">
                      {[60, 90].map((mins) => (
                        <Button
                          key={mins}
                          size="sm"
                          variant={duration === mins ? "default" : "outline"}
                          onClick={() => {
                            setDuration(mins);
                            setSelectedSlot(null);
                          }}
                        >
                          {mins} min
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Timezone indicator */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    Times shown in {timezoneLabel}
                  </div>

                  {/* Calendar */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Select Date</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                      disabled={(date) => {
                        if (date < startOfDay(new Date())) return true;
                        return !datesWithAvailability.some(
                          (availableDate) => format(availableDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"),
                        );
                      }}
                      className="rounded-md border pointer-events-auto"
                      modifiers={{
                        hasAvailability: datesWithAvailability,
                      }}
                      modifiersStyles={{
                        hasAvailability: {
                          backgroundColor: "hsl(var(--primary) / 0.1)",
                        },
                      }}
                    />
                  </div>

                  {/* Time Slots */}
                  {selectedDate && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Available Times - {formatDateInTimezone(selectedDate, "EEE, MMM d")}
                      </Label>
                      {availableSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No available slots for this date
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {availableSlots.map((slot, index) => (
                            <Button
                              key={index}
                              size="sm"
                              variant={
                                selectedSlot?.start.getTime() === slot.start.getTime()
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setSelectedSlot(slot)}
                              className="flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3" />
                              {formatTimeInTimezone(slot.start)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirm Button */}
                  {selectedSlot && (
                    <div className="pt-4 border-t border-border">
                      <div className="rounded-xl bg-primary/10 p-4 mb-4">
                        <h4 className="font-medium text-foreground mb-2">Booking Summary</h4>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">Coach:</span>{" "}
                            <span className="font-medium">{selectedCoach.name}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Date:</span>{" "}
                            <span className="font-medium">
                              {formatDateInTimezone(selectedSlot.start)}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Time:</span>{" "}
                            <span className="font-medium">
                              {formatTimeInTimezone(selectedSlot.start)} -{" "}
                              {formatTimeInTimezone(selectedSlot.end)}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Duration:</span>{" "}
                            <span className="font-medium">{duration} minutes</span>
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleBookSession}
                        disabled={booking}
                        variant="hero"
                        className="w-full"
                        size="lg"
                      >
                        {booking ? (
                          "Booking..."
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirm Booking
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
