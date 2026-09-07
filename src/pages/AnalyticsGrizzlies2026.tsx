import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ExternalLink, Lock, Loader2, ShieldAlert } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { CricketGrizzliesPortalResponse, fetchGrizzliesPortal } from "@/lib/cricketApi";
import { grizzliesPortalFallback } from "@/lib/grizzliesPortalFallback";
import { minorLeagueLaunch } from "@/lib/grizzliesPortalPresentation";

type PortalPlayer = CricketGrizzliesPortalResponse["teams"][number]["players"][number];

function sortPlayersByNccaAvailability(players: PortalPlayer[]) {
  return [...players].sort((left, right) => {
    const leftHasData = left.nccaStatus === "matched" || Boolean(left.assessmentPath || left.threatPath || left.cricclubsProfileUrl);
    const rightHasData = right.nccaStatus === "matched" || Boolean(right.assessmentPath || right.threatPath || right.cricclubsProfileUrl);
    return Number(rightHasData) - Number(leftHasData);
  });
}

function threatButtonClass(tone: PortalPlayer["threatTone"]) {
  if (tone === "red") return "border border-red-500 bg-transparent text-white hover:bg-red-500/15";
  if (tone === "amber") return "border border-amber-400 bg-transparent text-white hover:bg-amber-400/15";
  return "border border-emerald-500 bg-transparent text-white hover:bg-emerald-500/15";
}

function PlayerLinks({ player }: { player: PortalPlayer }) {
  return (
    <div className="flex flex-wrap gap-2">
      {player.cricclubsProfileUrl ? <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs"><a href={player.cricclubsProfileUrl} target="_blank" rel="noreferrer">CricClubs</a></Button> : null}
      {player.assessmentPath ? <Button asChild size="sm" className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500"><Link to={player.assessmentPath}>Assessment</Link></Button> : null}
      {player.threatPath ? <Button asChild size="sm" className={`h-8 px-2.5 text-xs ${threatButtonClass(player.threatTone)}`}><Link to={player.threatPath}>Threat</Link></Button> : null}
      {!player.cricclubsProfileUrl && !player.assessmentPath && !player.threatPath ? <span className="text-xs text-muted-foreground">NCCA data not found</span> : null}
    </div>
  );
}

function SquadPanel({ team, className }: { team: CricketGrizzliesPortalResponse["teams"][number]; className: string }) {
  const players = sortPlayersByNccaAvailability(team.players);
  return (
    <section className={`overflow-hidden rounded-xl border shadow-sm ${className}`}>
      <header className="flex items-center justify-between border-b border-current/15 px-4 py-4">
        <h2 className="font-display text-2xl font-bold">{team.name}</h2>
        <div className="rounded-full border border-current/20 bg-background/70 px-2.5 py-1 text-xs font-semibold">{team.players.length} Players</div>
      </header>
      <div className="hidden max-h-[640px] overflow-y-auto bg-background/70 lg:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background"><TableRow className="border-b"><TableHead className="w-[42%]">Player</TableHead><TableHead>Intelligence</TableHead></TableRow></TableHeader>
          <TableBody>{players.map((player) => <TableRow key={player.name} className="border-b last:border-b-0 align-top"><TableCell className="py-3"><p className="font-semibold leading-tight">{player.name}</p><p className="mt-1 text-xs text-muted-foreground">{player.rosterCategory}</p></TableCell><TableCell className="py-3"><PlayerLinks player={player} /></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="space-y-3 bg-background/70 p-3 lg:hidden">
        {players.map((player) => <article key={player.name} className="rounded-lg border border-border/80 bg-background/80 p-3"><p className="font-semibold leading-tight">{player.name}</p><p className="mt-1 text-xs text-muted-foreground">{player.rosterCategory}</p><div className="mt-3"><PlayerLinks player={player} /></div></article>)}
      </div>
    </section>
  );
}

export default function AnalyticsGrizzlies2026() {
  const { session } = useAuth();
  const [data, setData] = useState<CricketGrizzliesPortalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portal = data ?? grizzliesPortalFallback;
  const squadStyle = (name: string) => name.includes("Strikers") ? "border-sky-500/45 bg-sky-500/5" : name.includes("Blazers") ? "border-orange-500/45 bg-orange-500/5" : "border-red-500/45 bg-red-500/5";

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
        <section className="flex flex-col gap-5 md:flex-row md:items-center"><img src="/grizzlies-2026-logo.png" alt="San Ramon Grizzlies" className="h-24 w-24 object-contain" /><div><p className="text-xs font-semibold uppercase tracking-[.24em] text-primary">2026 Minor League</p><h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">Grizzlies 2026 Analytics</h1><p className="mt-1 font-display text-xl font-semibold text-primary md:text-2xl">Powered by GameChangrs</p><p className="mt-3 text-muted-foreground">Welcome to the 2026 Grizzlies Season.</p></div></section>
        {!session ? <Card><CardContent className="flex gap-3 py-10"><Lock />Sign in with an approved Gmail account to view this portal.</CardContent></Card> : null}
        {!data && session && !error ? <Card><CardContent className="flex gap-3 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Using the verified roster fallback while the protected portal service is unavailable.</CardContent></Card> : null}
        {error ? <Card className="border-amber-500/50"><CardContent className="flex gap-3 py-5 text-sm text-muted-foreground"><ShieldAlert className="h-4 w-4 text-amber-500" />Using the verified roster fallback while the protected portal service is deployed.</CardContent></Card> : null}
        <Tabs defaultValue="squad">
          <TabsList><TabsTrigger value="squad">Squad Intelligence</TabsTrigger><TabsTrigger value="analysis">AI Match Analysis</TabsTrigger></TabsList>
          <TabsContent value="squad" className="mt-6"><div className="grid gap-5 lg:grid-cols-3 lg:items-start">{portal.teams.map((team) => <SquadPanel key={team.name} team={team} className={squadStyle(team.name)} />)}</div></TabsContent>
          <TabsContent value="analysis" className="mt-6 space-y-6">
            <Card className="border-red-500/35 bg-gradient-to-b from-red-500/[.10] to-background shadow-[0_20px_70px_-45px_rgba(239,68,68,.8)]"><CardContent className="flex flex-col items-center px-6 py-14 text-center md:py-16"><div className="mb-5 flex h-24 w-32 items-center justify-center rounded-2xl border border-red-500/30 bg-black/25 p-3"><img src="/milc-2026-mark.png" alt="Minor League Cricket" className="max-h-full max-w-full object-contain" /></div><p className="text-xs font-semibold uppercase tracking-[.22em] text-red-400">Minor League Cricket</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">{minorLeagueLaunch.heading}</h2><p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg">{minorLeagueLaunch.supportingText}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0"><div><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-red-400" />West Division Schedule</CardTitle><CardDescription className="mt-2">2026 opening fixtures shown below. The official MiLC schedule remains the source of record.</CardDescription></div><Button asChild variant="outline" size="sm" className="shrink-0"><a href={minorLeagueLaunch.officialScheduleUrl} target="_blank" rel="noreferrer">Official schedule <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a></Button></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2">{minorLeagueLaunch.fixtures.map((fixture) => <article key={`${fixture.date}-${fixture.homeTeam}-${fixture.awayTeam}`} className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-sm font-semibold text-red-300">{fixture.date} · {fixture.venue}</p><p className="mt-2 font-display text-lg font-semibold">{fixture.homeTeam} <span className="px-1 text-sm font-normal text-muted-foreground">vs</span> {fixture.awayTeam}</p></article>)}</div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
