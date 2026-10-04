import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock, Loader2, ShieldAlert } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { CricketGrizzliesPortalResponse, fetchGrizzliesPortal } from "@/lib/cricketApi";
import { grizzliesPortalFallback } from "@/lib/grizzliesPortalFallback";
import { cricclubsPlayerNameHref } from "@/lib/grizzliesPlayerLink";
import { assessmentButtonClass, threatButtonClass } from "@/lib/grizzliesSquadActions";
import { grizzliesPoweredBy } from "@/lib/grizzliesBranding";
import { grizzliesWelcomeHeader } from "@/lib/grizzliesWelcome";
import { formatGrizzliesFixtureDate } from "@/lib/grizzliesMatchPresentation";
import { GrizzliesPlayoffCalculator } from "@/components/GrizzliesPlayoffCalculator";
import { GrizzliesMatchSchedule } from "@/components/GrizzliesMatchSchedule";
import { groupGrizzliesSquads, playerReportNote, sortPlayersByReportAvailability } from "@/lib/grizzliesSquadSections";

type PortalPlayer = CricketGrizzliesPortalResponse["teams"][number]["players"][number];

function PlayerLinks({ player }: { player: PortalPlayer }) {
  const note = playerReportNote(player);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
      {player.threatPath ? <Button asChild size="sm" className={`h-8 px-2.5 text-xs ${threatButtonClass(player.threatTone)}`}><Link to={player.threatPath}>Threat</Link></Button> : null}
      {player.assessmentPath ? <Button asChild size="sm" className={`h-8 px-2.5 text-xs ${assessmentButtonClass}`}><Link to={player.assessmentPath}>Assessment</Link></Button> : null}
      </div>
      {note ? <p className={`text-xs leading-relaxed ${player.dataStatus === "identity_review" ? "text-amber-300" : "text-muted-foreground"}`}>{note}</p> : null}
    </div>
  );
}

