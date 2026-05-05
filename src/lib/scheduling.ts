/**
 * Scheduling and availability utilities
 */

import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { CoachAvailability, BlockedDate, Session, TimeSlot, WeeklyAvailability } from "@/types/coaching";

interface GenerateTimeSlotsOptions {
  coachTimezone?: string;
  displayTimezone?: string;
}

/**
 * Get day of week from date (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateKeyInTimezone(date: Date, timezone?: string): string {
  return timezone ? formatInTimeZone(date, timezone, "yyyy-MM-dd") : getDateKey(date);
}

function getDayOfWeekFromDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function buildUtcDate(dateKey: string, time: string, dayOffset: number = 0): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, hours, minutes, 0, 0));
}

function resolveUtcDateForCoachLocalDate(dateKey: string, utcTime: string, coachTimezone: string): Date {
  for (const dayOffset of [-1, 0, 1]) {
    const candidate = buildUtcDate(dateKey, utcTime, dayOffset);
    if (formatInTimeZone(candidate, coachTimezone, "yyyy-MM-dd") === dateKey) {
      return candidate;
    }
  }

  return buildUtcDate(dateKey, utcTime);
}

function getCandidateCoachDateKeys(date: Date, coachTimezone: string): string[] {
  return Array.from(
    new Set(
      [-1, 0, 1].map((dayOffset) => formatInTimeZone(addDays(date, dayOffset), coachTimezone, "yyyy-MM-dd")),
    ),
  );
}

/**
 * Check if a date is blocked
 */
export function isDateBlocked(
  date: Date,
  blockedDates: BlockedDate[]
): boolean {
  const dateStr = getDateKey(date);
  return blockedDates.some(bd => bd.blocked_date === dateStr);
}

/**
 * Check if a time slot conflicts with existing sessions
 */
export function hasTimeConflict(
  startTime: Date,
  durationMinutes: number,
  existingSessions: Session[],
  bufferMinutes: number = 0
): boolean {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
  const bufferMs = bufferMinutes * 60000;
  
  return existingSessions.some(session => {
    if (session.status === 'canceled') return false;
    
    const sessionStart = new Date(session.session_date_time_utc);
    const sessionEnd = new Date(
      sessionStart.getTime() + session.duration_minutes * 60000
    );
    
    // Check for overlap with buffer
    return (
      (startTime.getTime() - bufferMs < sessionEnd.getTime() &&
       endTime.getTime() + bufferMs > sessionStart.getTime())
    );
  });
}

/**
 * Check if a time slot is within coach availability
 * Supports both specific_date and day_of_week based availability
 */
export function isWithinAvailability(
  dateTime: Date,
  availability: CoachAvailability[],
  durationMinutes: number
): boolean {
  const dateStr = dateTime.toISOString().split('T')[0];
  const dayOfWeek = getDayOfWeek(dateTime);
  const timeStr = dateTime.toISOString().split('T')[1].slice(0, 5); // HH:MM format
  
  // First check for specific date availability
  let matchingAvailability = availability.filter(av => 
    av.specific_date === dateStr
  );
  
  // Fall back to day-of-week availability if no specific date found
  if (matchingAvailability.length === 0) {
    matchingAvailability = availability.filter(av => 
      !av.specific_date && av.day_of_week === dayOfWeek
    );
  }
  
  if (matchingAvailability.length === 0) return false;
  
  const slotStartMinutes = timeToMinutes(timeStr);
  const slotEndMinutes = slotStartMinutes + durationMinutes;
  
  return matchingAvailability.some(av => {
    const availStart = timeToMinutes(av.start_time_utc);
    let availEnd = timeToMinutes(av.end_time_utc);
    
    // Handle midnight crossing
    if (availEnd <= availStart) {
      availEnd += 24 * 60;
    }
    
    return slotStartMinutes >= availStart && slotEndMinutes <= availEnd;
  });
}

/**
 * Generate available time slots for a date
 * Supports both specific_date and day_of_week based availability
 */
