import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, CheckCircle, XCircle, Calendar as CalendarIcon, Globe, MapPin } from "lucide-react";
import { Session, Coach, Player } from "@/types/coaching";
import { formatDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

interface SessionCalendarProps {
  sessions: Session[];
  userType: "coach" | "player";
  coaches?: Coach[];
  players?: Player[];
  timezone?: string;
  onConfirmSession?: (sessionId: string) => void;
  onCancelSession?: (sessionId: string) => void;
  compact?: boolean;
}

export function SessionCalendar({
  sessions,
  userType,
  coaches = [],
  players = [],
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onConfirmSession,
  onCancelSession,
  compact = false,
}: SessionCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Format time in user's timezone
  const formatTimeInTimezone = (date: Date | string, format: string = "h:mm a") => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    try {
      return formatInTimeZone(dateObj, timezone, format);
    } catch {
      return dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  };

  // Format date in user's timezone
  const formatDateInTimezone = (date: Date | string, format: string = "MMM d, yyyy") => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    try {
      return formatInTimeZone(dateObj, timezone, format);
    } catch {
      return dateObj.toLocaleDateString();
    }
  };

  // Get date string in user's timezone for grouping
  const getDateKeyInTimezone = (dateStr: string) => {
    try {
      const zonedDate = toZonedTime(new Date(dateStr), timezone);
      return formatInTimeZone(zonedDate, timezone, "yyyy-MM-dd");
    } catch {
      return new Date(dateStr).toISOString().split("T")[0];
    }
  };

  // Group sessions by date in user's timezone
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, Session[]> = {};
    sessions.forEach((session) => {
      const dateKey = getDateKeyInTimezone(session.session_date_time_utc);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });
    return grouped;
  }, [sessions, timezone]);

  // Get dates that have sessions
  const datesWithSessions = useMemo(() => {
    return Object.keys(sessionsByDate).map((dateStr) => new Date(dateStr));
  }, [sessionsByDate]);

  // Get sessions for selected date (in user's timezone)
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = formatInTimeZone(selectedDate, timezone, "yyyy-MM-dd");
    return sessionsByDate[dateKey] || [];
  }, [selectedDate, sessionsByDate, timezone]);

  // Filter upcoming sessions
  const upcomingSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter(
        (s) =>
          new Date(s.session_date_time_utc) > now &&
          s.status !== "canceled" &&
          s.status !== "completed"
      )
      .sort(
        (a, b) =>
          new Date(a.session_date_time_utc).getTime() -
          new Date(b.session_date_time_utc).getTime()
      )
      .slice(0, 5);
  }, [sessions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "completed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "canceled":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "completed":
        return "bg-blue-500";
      case "canceled":
        return "bg-red-500";
      default:
        return "bg-primary";
    }
  };

  const getCoachName = (coachId: string) => {
    return coaches.find((c) => c.id === coachId)?.name || "Coach";
  };

  const getPlayerName = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.name || "Player";
  };

  const getCoach = (coachId: string) => {
    return coaches.find((c) => c.id === coachId);
  };

  const getPlayer = (playerId: string) => {
    return players.find((p) => p.id === playerId);
  };

  // Check if a date has sessions
  const dateHasSessions = (date: Date) => {
    const dateKey = formatInTimeZone(date, timezone, "yyyy-MM-dd");
    return sessionsByDate[dateKey] && sessionsByDate[dateKey].length > 0;
  };

  // Get session status for a date (for dot color)
  const getDateSessionStatus = (date: Date) => {
    const dateKey = formatInTimeZone(date, timezone, "yyyy-MM-dd");
    const dateSessions = sessionsByDate[dateKey] || [];
    if (dateSessions.length === 0) return null;
    
    // Priority: confirmed > pending > completed > canceled
    if (dateSessions.some(s => s.status === "confirmed")) return "confirmed";
    if (dateSessions.some(s => s.status === "pending")) return "pending";
    if (dateSessions.some(s => s.status === "completed")) return "completed";
    return "canceled";
  };

  const renderSession = (session: Session) => {
    const isUpcoming =
      new Date(session.session_date_time_utc) > new Date() &&
      session.status !== "canceled" &&
      session.status !== "completed";
    const canAction = isUpcoming && (session.status === "pending" || session.status === "confirmed");

    return (
      <div
        key={session.id}
        className="p-4 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium text-foreground">
                {formatTimeInTimezone(session.session_date_time_utc)}
              </span>
              <Badge variant="outline" className={cn("text-xs", getStatusColor(session.status || "pending"))}>
                {session.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {userType === "coach"
                  ? getPlayerName(session.student_id)
                  : getCoachName(session.coach_id)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {session.duration_minutes} min session
            </div>
          </div>
          {canAction && (
            <div className="flex flex-col gap-1 shrink-0">
              {userType === "coach" && session.status === "pending" && onConfirmSession && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  onClick={() => onConfirmSession(session.id)}
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
              {onCancelSession && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => onCancelSession(session.id)}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom day content with dot indicator
  const renderDayContent = (day: Date) => {
    const hasSessions = dateHasSessions(day);
    const status = getDateSessionStatus(day);
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span>{day.getDate()}</span>
        {hasSessions && status && (
          <span 
            className={cn(
              "absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
              getStatusDotColor(status)
            )}
          />
        )}
      </div>
    );
  };

  // Compact version for home page
  if (compact) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Your Calendar
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              {timezone.split("/").pop()?.replace("_", " ")}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border pointer-events-auto mb-4"
            components={{
              DayContent: ({ date }) => renderDayContent(date),
            }}
          />

          {/* Session Details for Selected Date */}
          {selectedDate && (
            <div className="border-t border-border pt-3">
              <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                {formatDateInTimezone(selectedDate, "EEE, MMM d")}
              </h4>
              
              {selectedDateSessions.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedDateSessions
                    .sort(
                      (a, b) =>
                        new Date(a.session_date_time_utc).getTime() -
                        new Date(b.session_date_time_utc).getTime()
                    )
                    .map((session) => {
                      const otherPerson = userType === "coach" 
                        ? getPlayer(session.student_id)
                        : getCoach(session.coach_id);
                      
                      return (
                        <div
                          key={session.id}
                          className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                getStatusDotColor(session.status || "pending")
                              )} />
                              <span className="text-sm font-medium">
                                {formatTimeInTimezone(session.session_date_time_utc)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({session.duration_minutes} min)
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getStatusColor(session.status || "pending"))}
                            >
                              {session.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-foreground">
                                {userType === "coach"
                                  ? getPlayerName(session.student_id)
                                  : getCoachName(session.coach_id)}
                              </span>
                            </div>
                            {otherPerson?.location && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {otherPerson.location}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sessions scheduled
                </p>
              )}
            </div>
          )}
          
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Confirmed
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Pending
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full version for dashboard
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2 bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Session Calendar
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              {timezone.split("/").pop()?.replace("_", " ")}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border pointer-events-auto"
            components={{
              DayContent: ({ date }) => renderDayContent(date),
            }}
          />

          {/* Selected Date Sessions */}
          {selectedDate && (
            <div className="mt-6">
              <h4 className="font-semibold text-foreground mb-3">
                {formatDateInTimezone(selectedDate, "EEEE, MMMM d, yyyy")}
              </h4>
              {selectedDateSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No sessions scheduled for this date
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDateSessions
                    .sort(
                      (a, b) =>
                        new Date(a.session_date_time_utc).getTime() -
                        new Date(b.session_date_time_utc).getTime()
                    )
                    .map(renderSession)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Sessions Sidebar */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No upcoming sessions
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => {
                    const zonedDate = toZonedTime(new Date(session.session_date_time_utc), timezone);
                    setSelectedDate(zonedDate);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getStatusColor(session.status || "pending"))}
                    >
                      {session.status}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {formatDateInTimezone(session.session_date_time_utc, "EEE, MMM d")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimeInTimezone(session.session_date_time_utc)} • {session.duration_minutes} min
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {userType === "coach"
                      ? `with ${getPlayerName(session.student_id)}`
                      : `with ${getCoachName(session.coach_id)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