function SquadPanel({ team, className }: { team: CricketGrizzliesPortalResponse["teams"][number]; className: string }) {
  const players = sortPlayersByReportAvailability(team.players);
  return (
    <section aria-label={team.name} className={`min-w-0 overflow-hidden rounded-xl border shadow-sm ${className}`}>
      <header className="border-b border-current/15 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl font-bold leading-tight">{team.name}</h3>
          {team.players.length ? <span className="shrink-0 rounded-full border border-current/20 bg-background/70 px-2.5 py-1 text-xs font-semibold">{team.players.length} players</span> : null}
        </div>
        {team.section === "playoffs" && team.latestMatchDate ? <p className="mt-2 text-xs text-muted-foreground">Latest recorded game: {formatGrizzliesFixtureDate(team.latestMatchDate)}</p> : null}
      </header>
      {!players.length ? <p className="bg-background/70 p-5 text-sm text-muted-foreground">Player reports are unavailable from the portal service. Retry shortly.</p> : <>
      <div className="hidden max-h-[640px] overflow-y-auto bg-background/70 lg:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background"><TableRow className="border-b"><TableHead className="w-[42%]">Player</TableHead><TableHead>Intelligence</TableHead></TableRow></TableHeader>
          <TableBody>{players.map((player) => <TableRow key={player.name} className="border-b last:border-b-0 align-top"><TableCell className="py-3">{cricclubsPlayerNameHref(player) ? <a href={cricclubsPlayerNameHref(player) || undefined} target="_blank" rel="noreferrer" className="font-semibold leading-tight text-foreground underline-offset-4 hover:text-primary hover:underline">{player.name}</a> : <p className="font-semibold leading-tight">{player.name}</p>}<p className="mt-1 text-xs text-muted-foreground">{player.rosterCategory}</p></TableCell><TableCell className="py-3"><PlayerLinks player={player} /></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="space-y-3 bg-background/70 p-3 lg:hidden">
        {players.map((player) => <article key={player.name} className="rounded-lg border border-border/80 bg-background/80 p-3">{cricclubsPlayerNameHref(player) ? <a href={cricclubsPlayerNameHref(player) || undefined} target="_blank" rel="noreferrer" className="font-semibold leading-tight text-foreground underline-offset-4 hover:text-primary hover:underline">{player.name}</a> : <p className="font-semibold leading-tight">{player.name}</p>}<p className="mt-1 text-xs text-muted-foreground">{player.rosterCategory}</p><div className="mt-3"><PlayerLinks player={player} /></div></article>)}
      </div>
      </>}
    </section>
  );
}

export function GrizzliesSquadIntelligence({ teams }: { teams: CricketGrizzliesPortalResponse["teams"] }) {
  const groups = groupGrizzliesSquads(teams);
  return <div className="space-y-10">
    <nav aria-label="Squad sections" className="flex flex-wrap gap-2">
      {groups.map(group => <a key={group.id} href={`#squad-${group.id}`} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-red-400/70 hover:bg-red-500/10">{group.title}</a>)}
    </nav>
    {groups.map(group => <section key={group.id} id={`squad-${group.id}`} aria-labelledby={`squad-heading-${group.id}`} className="scroll-mt-28 space-y-4">
      <header className="border-l-4 border-red-500 pl-4">
        <h2 id={`squad-heading-${group.id}`} className="font-display text-2xl font-bold">{group.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
      </header>
      <div className={`grid gap-5 lg:items-start ${group.id === "playoffs" ? "lg:grid-cols-3" : group.id === "division" ? "lg:grid-cols-2" : "lg:max-w-2xl"}`}>
        {group.teams.map(team => <SquadPanel key={team.name} team={team} className={group.id === "playoffs" ? "border-red-500/55 bg-card" : "border-border bg-card"} />)}
      </div>
    </section>)}
  </div>;
}

export default function AnalyticsGrizzlies2026() {
  const { session, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ['analysis', 'playoff'].includes(searchParams.get('tab') || '') ? searchParams.get('tab')! : 'squad';
  const [data, setData] = useState<CricketGrizzliesPortalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portal = data ?? grizzliesPortalFallback;
  const welcome = grizzliesWelcomeHeader(user);

  useEffect(() => {
    if (!session?.access_token) return;
    const controller = new AbortController();
    fetchGrizzliesPortal(session.access_token, controller.signal).then(setData).catch((reason) => setError(reason.message));
    return () => controller.abort();
  }, [session?.access_token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container space-y-8 pb-16 pt-28">
        <section className="flex flex-col gap-5 md:flex-row md:items-center"><img src="/grizzlies-2026-logo.png" alt="San Ramon Grizzlies" className="h-24 w-24 object-contain" /><div className="min-w-0 flex-1"><h1 className="font-display text-4xl font-bold leading-tight md:text-5xl"><span className="text-red-500">Grizzlies</span> 2026 Analytics</h1><div className="mt-1 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between"><p className="font-display text-xl font-semibold md:text-2xl"><span className="text-foreground">{grizzliesPoweredBy.prefix}</span><span className="text-gradient-primary">{grizzliesPoweredBy.accent}</span></p><p className="font-display text-xl font-bold leading-tight text-white md:text-2xl"><span>{welcome.greetingPrefix}</span>{welcome.greetingName ? <span className="text-gradient-primary">{welcome.greetingName}</span> : null}</p></div></div></section>
        {!session ? <Card><CardContent className="flex gap-3 py-10"><Lock />Sign in with an approved Gmail account to view this portal.</CardContent></Card> : null}
        {!data && session && !error ? <Card><CardContent className="flex gap-3 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Using the verified roster fallback while the protected portal service is unavailable.</CardContent></Card> : null}
        {error ? <Card className="border-amber-500/50"><CardContent className="flex gap-3 py-5 text-sm text-muted-foreground"><ShieldAlert className="h-4 w-4 text-amber-500" />Using the verified roster fallback while the protected portal service is deployed.</CardContent></Card> : null}
        <Tabs value={activeTab} onValueChange={tab => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('tab', tab); return next; }, { replace: true })}>
          <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="squad">Squad Intelligence</TabsTrigger><TabsTrigger value="analysis">AI Match Analysis</TabsTrigger><TabsTrigger value="playoff">Playoff calculator</TabsTrigger></TabsList>
          <TabsContent value="squad" className="mt-6"><GrizzliesSquadIntelligence teams={portal.teams} /></TabsContent>
          <TabsContent value="analysis" className="mt-6"><GrizzliesMatchSchedule schedule={portal.aiMatchAnalysis} /></TabsContent>
          <TabsContent value="playoff" className="mt-6"><GrizzliesPlayoffCalculator /></TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
