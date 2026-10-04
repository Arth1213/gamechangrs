import { useId, useRef, useState } from 'react';
import { ArrowUpRight, Printer } from 'lucide-react';
import { boundaryPercentage, validateCoachPlan } from '@/lib/grizzliesCoachPlan';
import type { CoachDecision, GrizzliesCoachPlanData } from '@/lib/grizzliesCoachPlan';
import { formatGrizzliesFixtureDate } from '@/lib/grizzliesMatchPresentation';
import { printGrizzliesCoachPlan } from '@/lib/grizzliesCoachPrint';
import '@/styles/grizzliesCoachPlan.css';

function ReportBrand() {
  return <div className="gcp-brand" aria-label="San Ramon Grizzlies and GameChangrs">
    <div className="gcp-grizzlies-mark"><img src="/grizzlies-2026-logo.png" alt="San Ramon Grizzlies" width="64" height="64" loading="eager" /></div>
    <span className="gcp-brand-divider" aria-hidden="true" />
    <div className="gcp-gamechangrs-brand"><img src="/brand/gamechangrs-icon-crisp.png" alt="GameChangrs" width="40" height="40" loading="eager" /><div><p className="gcp-brand-name">Game<span>Changrs</span></p><p className="gcp-brand-caption">GRIZZLIES GAME INTELLIGENCE</p></div></div>
  </div>;
}

function ReportEvidence({ plan }: { plan: GrizzliesCoachPlanData }) {
  return <>
    <ul className="gcp-limits mt-4 list-disc space-y-2 pl-4 text-sm leading-6 text-white/70">{plan.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
    <div className="gcp-sources mt-5 grid gap-4 md:grid-cols-2">{plan.sources.map(source => <div key={source.id} className="gcp-source border-t border-white/10 pt-3"><h3 className="text-sm font-semibold">{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-white/30 underline-offset-4 hover:text-red-300">{source.label}<ArrowUpRight className="h-3 w-3" /></a> : source.label}</h3><p className="mt-1 text-xs leading-5 text-white/55">{source.detail}</p></div>)}</div>
    <p className="gcp-version mt-4 text-xs text-white/40">Report version: {plan.version}</p>
  </>;
}

function DecisionCard({ card }: { card: CoachDecision }) {
  return <article className="gcp-decision-card rounded-xl border border-red-500/35 bg-white/[.025] p-5 sm:p-6">
    <div className="gcp-card-meta mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-300">{card.trigger}</p>
    </div>
    <h3 className="font-display text-xl font-semibold leading-snug">{card.title}</h3>
    <ul className="mt-3 list-disc space-y-2 pl-4 text-[15px] leading-6 text-white/90 marker:text-red-400">
      {card.actions.map(action => <li key={action}>{action}</li>)}
    </ul>
    <p className="gcp-card-evidence mt-4 border-t border-white/10 pt-3 text-sm leading-5 text-white/60">{card.evidence}</p>
  </article>;
}

export function GrizzliesCoachPlan({ plan }: { plan: GrizzliesCoachPlanData }) {
  const headingId = useId();
  const reportRef = useRef<HTMLElement>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const handlePrint = async () => {
    if (!reportRef.current || printing) return;
    setPrinting(true); setPrintError('');
    try { await printGrizzliesCoachPlan(reportRef.current); }
    catch (error) { setPrintError(error instanceof Error ? error.message : 'Unable to prepare the report for printing.'); }
    finally { setPrinting(false); }
  };
  if (validateCoachPlan(plan).length) return <section role="status" className="rounded-xl border border-red-500/60 p-6">This game plan is unavailable. The evidence needs review before it can be displayed.</section>;
  return <article ref={reportRef} aria-labelledby={headingId} data-testid="grizzlies-coach-plan" data-opponent={plan.opponent} className="grizzlies-coach-plan overflow-hidden rounded-2xl border-2 border-red-500/70 bg-[#101216]">
    <div className="gcp-print-frame" aria-hidden="true" />
    <header className="gcp-header border-b border-white/10 px-5 py-7 sm:px-8 sm:py-9">
      <div className="gcp-brand-row"><ReportBrand /><div className="gcp-tools"><button type="button" className="gcp-print-button" onClick={handlePrint} disabled={printing}><Printer size={16} aria-hidden="true" />{printing ? 'Preparing print…' : 'Print / Save PDF'}</button>{printError ? <p role="alert" className="gcp-print-error">{printError}</p> : null}</div></div>
      <div className="gcp-meta flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[.14em]">
        <p className="text-red-400">Grizzlies Match Briefing</p>
        <p className="text-white/55">Evidence through {formatGrizzliesFixtureDate(plan.updatedThrough)}</p>
      </div>
      <h1 id={headingId} className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl"><span className="text-red-500">Grizzlies</span> vs {plan.opponent}</h1>
      <p className="mt-3 max-w-3xl text-base text-white/75">{plan.headline}</p>
      <p className="mt-2 text-xs text-white/50">Next meeting plan. Coaching recommendations, not guaranteed outcomes. Confirm the XI.</p>
    </header>
    <div className="gcp-body space-y-8 p-5 sm:p-8">
      <section className="gcp-phases" aria-labelledby={`${headingId}-phases`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h2 id={`${headingId}-phases`} className="font-display text-xl font-semibold">{plan.opponent}: boundary frequency by phase</h2><p className="text-xs text-white/55">{plan.boundaryMatch}</p></div>
        <div className="gcp-phase-grid grid gap-3 sm:grid-cols-3">{plan.phases.map(phase => <div key={phase.name} className="gcp-phase-card rounded-xl border border-white/15 bg-white/[.025] p-4 sm:p-5">
          <div className="flex justify-between gap-2 text-sm"><h3 className="font-semibold">{phase.name}</h3><span className="text-white/55">Overs {phase.overs}</span></div>
          <p className="gcp-boundary-value mt-3 font-display text-4xl font-bold tabular-nums">{boundaryPercentage(phase.boundaries, phase.legalBalls)}<span className="ml-1 text-xl text-white/55">%</span></p>
          <p className="mt-1 text-xs text-white/60">{phase.boundaries} boundary balls / {phase.legalBalls} legal balls</p>
          <p className="mt-3 text-sm text-white/80">{phase.cue}</p>
        </div>)}</div>
        <p className="mt-3 text-xs leading-5 text-white/50">Legal deliveries hit for four or six, not percentage of runs. Phase lengths reflect balls actually faced. One match, not a permanent weakness.</p>
      </section>
      {plan.sections.map((section, index) => <section className="gcp-decision-section" data-index={index} key={section.title} aria-labelledby={`${headingId}-${index}`}>
        <div className="mb-4"><h2 id={`${headingId}-${index}`} className="font-display text-2xl font-semibold">{section.title}</h2></div>
        <div className={`gcp-decision-grid grid gap-4 ${section.cards.length === 3 ? 'gcp-three-cards lg:grid-cols-3' : 'lg:grid-cols-2'}`}>{section.cards.map(card => <DecisionCard key={card.title} card={card} />)}</div>
      </section>)}
      <details className="gcp-screen-evidence rounded-xl border border-white/15 p-5">
        <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400">Evidence, sample sizes and limits</summary>
        <ReportEvidence plan={plan} />
      </details>
    </div>
  </article>;
}
