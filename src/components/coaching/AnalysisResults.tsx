import { CheckCircle, AlertTriangle, Target, TrendingUp, Award, Dumbbell, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Aspect {
  name: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  feedback: string;
  keyPoints: string[];
}

interface ImprovementArea {
  issue: string;
  severity: 'high' | 'medium' | 'low';
  drill: string;
}

interface AngleData {
  value: number;
  optimal: string;
  assessment: string;
}

interface Analysis {
  overallScore: number;
  overallGrade: string;
  summary: string;
  aspects: Aspect[];
  strengths: string[];
  areasForImprovement: ImprovementArea[];
  angleAnalysis: {
    elbowAngle?: AngleData;
    kneeAngle?: AngleData;
    shoulderAngle?: AngleData;
    hipAngle?: AngleData;
  };
  comparisonToElite: string;
  nextSteps: string[];
}

interface AnalysisResultsProps {
  analysis: Analysis;
  mode: 'batting' | 'bowling';
}

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-primary';
  if (score >= 80) return 'text-accent';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 60) return 'text-orange-500';
  return 'text-destructive';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'excellent':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'good':
      return 'bg-accent/10 text-accent border-accent/20';
    case 'needs_improvement':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'poor':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'bg-destructive/10 text-destructive';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-600';
    case 'low':
      return 'bg-accent/10 text-accent';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export function AnalysisResults({ analysis, mode }: AnalysisResultsProps) {
  return (
    <div className="space-y-8 animate-slide-up">
      {/* Overall Score */}
      <div className="p-8 rounded-2xl bg-gradient-card border border-border">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-8 border-border flex items-center justify-center">
              <div className="text-center">
                <p className={`font-display text-5xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                  {analysis.overallScore}
                </p>
                <p className="text-muted-foreground text-sm">out of 100</p>
              </div>
            </div>
            <div className="absolute -top-2 -right-2 w-14 h-14 rounded-full bg-primary flex items-center justify-center">
              <span className="font-display text-xl font-bold text-primary-foreground">
                {analysis.overallGrade}
              </span>
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {mode === 'batting' ? 'Batting' : 'Bowling'} Technique Analysis
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {analysis.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Technical Aspects Grid */}
      <div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Technical Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysis.aspects.map((aspect) => (
            <div
              key={aspect.name}
              className="p-5 rounded-xl bg-gradient-card border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-medium text-foreground">{aspect.name}</h4>
                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(aspect.status)}`}>
                  {aspect.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-display text-2xl font-bold ${getScoreColor(aspect.score)}`}>
                    {aspect.score}
                  </span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                <Progress value={aspect.score} className="h-2" />
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">
                {aspect.feedback}
              </p>
              
              <ul className="space-y-1">
                {aspect.keyPoints.slice(0, 2).map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Angle Analysis */}
      {analysis.angleAnalysis && (
        <div className="p-6 rounded-2xl bg-gradient-card border border-border">
          <h3 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Joint Angle Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(analysis.angleAnalysis).map(([key, data]) => (
              data && (
                <div key={key} className="text-center p-4 rounded-xl bg-background/50">
                  <p className="text-xs text-muted-foreground mb-1 capitalize">
                    {key.replace('Angle', '')}
                  </p>
                  <p className="font-display text-3xl font-bold text-foreground mb-1">
                    {data.value}°
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Optimal: {data.optimal}
                  </p>
                  <p className="text-xs text-primary mt-2">
                    {data.assessment}
                  </p>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Strengths
          </h3>
          <ul className="space-y-3">
            {analysis.strengths.map((strength, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/20">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Areas for Improvement
          </h3>
          <ul className="space-y-4">
            {analysis.areasForImprovement.map((area, i) => (
              <li key={i} className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(area.severity)}`}>
                    {area.severity}
                  </span>
                  <span className="text-foreground font-medium">{area.issue}</span>
                </div>
                <div className="flex items-start gap-2 pl-4">
                  <Dumbbell className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{area.drill}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Elite Comparison */}
      <div className="p-6 rounded-2xl bg-gradient-card border border-border">
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">
          Comparison to Elite Players
        </h3>
        <p className="text-muted-foreground">
          {analysis.comparisonToElite}
        </p>
      </div>

      {/* Next Steps */}
      <div className="p-6 rounded-2xl bg-accent/10 border border-accent/20">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-accent" />
          Recommended Next Steps
        </h3>
        <ol className="space-y-3">
          {analysis.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium text-accent shrink-0">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