export function generateTimeSlots(
  date: Date,
  availability: CoachAvailability[],
  existingSessions: Session[],
  blockedDates: BlockedDate[],
  durationMinutes: number = 60,
  bufferMinutes: number = 0,
  slotIntervalMinutes: number = 30,
  options: GenerateTimeSlotsOptions = {}
): TimeSlot[] {
  const { coachTimezone, displayTimezone } = options;

  if (coachTimezone) {
    const selectedDateKey = getDateKeyInTimezone(date, displayTimezone ?? coachTimezone);
    const slotDurationMs = durationMinutes * 60000;
    const slotIntervalMs = slotIntervalMinutes * 60000;
    const slotsByStart = new Map<number, TimeSlot>();

    availability.forEach((availabilityWindow) => {
      const coachDateKeys = availabilityWindow.specific_date
        ? [availabilityWindow.specific_date]
        : getCandidateCoachDateKeys(date, coachTimezone).filter(
            (coachDateKey) => getDayOfWeekFromDateKey(coachDateKey) === availabilityWindow.day_of_week,
          );

      coachDateKeys.forEach((coachDateKey) => {
        if (blockedDates.some((blockedDate) => blockedDate.blocked_date === coachDateKey)) {
          return;
        }

        let slotStart = resolveUtcDateForCoachLocalDate(
          coachDateKey,
          availabilityWindow.start_time_utc,
          coachTimezone,
        );
        let slotBoundaryEnd = resolveUtcDateForCoachLocalDate(
          coachDateKey,
          availabilityWindow.end_time_utc,
          coachTimezone,
        );

        if (slotBoundaryEnd.getTime() <= slotStart.getTime()) {
          slotBoundaryEnd = addDays(slotBoundaryEnd, 1);
        }

        while (slotStart.getTime() + slotDurationMs <= slotBoundaryEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
          const displayDateKey = getDateKeyInTimezone(slotStart, displayTimezone ?? coachTimezone);

          if (displayDateKey === selectedDateKey) {
            const hasConflict = hasTimeConflict(slotStart, durationMinutes, existingSessions, bufferMinutes);
            const slotStartTime = slotStart.getTime();

            if (!slotsByStart.has(slotStartTime)) {
              slotsByStart.set(slotStartTime, {
                start: new Date(slotStart),
                end: slotEnd,
                available: !hasConflict,
                existing_session: existingSessions.find((session) => {
                  const sessionStart = new Date(session.session_date_time_utc);
                  return sessionStart.getTime() === slotStartTime;
                }),
              });
            }
          }

          slotStart = new Date(slotStart.getTime() + slotIntervalMs);
        }
      });
    });

    return Array.from(slotsByStart.values()).sort((left, right) => left.start.getTime() - right.start.getTime());
  }

  const slots: TimeSlot[] = [];
  
  // Check if date is blocked
  if (isDateBlocked(date, blockedDates)) {
    return slots;
  }
  
  const dateStr = getDateKey(date);
  const dayOfWeek = getDayOfWeek(date);
  
  // First check for specific date availability
  let matchingAvailability = availability.filter(av => 
    av.specific_date === dateStr
  );
  
  // Fall back to day-of-week availability if no specific date found
  if (matchingAvailability.length === 0) {
    matchingAvailability = availability.filter(av => 
      !av.specific_date && av.day_of_week === dayOfWeek
    );
  }
  
  if (matchingAvailability.length === 0) {
    return slots;
  }
  
  // Generate slots for each availability block
  matchingAvailability.forEach(av => {
    const startMinutes = timeToMinutes(av.start_time_utc);
    let endMinutes = timeToMinutes(av.end_time_utc);
    
    // Handle midnight crossing (e.g., 17:00-01:00 means end is next day)
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours worth of minutes
    }
    
    let currentMinutes = startMinutes;
    
    while (currentMinutes + durationMinutes <= endMinutes) {
      const slotStart = new Date(date);
      const hours = Math.floor(currentMinutes / 60) % 24;
      const mins = currentMinutes % 60;
      slotStart.setUTCHours(hours);
      slotStart.setUTCMinutes(mins);
      slotStart.setUTCSeconds(0);
      slotStart.setUTCMilliseconds(0);
      
      // If we've crossed midnight, add a day
      if (currentMinutes >= 24 * 60) {
        slotStart.setUTCDate(slotStart.getUTCDate() + 1);
      }
      
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
      
      const hasConflict = hasTimeConflict(slotStart, durationMinutes, existingSessions, bufferMinutes);
      
      slots.push({
        start: slotStart,
        end: slotEnd,
        available: !hasConflict,
        existing_session: existingSessions.find(s => {
          const sStart = new Date(s.session_date_time_utc);
          return sStart.getTime() === slotStart.getTime();
        }),
      });
      
      currentMinutes += slotIntervalMinutes;
    }
  });
  
  return slots;
}

/**
 * Convert weekly availability to structured format
 */
export function formatWeeklyAvailability(
  availability: CoachAvailability[]
): WeeklyAvailability[] {
  return availability.map(av => ({
    day_of_week: av.day_of_week,
    start_time: av.start_time_utc,
    end_time: av.end_time_utc,
  }));
}

/**
 * Check if session can be canceled (24 hours before)
 */
export function canCancelSession(session: Session): boolean {
  const sessionTime = new Date(session.session_date_time_utc);
  const now = new Date();
  const hoursUntilSession = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return hoursUntilSession >= 24;
}

/**
 * Check if cancellation is late
 */
export function isLateCancellation(session: Session): boolean {
  if (session.status !== 'canceled') return false;
  if (!session.canceled_at) return false;
  
  const sessionTime = new Date(session.session_date_time_utc);
  const canceledTime = new Date(session.canceled_at);
  const hoursBeforeSession = (sessionTime.getTime() - canceledTime.getTime()) / (1000 * 60 * 60);
  
  return hoursBeforeSession < 24;
}

/**
 * Format time slot for display in user's timezone
 */
export function formatTimeSlot(
  slot: TimeSlot,
  timezone: string
): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  return formatter.format(slot.start);
}
