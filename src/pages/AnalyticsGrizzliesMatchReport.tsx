import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { CricketGrizzliesMatchAnalysisResponse, fetchGrizzliesMatchAnalysis } from "@/lib/cricketApi";
import { formatGrizzliesMatchScores } from "@/lib/grizzliesMatchPresentation";

function ClaimList({ items }: { items?: Array<{ team?: string; statement?: string; confidence?: string }> }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">Insufficient verified evidence for this section.</p>;
  return <ul className="space-y-3">{items.map((item, index) => <li key={`${item.team || "analysis"}-${index}`} className="rounded-lg border border-border/80 bg-background/70 p-3"><p className="font-semibold">{item.team ? `${item.team}: ` : ""}{item.statement}</p>{item.confidence ? <p className="mt-1 text-xs uppercase tracking-wide text-emerald-400">Confidence: {item.confidence}</p> : null}</li>)}</ul>;
}

function TeamHero({ team, strength, weakness }: { team: string; strength?: { statement?: string }; weakness?: { statement?: string } }) {
  const tone = /grizzlies/i.test(team) ? "border-red-500/55 from-red-950/80 via-red-950/35" : /strikers/i.test(team) ? "border-cyan-400/50 from-cyan-950/70 via-teal-950/35" : "border-amber-400/50 from-amber-950/65 via-orange-950/30";
  return <Card className={`overflow-hidden border bg-gradient-to-br ${tone} to-background`}><CardHeader><CardTitle className="font-display text-2xl">{team}</CardTitle></CardHeader><CardContent className="grid gap-4"><section className="rounded-xl border border-white/20 bg-black/20 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">Strength</p><p className="font-medium leading-relaxed">{strength?.statement || "Verified strength pending."}</p></section><section className="rounded-xl border border-white/20 bg-black/30 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-amber-200">Exploit area</p><p className="font-medium leading-relaxed">{weakness?.statement || "Verified exploit area pending."}</p></section></CardContent></Card>;
}

function ScorecardSnapshot({ report }: { report: CricketGrizzliesMatchAnalysisResponse }) {
  const batting = report.scorecard?.topBatting || [];
  const bowling = report.scorecard?.topBowling || [];
  return (
    <Card className="h-full border-white/15 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40">
      <CardHeader className="pb-4">
        <CardTitle>Top performances</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-cyan-200">Batting</p>
          <div className="space-y-2">{batting.length ? batting.map((item) => <div key={`${item.teamName}-${item.playerName}`} className="rounded-lg border border-white/15 bg-black/20 p-3"><p className="font-semibold">{item.playerName}</p><p className="text-xs text-muted-foreground">{item.teamName}</p><p className="mt-1 text-sm"><span className="font-bold text-white">{item.runs}</span> off {item.ballsFaced} · SR {item.strikeRate.toFixed(1)}</p></div>) : <p className="text-sm text-muted-foreground">Verified batting figures unavailable.</p>}</div>
        </section>
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-amber-200">Bowling</p>
          <div className="space-y-2">{bowling.length ? bowling.map((item) => <div key={`${item.teamName}-${item.playerName}`} className="rounded-lg border border-white/15 bg-black/20 p-3"><p className="font-semibold">{item.playerName}</p><p className="text-xs text-muted-foreground">{item.teamName}</p><p className="mt-1 text-sm"><span className="font-bold text-white">{item.wickets}/{item.runsConceded}</span> · Econ {item.economy.toFixed(2)}</p></div>) : <p className="text-sm text-muted-foreground">Verified bowling figures unavailable.</p>}</div>
        </section>
      </CardContent>
    </Card>
  );
}

function ReportFrame({ children }: { children: ReactNode }) {
  return (
    <section
      data-testid="grizzlies-report-frame"
      className="relative overflow-hidden rounded-[28px] border border-amber-300/60 bg-gradient-to-b from-amber-400/[0.04] via-background to-background p-[1px] shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_0_36px_rgba(245,158,11,0.10)]"
    >
      <span className="pointer-events-none absolute left-6 top-0 h-px w-28 bg-gradient-to-r from-transparent via-amber-100 to-transparent" />
      <span className="pointer-events-none absolute bottom-0 right-6 h-px w-28 bg-gradient-to-r from-transparent via-amber-100 to-transparent" />
      <div className="space-y-6 rounded-[27px] border border-amber-100/15 bg-background/95 p-3 sm:p-6 lg:p-8">
        {children}
      </div>
    </section>
  );
}

