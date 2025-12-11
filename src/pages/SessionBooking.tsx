import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Calendar as CalendarIcon, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Coach, CoachAvailability, BlockedDate, Session, TimeSlot } from "@/types/coaching";
import { generateTimeSlots, formatTimeSlot, canCancelSession } from "@/lib/scheduling";
import { formatDate } from "@/lib/helpers";

const SessionBooking = () => {
  const { coachId } = useParams<{ coachId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [availability, setAvailability] = useState<CoachAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [existingSessions, setExistingSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    if (coachId && user) {
      fetchData();
    }
  }, [coachId, user]);

  useEffect(() => {
    if (selectedDate && availability.length > 0) {
      // Time slots will be generated when date is selected
    }
  }, [selectedDate, availability, existingSessions, blockedDates]);

  const fetchData = async () => {
    if (!coachId || !user) return;

    setLoading(true);
    try {
      // Fetch coach
      const { data: coachData } = await supabase
        .from("coaches")
        .select("*")
        .eq("id", coachId)
        .eq("is_active", true)
        .single();

      if (!coachData) {
        toast({
          title: "Coach Not Found",
          description: "This coach profile is not available.",
          variant: "destructive",
        });
        navigate("/coaching-marketplace");
        return;
      }

      setCoach(coachData);

      // Fetch player
      const { data: playerData } = await supabase
        .from("players")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!playerData) {
        toast({
          title: "Player Profile Required",
          description: "Please create a player profile first.",
          variant: "destructive",
        });
        navigate("/coaching-marketplace/player-signup");
        return;
      }

      // Check connection
      const { data: connectionData } = await supabase
        .from("connections")
        .select("*")
        .eq("coach_id", coachId)
        .eq("student_id", playerData.id)
        .eq("verified", true)
        .single();

      if (!connectionData) {
        toast({
          title: "Connection Required",
          description: "You must be connected to this coach to book a session.",
          variant: "destructive",
        });
        navigate(`/coaching-marketplace/connect/${coachId}`);
        return;
      }

      setConnection(connectionData);

      // Fetch availability
      const { data: availabilityData } = await supabase
        .from("coach_availability")
        .select("*")
        .eq("coach_id", coachId)
        .order("day_of_week", { ascending: true });

      if (availabilityData) setAvailability(availabilityData);

      // Fetch blocked dates
      const { data: blockedData } = await supabase
        .from("blocked_dates")
        .select("*")
        .eq("coach_id", coachId)
        .gte("blocked_date", new Date().toISOString().split("T")[0]);

      if (blockedData) setBlockedDates(blockedData);

      // Fetch existing sessions
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .eq("coach_id", coachId)
        .gte("session_date_time_utc", new Date().toISOString())
        .neq("status", "canceled");

      if (sessionsData) setExistingSessions(sessionsData);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load booking information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedSlot || !coach || !connection) return;

    setBooking(true);
    try {
      const { error } = await supabase.from("sessions").insert([
        {
          coach_id: coach.id,
          student_id: connection.student_id,
          session_date_time_utc: selectedSlot.start.toISOString(),
          duration_minutes: duration,
          status: "pending",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Session Booked!",
        description: "Your session has been booked and is pending coach confirmation.",
      });

      navigate("/coaching-marketplace/player-dashboard");
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

  const getAvailableSlots = (): TimeSlot[] => {
    if (!selectedDate || availability.length === 0) return [];

    return generateTimeSlots(
      selectedDate,
      availability,
      existingSessions,
      blockedDates,
      duration,
      0, // buffer minutes (can be made configurable)
      30 // slot interval
    );
  };

  const availableSlots = getAvailableSlots();
  const availableSlotsOnly = availableSlots.filter((s) => s.available);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!coach || !connection) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to={`/coaching-marketplace/coach/${coachId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Coach Profile
            </Link>
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Coach Info */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl bg-gradient-card border border-border p-6 sticky top-24">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                  {coach.name}
                </h2>
                {coach.location && (
                  <p className="text-sm text-muted-foreground mb-4">{coach.location}</p>
                )}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      {coach.adjusted_rating.toFixed(1)} ({coach.number_of_ratings} ratings)
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {coach.years_experience} years experience
                  </div>
                </div>
                {coach.bio && (
                  <p className="text-sm text-muted-foreground mb-6">{coach.bio}</p>
                )}
              </div>
            </div>

            {/* Booking Form */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground mb-2">
                  Book a Session
                </h1>
                <p className="text-muted-foreground">
                  Select a date and time for your coaching session
                </p>
              </div>

              {/* Duration Selection */}
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <Label className="text-lg font-semibold mb-4 block">Session Duration</Label>
                <div className="flex gap-2">
                  {[30, 60, 90, 120].map((mins) => (
                    <Button
                      key={mins}
                      variant={duration === mins ? "default" : "outline"}
                      onClick={() => setDuration(mins)}
                    >
                      {mins} min
                    </Button>
                  ))}
                </div>
              </div>

              {/* Date Selection */}
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <Label className="text-lg font-semibold mb-4 block">Select Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => {
                    // Disable past dates
                    if (date < new Date()) return true;
                    // Disable blocked dates
                    const dateStr = date.toISOString().split("T")[0];
                    return blockedDates.some((bd) => bd.blocked_date === dateStr);
                  }}
                  className="rounded-md border"
                />
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div className="rounded-2xl bg-gradient-card border border-border p-6">
                  <Label className="text-lg font-semibold mb-4 block">Select Time</Label>
                  {availableSlotsOnly.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No available time slots for this date.
                      </p>
                      <Button variant="outline" onClick={() => setSelectedDate(undefined)}>
                        Select Different Date
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {availableSlotsOnly.map((slot, index) => (
                        <Button
                          key={index}
                          variant={selectedSlot?.start.getTime() === slot.start.getTime() ? "default" : "outline"}
                          onClick={() => setSelectedSlot(slot)}
                          className="h-auto py-3 flex flex-col items-center"
                        >
                          <Clock className="w-4 h-4 mb-1" />
                          <span className="text-sm">
                            {new Date(slot.start).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Booking Summary */}
              {selectedSlot && (
                <div className="rounded-2xl bg-gradient-card border border-border p-6">
                  <h3 className="font-semibold text-foreground mb-4">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">
                        {formatDate(selectedSlot.start, "long")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time:</span>
                      <span className="font-medium">
                        {new Date(selectedSlot.start).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })} -{" "}
                        {new Date(selectedSlot.end).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{duration} minutes</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleBooking}
                    disabled={booking}
                    variant="hero"
                    className="w-full mt-6"
                    size="lg"
                  >
                    {booking ? "Booking..." : "Confirm Booking"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SessionBooking;

