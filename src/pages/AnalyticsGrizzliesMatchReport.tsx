import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { CricketGrizzliesMatchAnalysisResponse, fetchGrizzliesMatchAnalysis } from "@/lib/cricketApi";

function ClaimList({ items }: { items?: Array<{ team?: string; statement?: string; confidence?: string }> }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">Insufficient verified evidence for this section.</p>;
  return <ul className="space-y-3">{items.map((item, index) => <li key={`${item.team || "analysis"}-${index}`} className="rounded-lg border border-border/80 bg-background/70 p-3"><p className="font-semibold">{item.team ? `${item.team}: ` : ""}{item.statement}</p>{item.confidence ? <p className="mt-1 text-xs uppercase tracking-wide text-emerald-400">Confidence: {item.confidence}</p> : null}</li>)}</ul>;
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
  return <div className="min-h-screen bg-background text-foreground"><Navbar /><main className="container space-y-6 pb-16 pt-28"><Button asChild variant="outline"><Link to="/analytics/grizzlies/2026"><ArrowLeft className="mr-2 h-4 w-4" />Back to Grizzlies 2026 Analytics</Link></Button>{!report && !error ? <Card><CardContent className="flex gap-3 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading verified match analysis…</CardContent></Card> : null}{error ? <Card className="border-red-500/50"><CardContent className="flex gap-3 py-8 text-muted-foreground"><ShieldAlert className="h-4 w-4 text-red-400" />{error}</CardContent></Card> : null}{report ? <><Card className="border-red-500/35 bg-gradient-to-b from-red-500/[.10] to-background"><CardHeader><p className="text-xs font-semibold uppercase tracking-[.2em] text-red-400">Grizzlies AI Match Analysis</p><CardTitle className="font-display text-3xl">{report.match.homeTeam} vs {report.match.awayTeam}</CardTitle><CardDescription>{report.match.resultText || "Verified result pending"}{report.match.venue ? ` · ${report.match.venue}` : ""}</CardDescription></CardHeader></Card><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Strengths</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.strengths} /></CardContent></Card><Card><CardHeader><CardTitle>Weaknesses</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.weaknesses} /></CardContent></Card><Card><CardHeader><CardTitle>Critical Moments</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.criticalMoments?.map((item) => ({ statement: `Innings ${item.innings}, over ${item.over}: ${item.event} (impact ${item.impactScore})` }))} /></CardContent></Card><Card><CardHeader><CardTitle>Turning Points</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.turningPoints} /></CardContent></Card><Card><CardHeader><CardTitle>Grizzlies Watch-out</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.grizzliesWatchOut} /></CardContent></Card><Card><CardHeader><CardTitle>Grizzlies Game Plan</CardTitle></CardHeader><CardContent><ClaimList items={report.analysis.grizzliesGamePlan} /></CardContent></Card></div><p className="text-xs text-muted-foreground">Evidence checksum: {report.sourceDataChecksum.slice(0, 12)} · Reviewed analysis only.</p></> : null}</main><Footer /></div>;
}
