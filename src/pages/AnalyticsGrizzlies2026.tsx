import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Loader2, ShieldAlert } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { CricketGrizzliesPortalResponse, fetchGrizzliesPortal } from "@/lib/cricketApi";
import { grizzliesPortalFallback } from "@/lib/grizzliesPortalFallback";

export default function AnalyticsGrizzlies2026() {
  const { session } = useAuth();
  const [data, setData] = useState<CricketGrizzliesPortalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portal = data ?? grizzliesPortalFallback;

  useEffect(() => {
    if (!session?.access_token) return;
    const controller = new AbortController();
    fetchGrizzliesPortal(session.access_token, controller.signal).then(setData).catch((reason) => setError(reason.message));
    return () => controller.abort();
  }, [session?.access_token]);

  return <div className="min-h-screen bg-background text-foreground"><Navbar /><main className="container pt-28 pb-16 space-y-8">
    <section className="flex flex-col gap-5 md:flex-row md:items-center"><img src="/grizzlies-2026-logo.png" alt="San Ramon Grizzlies" className="h-24 w-24 object-contain" /><div><p className="text-xs font-semibold uppercase tracking-[.24em] text-primary">2026 Minor League</p><h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">Grizzlies 2026 Analytics</h1><p className="mt-1 font-display text-xl font-semibold text-primary md:text-2xl">Powered by GameChangrs</p><p className="mt-3 text-muted-foreground">Welcome to the 2026 Grizzlies Season.</p></div></section>
    {!session ? <Card><CardContent className="flex gap-3 py-10"><Lock />Sign in with an approved Gmail account to view this portal.</CardContent></Card> : null}
    {!data && session && !error ? <Card><CardContent className="flex gap-3 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Using the verified roster fallback while the protected portal service is unavailable.</CardContent></Card> : null}
    {error ? <Card className="border-amber-500/50"><CardContent className="flex gap-3 py-5 text-sm text-muted-foreground"><ShieldAlert className="h-4 w-4 text-amber-500" />Using the verified roster fallback while the protected portal service is deployed.</CardContent></Card> : null}
    <Tabs defaultValue="squad"><TabsList><TabsTrigger value="squad">Squad Intelligence</TabsTrigger><TabsTrigger value="analysis">AI Match Analysis</TabsTrigger></TabsList><TabsContent value="squad" className="space-y-6">{portal.teams.map((team) => <Card key={team.name}><CardHeader><CardTitle className="font-display text-3xl">{team.name}</CardTitle><CardDescription>NCCA 2026 player intelligence</CardDescription></CardHeader><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Category</TableHead><TableHead>NCCA Profile</TableHead><TableHead>Player Assessment</TableHead><TableHead>Player Threat</TableHead></TableRow></TableHeader><TableBody>{team.players.map((player) => <TableRow key={player.name}><TableCell className="font-semibold">{player.name}</TableCell><TableCell>{player.rosterCategory}</TableCell><TableCell>{player.cricclubsProfileUrl ? <Button asChild size="sm" variant="outline"><a href={player.cricclubsProfileUrl} target="_blank" rel="noreferrer">CricClubs</a></Button> : "NCCA data not found"}</TableCell><TableCell>{player.assessmentPath ? <Button asChild size="sm" variant="outline"><Link to={player.assessmentPath}>Player Assessment</Link></Button> : "NCCA data not found"}</TableCell><TableCell>{player.threatPath ? <Button asChild size="sm"><Link to={player.threatPath}>Player Threat</Link></Button> : "NCCA data not found"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>)}</TabsContent><TabsContent value="analysis"><Card><CardHeader><CardTitle>AI Match Analysis</CardTitle><CardDescription>{portal.analysisStatus}</CardDescription></CardHeader><CardContent>Match analysis and recommendations will begin after completed 2026 MiLC matches are ingested.</CardContent></Card></TabsContent></Tabs>
  </main><Footer /></div>;
}
