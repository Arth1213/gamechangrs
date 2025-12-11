import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CoachAvailability } from "@/types/coaching";

interface AvailabilityEditorProps {
  coachId: string;
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

export function AvailabilityEditor({ coachId }: AvailabilityEditorProps) {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<CoachAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day_of_week: 1,
    start_time_utc: "09:00",
    end_time_utc: "17:00",
  });

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
    if (newSlot.start_time_utc >= newSlot.end_time_utc) {
      toast({
        title: "Invalid Time",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    // Check for overlap
    const overlaps = availability.some(
      (av) =>
        av.day_of_week === newSlot.day_of_week &&
        ((newSlot.start_time_utc >= av.start_time_utc &&
          newSlot.start_time_utc < av.end_time_utc) ||
          (newSlot.end_time_utc > av.start_time_utc &&
            newSlot.end_time_utc <= av.end_time_utc) ||
          (newSlot.start_time_utc <= av.start_time_utc &&
            newSlot.end_time_utc >= av.end_time_utc))
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
          ...newSlot,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Availability Added",
        description: "New time slot has been added.",
      });

      setNewSlot({
        day_of_week: 1,
        start_time_utc: "09:00",
        end_time_utc: "17:00",
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl font-bold text-foreground mb-4">
          Weekly Availability
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Set your recurring weekly availability. Times are stored in UTC.
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
              <Label>Start Time (UTC)</Label>
              <input
                type="time"
                value={newSlot.start_time_utc}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, start_time_utc: e.target.value })
                }
                className="w-full h-10 px-4 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
              />
            </div>
            <div>
              <Label>End Time (UTC)</Label>
              <input
                type="time"
                value={newSlot.end_time_utc}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, end_time_utc: e.target.value })
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
            const daySlots = grouped[day.value] || [];
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
                    {daySlots.map((slot) => (
                      <Badge
                        key={slot.id}
                        variant="secondary"
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
                        <Clock className="w-3 h-3" />
                        {slot.start_time_utc} - {slot.end_time_utc} UTC
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

