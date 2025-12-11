import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { X, Plus, Clock, Globe, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CoachAvailability } from "@/types/coaching";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

interface AvailabilityEditorProps {
  coachId: string;
  timezone?: string;
}

export function AvailabilityEditor({ coachId, timezone }: AvailabilityEditorProps) {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<CoachAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [newSlot, setNewSlot] = useState({
    start_time: "09:00",
    end_time: "17:00",
  });

  const resolvedTimezone = useMemo(() => {
    if (timezone && timezone.trim() !== '' && timezone !== 'UTC') {
      return timezone;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [timezone]);

  // Get the date range for the next 2 weeks
  const today = startOfDay(new Date());
  const twoWeeksFromNow = addDays(today, 14);

  // Convert local time to UTC for storage
  const localTimeToUtc = (time: string, date: Date): string => {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a date in the local timezone
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);
    
    // Convert from local timezone to UTC
    const utcDate = fromZonedTime(localDate, resolvedTimezone);
    
    return `${String(utcDate.getUTCHours()).padStart(2, '0')}:${String(utcDate.getUTCMinutes()).padStart(2, '0')}`;
  };

  // Convert UTC time to local time for display
  const utcTimeToLocal = (time: string, date: Date): string => {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a UTC date
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
      0
    ));
    
    // Convert to local timezone
    const localDate = toZonedTime(utcDate, resolvedTimezone);
    
    return `${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchAvailability();
  }, [coachId]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coach_availability")
        .select("*")
        .eq("coach_id", coachId)
        .not("specific_date", "is", null)
        .gte("specific_date", format(today, 'yyyy-MM-dd'))
        .lte("specific_date", format(twoWeeksFromNow, 'yyyy-MM-dd'))
        .order("specific_date", { ascending: true })
        .order("start_time_utc", { ascending: true });

      if (error) throw error;
      setAvailability((data || []) as CoachAvailability[]);
    } catch (error: any) {
      console.error("Error fetching availability:", error);
      toast({
        title: "Error",
        description: "Failed to load availability.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addAvailability = async () => {
    if (!selectedDate) {
      toast({
        title: "Select a Date",
        description: "Please select a date from the calendar.",
        variant: "destructive",
      });
      return;
    }

    if (newSlot.start_time >= newSlot.end_time) {
      toast({
        title: "Invalid Time",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayOfWeek = selectedDate.getDay();

    // Convert local times to UTC
    const startUtc = localTimeToUtc(newSlot.start_time, selectedDate);
    const endUtc = localTimeToUtc(newSlot.end_time, selectedDate);

    // Check for overlap on the same date
    const slotsOnDate = availability.filter(av => av.specific_date === dateStr);
    const overlaps = slotsOnDate.some(
      (av) =>
        (startUtc >= av.start_time_utc && startUtc < av.end_time_utc) ||
        (endUtc > av.start_time_utc && endUtc <= av.end_time_utc) ||
        (startUtc <= av.start_time_utc && endUtc >= av.end_time_utc)
    );

    if (overlaps) {
      toast({
        title: "Time Conflict",
        description: "This time slot overlaps with existing availability.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("coach_availability").insert([
        {
          coach_id: coachId,
          day_of_week: dayOfWeek,
          start_time_utc: startUtc,
          end_time_utc: endUtc,
          specific_date: dateStr,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Availability Added",
        description: `Slot added for ${format(selectedDate, 'EEEE, MMM d')}.`,
      });

      setNewSlot({
        start_time: "09:00",
        end_time: "17:00",
      });
      fetchAvailability();
    } catch (error: any) {
      console.error("Error adding availability:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add availability.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeAvailability = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("coach_availability")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Availability Removed",
        description: "Time slot has been removed.",
      });

      fetchAvailability();
    } catch (error: any) {
      console.error("Error removing availability:", error);
      toast({
        title: "Error",
        description: "Failed to remove availability.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get dates that have availability
  const datesWithAvailability = useMemo(() => {
    const dates: Date[] = [];
    availability.forEach(av => {
      if (av.specific_date) {
        const date = new Date(av.specific_date + 'T00:00:00');
        if (!dates.some(d => isSameDay(d, date))) {
          dates.push(date);
        }
      }
    });
    return dates;
  }, [availability]);

  // Get slots for selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return availability
      .filter(av => av.specific_date === dateStr)
      .map(av => ({
        ...av,
        localStart: utcTimeToLocal(av.start_time_utc, selectedDate),
        localEnd: utcTimeToLocal(av.end_time_utc, selectedDate),
      }));
  }, [selectedDate, availability, resolvedTimezone]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-foreground">
            Availability Calendar
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            {resolvedTimezone}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Set your availability for specific dates over the next 2 weeks. Players can book 60 or 90 minute sessions within your available slots.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="p-4 rounded-xl bg-gradient-card border border-border">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < today || date > twoWeeksFromNow}
              modifiers={{
                available: datesWithAvailability,
              }}
              modifiersStyles={{
                available: {
                  backgroundColor: 'hsl(var(--primary) / 0.2)',
                  borderRadius: '50%',
                },
              }}
              className="rounded-md pointer-events-auto"
            />
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary/20" />
                <span className="text-muted-foreground">Has availability</span>
              </div>
            </div>
          </div>

          {/* Add Slot Form & Display */}
          <div className="space-y-4">
            {selectedDate ? (
              <>
                <div className="p-4 rounded-xl bg-secondary border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold text-foreground">
                      {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label>Start Time</Label>
                      <input
                        type="time"
                        value={newSlot.start_time}
                        onChange={(e) =>
                          setNewSlot({ ...newSlot, start_time: e.target.value })
                        }
                        className="w-full h-10 px-4 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <input
                        type="time"
                        value={newSlot.end_time}
                        onChange={(e) =>
                          setNewSlot({ ...newSlot, end_time: e.target.value })
                        }
                        className="w-full h-10 px-4 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={addAvailability}
                    disabled={saving}
                    variant="hero"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Availability Slot
                  </Button>
                </div>

                {/* Existing slots for selected date */}
                {slotsForSelectedDate.length > 0 && (
                  <div className="p-4 rounded-xl bg-gradient-card border border-border">
                    <h4 className="font-semibold text-foreground mb-3">
                      Existing Slots
                    </h4>
                    <div className="space-y-2">
                      {slotsForSelectedDate.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="font-medium">
                              {slot.localStart} - {slot.localEnd}
                            </span>
                          </div>
                          <button
                            onClick={() => removeAvailability(slot.id)}
                            className="p-1 hover:text-destructive transition-colors"
                            disabled={saving}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 rounded-xl bg-secondary border border-border text-center">
                <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select a date from the calendar to add or view availability slots.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary of all availability */}
        {availability.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-card border border-border">
            <h4 className="font-semibold text-foreground mb-4">All Upcoming Availability</h4>
            <div className="space-y-2">
              {availability.map((av) => {
                const date = new Date(av.specific_date + 'T00:00:00');
                const localStart = utcTimeToLocal(av.start_time_utc, date);
                const localEnd = utcTimeToLocal(av.end_time_utc, date);
                return (
                  <div
                    key={av.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-medium">
                        {format(date, 'EEE, MMM d')}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{localStart} - {localEnd}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAvailability(av.id)}
                      className="p-1 hover:text-destructive transition-colors"
                      disabled={saving}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
