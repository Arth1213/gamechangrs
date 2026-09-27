import { FormEvent, useState } from "react";
import { Calculator, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { srgBatsFirst, svsBatsFirst } from "@/lib/grizzliesPlayoffCalculator";

type GrizzliesFirstResult = ReturnType<typeof srgBatsFirst>;
type SiliconValleyFirstResult = ReturnType<typeof svsBatsFirst>;

function scoreFromInput(value: string, label: string) {
  const score = Number(value);
  if (!value.trim() || !Number.isInteger(score) || score < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return score;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border/70 bg-background/70 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p></div>;
}

function GrizzliesBatFirstCard() {
  const [score, setScore] = useState("");
  const [result, setResult] = useState<GrizzliesFirstResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setResult(srgBatsFirst(scoreFromInput(score, "Grizzlies score")));
      setError(null);
    } catch (reason) {
      setResult(null);
      setError(reason instanceof Error ? reason.message : "Unable to calculate the score.");
    }
  }

  return <Card className="border-red-500/45 bg-gradient-to-b from-red-500/[.12] to-background"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-2xl"><Target className="h-5 w-5 text-red-400" />Grizzlies Batting First</CardTitle><CardDescription>Enter the Grizzlies’ 20-over score to find the slowest SVS winning chase that keeps Grizzlies ahead on NRR.</CardDescription></CardHeader><CardContent><form onSubmit={calculate} className="space-y-4"><label className="block space-y-2 text-sm font-semibold" htmlFor="grizzlies-score">Grizzlies score<Input id="grizzlies-score" inputMode="numeric" min="0" onChange={(event) => setScore(event.target.value)} placeholder="e.g. 150" step="1" type="number" value={score} /></label><Button className="w-full bg-red-600 text-white hover:bg-red-500" type="submit"><Calculator className="mr-2 h-4 w-4" />Calculate NRR requirement</Button></form>{error ? <p className="mt-4 text-sm font-medium text-destructive" role="alert">{error}</p> : null}{result ? <div className="mt-5 space-y-4"><div className="rounded-lg border border-red-400/35 bg-red-950/30 p-4"><p className="text-xs font-semibold uppercase tracking-[.16em] text-red-200">SVS chase time</p><p className="mt-1 font-display text-4xl font-bold">{result.minimumSiliconValleyOvers} overs</p><p className="mt-1 text-sm text-muted-foreground">SVS target: <span className="font-semibold text-foreground">{result.siliconValleyTarget} runs</span> · {result.minimumSiliconValleyBalls} balls to win and leave Grizzlies ahead.</p></div><div className="grid gap-3 sm:grid-cols-2"><Metric label="Projected Grizzlies NRR" value={result.projectedGrizzliesNRR.toFixed(3)} /><Metric label="Projected SVS NRR" value={result.projectedSiliconValleyNRR.toFixed(3)} /></div></div> : null}</CardContent></Card>;
}

function SiliconValleyBatFirstCard() {
  const [score, setScore] = useState("");
  const [result, setResult] = useState<SiliconValleyFirstResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setResult(svsBatsFirst(scoreFromInput(score, "Silicon Valley score")));
      setError(null);
    } catch (reason) {
      setResult(null);
      setError(reason instanceof Error ? reason.message : "Unable to calculate the score.");
    }
  }

  return <Card className="border-sky-500/45 bg-gradient-to-b from-sky-500/[.12] to-background"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-2xl"><Timer className="h-5 w-5 text-sky-300" />Silicon Valley Batting First</CardTitle><CardDescription>Enter SVS’ 20-over score to find the lowest Grizzlies score in a loss that keeps Grizzlies ahead on NRR.</CardDescription></CardHeader><CardContent><form onSubmit={calculate} className="space-y-4"><label className="block space-y-2 text-sm font-semibold" htmlFor="silicon-valley-score">Silicon Valley score<Input id="silicon-valley-score" inputMode="numeric" min="0" onChange={(event) => setScore(event.target.value)} placeholder="e.g. 150" step="1" type="number" value={score} /></label><Button className="w-full bg-sky-600 text-white hover:bg-sky-500" type="submit"><Calculator className="mr-2 h-4 w-4" />Calculate NRR requirement</Button></form>{error ? <p className="mt-4 text-sm font-medium text-destructive" role="alert">{error}</p> : null}{result ? <div className="mt-5">{"possible" in result && !result.possible ? <p className="rounded-lg border border-amber-500/45 bg-amber-500/10 p-4 text-sm font-medium text-amber-100">{result.message}</p> : <div className="space-y-4"><div className="rounded-lg border border-sky-400/35 bg-sky-950/30 p-4"><p className="text-xs font-semibold uppercase tracking-[.16em] text-sky-200">Grizzlies minimum score</p><p className="mt-1 font-display text-4xl font-bold">{result.minimumGrizzliesScore}</p><p className="mt-1 text-sm text-muted-foreground">Grizzlies can lose by at most <span className="font-semibold text-foreground">{result.maximumSiliconValleyWinningMargin} runs</span>.</p></div></div>}</div> : null}</CardContent></Card>;
}

export function GrizzliesPlayoffCalculator() {
  return <section className="grid gap-6 xl:grid-cols-2" aria-label="Playoff calculator"><GrizzliesBatFirstCard /><SiliconValleyBatFirstCard /></section>;
}
