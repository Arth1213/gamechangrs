import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, RefreshCw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  CricketNccaTopPlayersResponse,
  fetchCricketNccaTopPlayers,
  getAnalyticsWorkspaceRoute,
  getRootCricketPlayerIntelligenceRoute,
  getRootCricketPlayerReportRoute,
  NCCA_TOP_PLAYERS_SERIES_KEY,
} from "@/lib/cricketApi";

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

export default function AnalyticsNccaTopPlayers() {
  const { session } = useAuth();
  const [data, setData] = useState<CricketNccaTopPlayersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      setError("A signed-in analytics session is required to view NCCA rankings.");
      return () => controller.abort();
    }
    setLoading(true);
    setError(null);
    fetchCricketNccaTopPlayers(token, controller.signal)
      .then(setData)
      .catch((requestError) => {
        if (requestError?.name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "NCCA rankings are unavailable.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [session?.access_token, reloadKey]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container pt-28 pb-16">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">NCCA Summer 2026</p>
            <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">Top Players</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Top 20 players in each division, ranked by the current composite selector score.</p>
          </div>
          <Button asChild variant="outline"><Link to={getAnalyticsWorkspaceRoute(undefined, NCCA_TOP_PLAYERS_SERIES_KEY)}><ArrowLeft className="mr-2 h-4 w-4" />Analytics workspace</Link></Button>
        </div>

        {loading ? <Card><CardContent className="flex items-center gap-3 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading NCCA rankings…</CardContent></Card> : null}
        {error ? <Card className="border-destructive/40"><CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Rankings unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader><CardContent><Button onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></CardContent></Card> : null}
        {data && !data.hasRankings ? <Card><CardHeader><CardTitle>Rankings are being prepared</CardTitle><CardDescription>{data.readinessMessage}</CardDescription></CardHeader></Card> : null}
        {data?.hasRankings ? <Tabs defaultValue={data.divisions[0]?.label} className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-card p-1">
            {data.divisions.map((division) => <TabsTrigger key={division.label} value={division.label}>{division.label}</TabsTrigger>)}
          </TabsList>
          {data.divisions.map((division) => <TabsContent key={division.label} value={division.label}>
            <Card className="overflow-hidden border-primary/15 bg-card/80 shadow-2xl">
              <CardHeader className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-transparent to-transparent"><div className="flex items-center gap-3"><Trophy className="h-6 w-6 text-primary" /><div><CardTitle className="font-display text-3xl">{division.label}</CardTitle><CardDescription>Composite selector score ranking</CardDescription></div></div></CardHeader>
              <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Player</TableHead><TableHead>Team</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Composite</TableHead><TableHead className="text-right">Percentile</TableHead><TableHead>Confidence</TableHead><TableHead>Assessment</TableHead><TableHead>Threat Report</TableHead></TableRow></TableHeader><TableBody>
                {division.players.map((player) => { const target = { playerId: player.playerId, divisionId: player.divisionId }; const options = { seriesConfigKey: NCCA_TOP_PLAYERS_SERIES_KEY }; return <TableRow key={`${division.label}-${player.playerId}`}><TableCell className="font-display text-xl text-primary">{player.rank}</TableCell><TableCell className="font-semibold">{player.displayName}</TableCell><TableCell>{player.teamName || "—"}</TableCell><TableCell>{player.roleLabel || "—"}</TableCell><TableCell className="text-right font-semibold">{formatNumber(player.compositeScore)}</TableCell><TableCell className="text-right">{formatNumber(player.percentileRank)}</TableCell><TableCell><Badge variant="outline">{player.confidenceLabel || "—"}</Badge></TableCell><TableCell><Button asChild size="sm" variant="outline"><Link to={getRootCricketPlayerReportRoute(target, options)}>Player Assessment</Link></Button></TableCell><TableCell><Button asChild size="sm"><Link to={getRootCricketPlayerIntelligenceRoute(target, options)}>Threat Report</Link></Button></TableCell></TableRow>; })}
              </TableBody></Table></CardContent>
            </Card>
          </TabsContent>)}
        </Tabs> : null}
      </main>
      <Footer />
    </div>
  );
}
