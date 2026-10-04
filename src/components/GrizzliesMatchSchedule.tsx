import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CricketGrizzliesPortalResponse } from "@/lib/cricketApi";
import { coachPlanHref } from "@/lib/grizzliesCoachPlan";
import { completedGrizzliesFixtures, formatGrizzliesFixtureDate } from "@/lib/grizzliesMatchPresentation";
import playoffFixtures from "../../config/grizzlies-2026-upcoming.json";

// Supplied Group B playoff schedule, 2026-10-04. Slash times are intentionally
// not interpreted as start/toss times or converted into a guessed timezone.
// Provenance and the verified final West record: docs/research/2026-10-04-west-completion-and-playoff-schedule.md.

export function GrizzliesMatchSchedule({ schedule }: { schedule: CricketGrizzliesPortalResponse["aiMatchAnalysis"] }) {
  const completed = completedGrizzliesFixtures(schedule.fixtures);

  return <div className="space-y-8">
    <section aria-labelledby="grizzlies-upcoming-heading" className="space-y-4">
      <header className="border-l-4 border-red-500 pl-4">
        <h2 id="grizzlies-upcoming-heading" className="font-display text-2xl font-bold">Upcoming Games</h2>
        <p className="mt-1 text-sm text-muted-foreground">Playoffs · Group B · October 21–23, 2026</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {playoffFixtures.map(fixture => <article key={fixture.date} className="flex min-w-0 flex-col rounded-xl border border-red-500/55 bg-card p-5">
          <p className="text-sm font-semibold text-red-300"><time dateTime={fixture.date}>{formatGrizzliesFixtureDate(fixture.date)}</time><span className="ml-2 font-normal text-muted-foreground">{fixture.day}</span></p>
          <h3 className="my-5 flex flex-1 flex-col gap-1 font-display text-xl font-bold leading-snug">
            <span>{fixture.homeTeam}</span>
            <span className="text-xs font-normal uppercase tracking-wider text-muted-foreground">vs</span>
            <span>{fixture.awayTeam}</span>
          </h3>
          <div className="space-y-2 border-t border-border pt-4 text-sm">
            <p className="flex items-center gap-2"><MapPin aria-hidden="true" className="h-4 w-4 text-red-400" />PVCC 5</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><CalendarDays aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><span>{fixture.time}</span><span className="text-xs text-muted-foreground">Time unconfirmed</span></p>
          </div>
          <Button asChild size="sm" variant="outline" className="mt-4 self-start border-red-500/55 text-red-300 hover:bg-red-500/10"><Link to={`/analytics/grizzlies/2026/game-plans/${fixture.key}`} aria-label={`View Game Plan against ${fixture.opponent}`}>View Game Plan <ArrowUpRight aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
        </article>)}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">From the supplied playoff schedule. Times are shown exactly as printed; exact start times and timezone await confirmation.</p>
    </section>

    <header className="flex flex-col gap-4 rounded-xl border border-red-500/40 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="font-display text-2xl font-bold">West Division complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">MiLC 2026 league stage concluded. Next: Group B playoffs.</p>
      </div>
      <div className="shrink-0 border-l-2 border-red-500 pl-4">
        <p className="font-display text-xl font-bold">Grizzlies unbeaten</p>
        <p className="mt-1 text-sm text-muted-foreground">4 wins, 0 losses</p>
      </div>
    </header>

    <section id="grizzlies-completed" aria-labelledby="grizzlies-completed-heading" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="border-l-4 border-border pl-4">
          <h2 id="grizzlies-completed-heading" className="font-display text-2xl font-bold">Completed Games</h2>
          <p className="mt-1 text-sm text-muted-foreground">West Division · {completed.length ? `${completed.length} completed games · Newest first` : "League results and archived analysis"}</p>
        </div>
        {schedule.officialScheduleUrl ? <Button asChild variant="outline" size="sm"><a href={schedule.officialScheduleUrl} target="_blank" rel="noreferrer">Official schedule <ExternalLink aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" /></a></Button> : null}
      </header>
      {completed.length ? <div className="grid gap-4 md:grid-cols-2">
        {completed.map(fixture => <article key={fixture.matchId} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{formatGrizzliesFixtureDate(fixture.startsAt || fixture.dateLabel)}{fixture.venue ? ` · ${fixture.venue}` : ""}</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Completed</span>
          </div>
          <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{fixture.homeTeam} <span className="px-1 text-sm font-normal text-muted-foreground">vs</span> {fixture.awayTeam}</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">{fixture.scoreline || fixture.resultText || "Result unavailable"}</p>
          {fixture.report.path ? <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline"><Link to={fixture.report.path}>Open AI Match Analysis <ArrowUpRight aria-hidden="true" className="ml-1.5 h-4 w-4" /></Link></Button>
            {Number(fixture.matchId) === 2375 ? <Button asChild size="sm" variant="outline" className="border-red-500/45 text-red-300 hover:bg-red-500/10"><Link to={coachPlanHref(fixture.matchId)!}>Archived Strikers game plan</Link></Button> : null}
          </div> : <p className="mt-auto pt-1 text-xs text-muted-foreground">AI analysis not published.</p>}
        </article>)}
      </div> : <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Completed results are currently unavailable from the protected service. Retry shortly.</p>}
    </section>
  </div>;
}