export default function AnalyticsGrizzliesMatchReport() {
  const { session } = useAuth();
  const { matchId = "" } = useParams();
  const [report, setReport] = useState<CricketGrizzliesMatchAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!session?.access_token || !matchId) return;
    const controller = new AbortController();
    fetchGrizzliesMatchAnalysis(session.access_token, matchId, controller.signal).then(setReport).catch((reason) => setError(reason.message));
    return () => controller.abort();
  }, [matchId, session?.access_token]);
  const teams = report ? [report.match.homeTeam, report.match.awayTeam] : [];
  const claim = (items: Array<{ team?: string; statement?: string }> | undefined, team: string) => items?.find((item) => item.team === team);
  const matchScores = formatGrizzliesMatchScores(report?.evidence?.innings);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container space-y-6 pb-16 pt-28">
        <Button asChild variant="outline">
          <Link to="/analytics/grizzlies/2026"><ArrowLeft className="mr-2 h-4 w-4" />Back to Grizzlies 2026 Analytics</Link>
        </Button>
        {!report && !error ? <Card><CardContent className="flex gap-3 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading verified match analysis…</CardContent></Card> : null}
        {error ? <Card className="border-red-500/50"><CardContent className="flex gap-3 py-8 text-muted-foreground"><ShieldAlert className="h-4 w-4 text-red-400" />{error}</CardContent></Card> : null}
        {report ? (
          <ReportFrame>
            <Card className="border-red-500/35 bg-gradient-to-b from-red-500/[.10] to-background">
              <CardHeader className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.2em] text-red-400">Grizzlies AI Match Analysis</p>
                  <CardTitle className="mt-2 font-display text-3xl">{report.match.homeTeam} vs {report.match.awayTeam}</CardTitle>
                  <CardDescription className="mt-2">{report.match.resultText || "Verified result pending"}{report.match.venue ? ` · ${report.match.venue}` : ""}</CardDescription>
                </div>
                <div className="grid min-w-0 gap-2 sm:min-w-[18rem] sm:grid-cols-2">
                  {matchScores.map((item) => <div key={item.teamName} className="rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-right"><p className="text-xs font-semibold text-white/60">{item.teamName}</p><p className="font-display text-2xl font-bold text-white">{item.score}</p><p className="text-xs text-white/50">{item.overs}</p></div>)}
                </div>
              </CardHeader>
            </Card>
            <section>
              <div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-300">Match Summary</p><h2 className="font-display text-2xl">How the match was decided</h2></div>
              <div className="grid items-stretch gap-5 lg:grid-cols-2"><Card className="h-full border-red-500/30 bg-gradient-to-br from-red-950/45 via-background to-background"><CardHeader className="pb-4"><CardTitle>The deciding story</CardTitle></CardHeader><CardContent><p className="text-base font-medium leading-8 text-white/90">{report.matchSummary}</p></CardContent></Card><ScorecardSnapshot report={report} /></div>
            </section>
            <section>
              <div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-300">AI Insights</p><h2 className="font-display text-2xl">Team strengths, risks, and Grizzlies actions</h2></div>
              <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-2">{teams.map((team) => <TeamHero key={team} team={team} strength={claim(report.analysis.strengths, team)} weakness={claim(report.analysis.weaknesses, team)} />)}</div><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Critical Moments</CardTitle></CardHeader><CardContent><p className="font-medium leading-7 text-white/90">{report.analysis.criticalMomentNarrative || "A verified critical-moment narrative is not available for this report version."}</p></CardContent></Card><Card><CardHeader><CardTitle>Turning Points</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.turningPoints} /></CardContent></Card><Card><CardHeader><CardTitle>Grizzlies Watch-out</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.grizzliesWatchOut} /></CardContent></Card><Card><CardHeader><CardTitle>Grizzlies Game Plan</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.grizzliesGamePlan} /></CardContent></Card></div></div>
            </section>
            <p className="text-xs text-muted-foreground">Evidence checksum: {report.sourceDataChecksum.slice(0, 12)} · Reviewed analysis only.</p>
          </ReportFrame>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
