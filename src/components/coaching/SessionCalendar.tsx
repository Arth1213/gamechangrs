import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, CheckCircle, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { Session, Coach, Player } from "@/types/coaching";
import { formatDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface SessionCalendarProps {
  sessions: Session[];
  userType: "coach" | "player";
  coaches?: Coach[];
  players?: Player[];
  onConfirmSession?: (sessionId: string) => void;
  onCancelSession?: (sessionId: string) => void;
}

export function SessionCalendar({
  sessions,
  userType,
  coaches = [],
  players = [],
  onConfirmSession,
  onCancelSession,
}: SessionCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, Session[]> = {};
    sessions.forEach((session) => {
      const dateStr = new Date(session.session_date_time_utc).toISOString().split("T")[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(session);
    });
    return grouped;
  }, [sessions]);

  // Get dates that have sessions
  const datesWithSessions = useMemo(() => {
    return Object.keys(sessionsByDate).map((dateStr) => new Date(dateStr));
  }, [sessionsByDate]);

  // Get sessions for selected date
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split("T")[0];
    return sessionsByDate[dateStr] || [];
  }, [selectedDate, sessionsByDate]);

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

  const getCoachName = (coachId: string) => {
    return coaches.find((c) => c.id === coachId)?.name || "Coach";
  };

  const getPlayerName = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.name || "Player";
  };

  const renderSession = (session: Session) => {
    const sessionTime = new Date(session.session_date_time_utc);
    const isUpcoming =
      sessionTime > new Date() &&
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
                {sessionTime.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2 bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Session Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border pointer-events-auto"
            modifiers={{
              hasSession: datesWithSessions,
            }}
            modifiersStyles={{
              hasSession: {
                fontWeight: "bold",
                backgroundColor: "hsl(var(--primary) / 0.2)",
                borderRadius: "50%",
              },
            }}
          />

          {/* Selected Date Sessions */}
          {selectedDate && (
            <div className="mt-6">
              <h4 className="font-semibold text-foreground mb-3">
                {formatDate(selectedDate, "long")}
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
              {upcomingSessions.map((session) => {
                const sessionTime = new Date(session.session_date_time_utc);
                return (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedDate(sessionTime)}
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
                      {formatDate(sessionTime, "short")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sessionTime.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      • {session.duration_minutes} min
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {userType === "coach"
                        ? `with ${getPlayerName(session.student_id)}`
                        : `with ${getCoachName(session.coach_id)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
