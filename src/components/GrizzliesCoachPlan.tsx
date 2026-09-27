import { useId } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { boundaryPercentage, validateCoachPlan } from '@/lib/grizzliesCoachPlan';
import type { CoachDecision, GrizzliesCoachPlanData } from '@/lib/grizzliesCoachPlan';
import { formatGrizzliesFixtureDate } from '@/lib/grizzliesMatchPresentation';

function DecisionCard({ card }: { card: CoachDecision }) {
  return <article className="rounded-xl border border-white/15 bg-white/[.025] p-5 sm:p-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-300">{card.trigger}</p>
      <span className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-white/65">{card.confidence}</span>
    </div>
    <h3 className="font-display text-xl font-semibold leading-snug">{card.title}</h3>
    <ul className="mt-3 list-disc space-y-2 pl-4 text-[15px] leading-6 text-white/90 marker:text-red-400">
      {card.actions.map(action => <li key={action}>{action}</li>)}
    </ul>
    <p className="mt-4 border-t border-white/10 pt-3 text-sm leading-5 text-white/60">{card.evidence}</p>
  </article>;
}

export function GrizzliesCoachPlan({ plan }: { plan: GrizzliesCoachPlanData }) {
  const headingId = useId();
  if (validateCoachPlan(plan).length) return <section role="status" className="rounded-xl border border-red-500/60 p-6">This game plan is unavailable. The evidence needs review before it can be displayed.</section>;
  return <article aria-labelledby={headingId} data-testid="grizzlies-coach-plan" className="overflow-hidden rounded-2xl border-2 border-red-500/70 bg-[#101216]">
    <header className="border-b border-white/10 px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[.14em]">
        <p className="text-red-400">Grizzlies coaching brief</p>
        <p className="text-white/55">Evidence through {formatGrizzliesFixtureDate(plan.updatedThrough)}</p>
      </div>
      <h1 id={headingId} className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl"><span className="text-red-500">Grizzlies</span> vs {plan.opponent}</h1>
      <p className="mt-3 max-w-3xl text-base text-white/75">{plan.headline}</p>
      <p className="mt-2 text-xs text-white/50">Next meeting plan. Coaching recommendations, not guaranteed outcomes. Confirm the XI.</p>
    </header>
    <div className="space-y-8 p-5 sm:p-8">
      <section aria-labelledby={`${headingId}-phases`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 id={`${headingId}-phases`} className="font-display text-xl font-semibold">Strikers: boundary frequency by phase</h2><p className="text-xs text-white/55">{plan.boundaryMatch}</p></div>
        <div className="grid gap-3 sm:grid-cols-3">{plan.phases.map(phase => <div key={phase.name} className="rounded-xl border border-white/15 bg-white/[.025] p-4 sm:p-5">
          <div className="flex justify-between gap-2 text-sm"><h3 className="font-semibold">{phase.name}</h3><span className="text-white/55">Overs {phase.overs}</span></div>
          <p className="mt-3 font-display text-4xl font-bold tabular-nums">{boundaryPercentage(phase.boundaries, phase.legalBalls)}<span className="ml-1 text-xl text-white/55">%</span></p>
          <p className="mt-1 text-xs text-white/60">{phase.boundaries} boundary balls / {phase.legalBalls} legal balls</p>
          <p className="mt-3 text-sm text-white/80">{phase.cue}</p>
        </div>)}</div>
        <p className="mt-3 text-xs leading-5 text-white/50">A boundary ball is a legal delivery hit for four or six. Not percentage of runs. Death covers only the 25 legal balls faced. One match, not a permanent weakness.</p>
      </section>
      {plan.sections.map((section, index) => <section key={section.title} aria-labelledby={`${headingId}-${index}`}>
        <div className="mb-4 flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-red-500/40 text-xs font-bold text-red-300">{index + 1}</span><h2 id={`${headingId}-${index}`} className="font-display text-2xl font-semibold">{section.title}</h2></div>
        <div className="grid gap-4 lg:grid-cols-2">{section.cards.map(card => <DecisionCard key={card.title} card={card} />)}</div>
      </section>)}
      <details className="rounded-xl border border-white/15 p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400">Evidence, sample sizes and limits</summary>
        <ul className="mt-4 list-disc space-y-2 pl-4 text-sm leading-6 text-white/70">{plan.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{plan.sources.map(source => <div key={source.id} className="border-t border-white/10 pt-3"><h3 className="text-sm font-semibold">{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-white/30 underline-offset-4 hover:text-red-300">{source.label}<ArrowUpRight className="h-3 w-3" /></a> : source.label}</h3><p className="mt-1 text-xs leading-5 text-white/55">{source.detail}</p></div>)}</div>
        <p className="mt-4 text-xs text-white/40">Report version: {plan.version}</p>
      </details>
    </div>
  </article>;
}
