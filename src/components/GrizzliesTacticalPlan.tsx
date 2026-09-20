import { useState } from "react";
import type { CricketTacticalClaim, CricketTacticalGamePlan } from "@/lib/cricketApi";
import { tacticalActionBullets } from "@/lib/grizzliesTacticalPresentation.js";

function DecisionCards({ title, items }: { title: string; items: CricketTacticalClaim[] }) {
  if (!items.length) return null;
  return <section className="space-y-3"><h3 className="font-display text-xl font-semibold">{title}</h3><div className="grid gap-4 lg:grid-cols-2">
    {items.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-xl border border-white/15 border-t-2 border-t-amber-200/60 bg-slate-950/35 p-5">
      <h4 className="text-lg font-semibold text-white">{item.title}</h4>
      {item.classification ? <p className="mt-1 text-xs uppercase tracking-wide text-amber-200">{item.classification.replace(/_/g, " ")}</p> : null}
      <ul className="mt-4 list-disc space-y-3 pl-5 text-base font-medium leading-6 text-emerald-100 marker:text-amber-200">
        {(item.bullets || tacticalActionBullets(item.action)).map((bullet, i) => <li key={i} className="pl-1">{bullet}</li>)}
      </ul>
      <details className="mt-5 border-t border-white/10 pt-3 text-sm text-muted-foreground"><summary className="cursor-pointer text-amber-100/80">Stats & rationale · {item.confidence || "limited"} sample</summary><p className="mt-3 leading-6">{item.observation}</p><p className="mt-3 leading-6">{item.action}</p><p className="mt-3 break-words text-xs">{item.evidenceRefs.join(" · ")}</p></details>
    </article>)}
  </div></section>;
}

export function GrizzliesTacticalPlan({ plan }: { plan?: CricketTacticalGamePlan }) {
  const teams = [...new Set(plan?.bowlingPlan.map(c => c.team).filter(Boolean) || [])];
  const [selected, setSelected] = useState<string>();
  if (!plan) return null;
  const opponent = selected && teams.includes(selected) ? selected : teams[0];
  const filtered = (items: CricketTacticalClaim[]) => items.filter(c => !c.team || c.team === opponent || c.team === "San Ramon Grizzlies");
  const pairs = plan.directMatchups.filter(p => p.team === opponent && p.balls >= 6);
  return <section className="space-y-6 border-t border-amber-200/20 pt-6" aria-label="Grizzlies tactical game plan">
    <div><h2 className="font-display text-3xl font-bold">Grizzlies: decisions for the next game</h2><p className="mt-2 text-sm text-muted-foreground">Player. Situation. Action. · MiLC 2025 + 2026 · {plan.asOfDate}</p><p className="mt-1 text-xs text-amber-100/70">Confirm the XI and bowling availability. Small samples—not guaranteed advantages.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Choose opposition">{teams.map(team => <button key={team} type="button" aria-pressed={team === opponent} onClick={() => setSelected(team)} className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${team === opponent ? "border-amber-200 bg-amber-200/15 text-amber-100" : "border-white/25 hover:border-white/60"}`}>Against {team}</button>)}</div>
    <DecisionCards title="Who bowls, when, and why" items={filtered(plan.bowlingPlan)} />
    <DecisionCards title="Strike bowlers: threats and pressure points" items={filtered(plan.strikeBowlers || [])} />
    <DecisionCards title="Phase-specific batting threats and counters" items={filtered(plan.phaseBattingThreats || [])} />
    <DecisionCards title="Dot-ball pressure: where to maintain control" items={filtered(plan.dotBallPressure || [])} />
    <div><h3 className="mb-2 font-display text-xl font-semibold">Partnerships to break—and partnerships to build</h3><p className="mb-4 text-sm leading-6 text-muted-foreground">{plan.partnershipDefinition}</p><DecisionCards title="Named partnership decisions" items={filtered(plan.partnershipPlans || [])} /></div>
    <DecisionCards title="Batting order by situation" items={plan.battingScenarios} />
    {pairs.length ? <div className="overflow-x-auto rounded-xl border border-white/15"><table className="w-full min-w-[650px] text-left text-sm"><caption className="p-4 text-left font-semibold">Direct matchup evidence — batter runs and bowler-credited dismissals. Small samples are not proven advantages.</caption><thead className="bg-white/5 text-white/60"><tr>{["Batter","Bowler","Runs / balls","Dismissals","Strike rate","Sample"].map(s => <th key={s} className="p-3 font-medium">{s}</th>)}</tr></thead><tbody>{pairs.map(p => <tr key={`${p.batter}-${p.bowler}`} className="border-t border-white/10"><td className="p-3">{p.batter}</td><td className="p-3">{p.bowler}</td><td className="p-3">{p.runs} / {p.balls}</td><td className="p-3">{p.wickets}</td><td className="p-3">{p.strikeRate}</td><td className="p-3 text-amber-200">{p.confidence}</td></tr>)}</tbody></table></div> : null}
    <DecisionCards title="Scoring changes and opposition bowling" items={[...plan.matchPassages, ...filtered(plan.oppositionBowling)]} />
    <DecisionCards title="Field-setting trials—not inferred shot maps" items={filtered(plan.fieldPlans)} />
    <details className="rounded-xl border border-white/15 p-4 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-white/80">Scope and limitations · {plan.sourceMatchIds.length} source matches checked</summary><ul className="mt-3 list-disc space-y-2 pl-5">{plan.limitations.map(s => <li key={s}>{s}</li>)}</ul></details>
  </section>;
}
