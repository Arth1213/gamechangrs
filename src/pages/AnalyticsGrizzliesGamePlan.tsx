import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { GrizzliesCoachPlan } from '@/components/GrizzliesCoachPlan';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGrizzliesGamePlan, type GrizzliesGamePlanResponse } from '@/lib/cricketApi';
import { formatGrizzliesFixtureDate } from '@/lib/grizzliesMatchPresentation';
import fixtures from '../../config/grizzlies-2026-upcoming.json';

export default function AnalyticsGrizzliesGamePlan() {
  const { planKey = '' } = useParams();
  const { session } = useAuth();
  const [state, setState] = useState<{key: string; report?: GrizzliesGamePlanResponse; error?: string}>({key: ''});
  const [retry, setRetry] = useState(0);
  const fixture = fixtures.find(f => f.key === planKey);
  useEffect(() => {
    if (!session?.access_token || !fixture) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 20000);
    setState({key: planKey});
    fetchGrizzliesGamePlan(session.access_token, planKey, controller.signal).then(report => {
      if (!controller.signal.aborted) setState(report.fixture.key === planKey && report.coachPlan.opponent === fixture.opponent ? {key: planKey, report} : {key: planKey, error: 'The report does not match this fixture.'});
    }).catch(reason => {
      if (controller.signal.reason === 'unmounted') return;
      setState({key: planKey, error: controller.signal.aborted ? 'The game-plan service timed out. Retry shortly.' : reason.message});
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort('unmounted'); };
  }, [fixture, planKey, retry, session?.access_token]);
  const current = state.key === planKey ? state : null;
  return <div className="min-h-screen bg-background text-foreground">
    <Navbar />
    <main className="container space-y-5 pb-16 pt-28">
      <Button asChild variant="outline"><Link to="/analytics/grizzlies/2026?tab=analysis"><ArrowLeft className="mr-2 h-4 w-4" />Back to upcoming games</Link></Button>
      {fixture ? <p className="text-sm text-muted-foreground">Group B · {formatGrizzliesFixtureDate(fixture.date)} · PVCC 5 · {fixture.time} (time unconfirmed)</p> : null}
      {!fixture ? <p role="alert" className="rounded-xl border border-red-500/50 p-6">Unknown playoff fixture.</p> : current?.error ? <section role="alert" className="rounded-xl border border-red-500/50 p-6"><p>{current.error}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => setRetry(value => value + 1)}>Retry</Button></section> : current?.report ? <GrizzliesCoachPlan plan={current.report.coachPlan} /> : <p role="status" className="flex items-center gap-3 rounded-xl border border-border p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading game plan…</p>}
    </main><Footer />
  </div>;
}
