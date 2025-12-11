import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Clock, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CoachAvailability } from "@/types/coaching";

interface AvailabilityEditorProps {
  coachId: string;
  timezone?: string;
}

const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function AvailabilityEditor({ coachId, timezone }: AvailabilityEditorProps) {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<CoachAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
  });

  const resolvedTimezone = useMemo(() => {
    // Use provided timezone if valid, otherwise default to browser timezone
    if (timezone && timezone.trim() !== '' && timezone !== 'UTC') {
      return timezone;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [timezone]);

  // Convert local time to UTC for storage
  const localTimeToUtc = (time: string, dayOfWeek: number): { time: string; dayOfWeek: number } => {
    // Create a reference date for the given day of week
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);
    
    // Parse the local time
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create date string and parse it as if it's in the target timezone
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateTimeStr = `${year}-${month}-${day}T${time}:00`;
    
    // Create a date object and get UTC values using timezone formatting
    const localDateTime = new Date(dateTimeStr);
    
    // Get the offset for the target timezone
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    // Calculate offset by comparing
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    // Create a date where we set it as local time in the target timezone
    // Then get what that time is in UTC
    const refDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
    const tzParts = tzFormatter.formatToParts(refDate);
    const utcParts = utcFormatter.formatToParts(refDate);
    
    const tzHour = parseInt(tzParts.find(p => p.type === 'hour')?.value || '0');
    const utcHour = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0');
    const offsetHours = tzHour - utcHour;
    
    // Convert local hours to UTC
    let utcHours = hours - offsetHours;
    let utcDayOfWeek = dayOfWeek;
    
    if (utcHours < 0) {
      utcHours += 24;
      utcDayOfWeek = (dayOfWeek - 1 + 7) % 7;
    } else if (utcHours >= 24) {
      utcHours -= 24;
      utcDayOfWeek = (dayOfWeek + 1) % 7;
    }
    
    return {
      time: `${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      dayOfWeek: utcDayOfWeek,
    };
  };

  // Convert UTC time to local time for display
  const utcTimeToLocal = (time: string, dayOfWeek: number): { time: string; dayOfWeek: number } => {
    // Parse the UTC time
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a reference date in UTC
    const now = new Date();
    const currentDay = now.getUTCDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;
    const refDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilTarget, hours, minutes, 0));
    
    // Format in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTimezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(refDate);
    const localHour = parts.find(p => p.type === 'hour')?.value || '00';
    const localMinute = parts.find(p => p.type === 'minute')?.value || '00';
    
    // Get the local day
    const localDate = new Date(refDate.toLocaleString('en-US', { timeZone: resolvedTimezone }));
    const localDayOfWeek = localDate.getDay();
    
    return {
      time: `${localHour}:${localMinute}`,
      dayOfWeek: localDayOfWeek,
    };
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
        .order("day_of_week", { ascending: true })
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
    if (newSlot.start_time >= newSlot.end_time) {
      toast({
        title: "Invalid Time",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    // Convert local times to UTC
    const startUtc = localTimeToUtc(newSlot.start_time, newSlot.day_of_week);
    const endUtc = localTimeToUtc(newSlot.end_time, newSlot.day_of_week);

    // Check for overlap using the UTC day
    const overlaps = availability.some(
      (av) =>
        av.day_of_week === startUtc.dayOfWeek &&
        ((startUtc.time >= av.start_time_utc &&
          startUtc.time < av.end_time_utc) ||
          (endUtc.time > av.start_time_utc &&
            endUtc.time <= av.end_time_utc) ||
          (startUtc.time <= av.start_time_utc &&
            endUtc.time >= av.end_time_utc))
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
          day_of_week: startUtc.dayOfWeek,
          start_time_utc: startUtc.time,
          end_time_utc: endUtc.time,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Availability Added",
        description: "New time slot has been added.",
      });

      setNewSlot({
        day_of_week: 1,
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

  const groupByDay = (avs: CoachAvailability[]) => {
    const grouped: Record<number, CoachAvailability[]> = {};
    avs.forEach((av) => {
      if (!grouped[av.day_of_week]) {
        grouped[av.day_of_week] = [];
      }
      grouped[av.day_of_week].push(av);
    });
    return grouped;
  };

  const grouped = groupByDay(availability);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  // Group availability by local day (converting from UTC)
  const groupByLocalDay = (avs: CoachAvailability[]) => {
    const grouped: Record<number, { slot: CoachAvailability; localStart: string; localEnd: string }[]> = {};
    
    avs.forEach((av) => {
      const localStart = utcTimeToLocal(av.start_time_utc, av.day_of_week);
      const localEnd = utcTimeToLocal(av.end_time_utc, av.day_of_week);
      // Use the local day from the conversion
      const localDay = localStart.dayOfWeek;
      
      if (!grouped[localDay]) {
        grouped[localDay] = [];
      }
      grouped[localDay].push({
        slot: av,
        localStart: localStart.time,
        localEnd: localEnd.time,
      });
    });
    
    return grouped;
  };

  const groupedLocal = groupByLocalDay(availability);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-foreground">
            Weekly Availability
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            {resolvedTimezone}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Set your recurring weekly availability. Times are shown in your timezone.
        </p>

        {/* Add New Slot */}
        <div className="p-4 rounded-xl bg-secondary border border-border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Day</Label>
              <select
                value={newSlot.day_of_week}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })
                }
                className="w-full h-10 px-4 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="flex items-end">
              <Button
                onClick={addAvailability}
                disabled={saving}
                variant="hero"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Slot
              </Button>
            </div>
          </div>
        </div>

        {/* Display Availability */}
        <div className="space-y-4">
          {daysOfWeek.map((day) => {
            const daySlots = groupedLocal[day.value] || [];
            return (
              <div
                key={day.value}
                className="p-4 rounded-xl bg-gradient-card border border-border"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-foreground">{day.label}</h4>
                  {daySlots.length === 0 && (
                    <span className="text-sm text-muted-foreground">Not available</span>
                  )}
                </div>
                {daySlots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map(({ slot, localStart, localEnd }) => (
                      <Badge
                        key={slot.id}
                        variant="secondary"
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
                        <Clock className="w-3 h-3" />
                        {localStart} - {localEnd}
                        <button
                          onClick={() => removeAvailability(slot.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

