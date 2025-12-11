/**
 * Scheduling and availability utilities
 */

import { CoachAvailability, BlockedDate, Session, TimeSlot, WeeklyAvailability } from "@/types/coaching";

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

/**
 * Check if a date is blocked
 */
export function isDateBlocked(
  date: Date,
  blockedDates: BlockedDate[]
): boolean {
  const dateStr = date.toISOString().split('T')[0];
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
    const availEnd = timeToMinutes(av.end_time_utc);
    
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
  slotIntervalMinutes: number = 30
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  // Check if date is blocked
  if (isDateBlocked(date, blockedDates)) {
    return slots;
  }
  
  const dateStr = date.toISOString().split('T')[0];
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
    const endMinutes = timeToMinutes(av.end_time_utc);
    
    let currentMinutes = startMinutes;
    
    while (currentMinutes + durationMinutes <= endMinutes) {
      const slotStart = new Date(date);
      slotStart.setUTCHours(Math.floor(currentMinutes / 60));
      slotStart.setUTCMinutes(currentMinutes % 60);
      slotStart.setUTCSeconds(0);
      slotStart.setUTCMilliseconds(0);
      
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

