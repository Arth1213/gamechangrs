import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  Crosshair,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import AnalyticsReportModeSwitcher from "@/components/analytics/AnalyticsReportModeSwitcher";
import PlayerReportChat from "@/components/analytics/PlayerReportChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  CricketPlayerIntelligenceDismissalRow,
  CricketPlayerIntelligenceEvidenceItem,
  CricketPlayerIntelligenceLens,
  CricketPlayerIntelligenceMatchupRow,
  CricketPlayerIntelligenceResponse,
  CricketPlayerIntelligenceSummaryStats,
  CricketPlayerReportRouteState,
  createCricketSeriesAccessRequest,
  fetchCricketPlayerIntelligence,
  fetchCricketViewerSeries,
  getAnalyticsWorkspaceRoute,
  getRootCricketPlayerReportRoute,
} from "@/lib/cricketApi";

function getDivisionId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

function getToneClasses(tone: string | null | undefined) {
  switch (tone) {
    case "good":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "watch":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "risk":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-border/80 bg-background/60 text-foreground";
  }
}

function getToneSurfaceClasses(tone: string | null | undefined) {
  switch (tone) {
    case "good":
      return "border-emerald-500/25 bg-emerald-500/[0.08]";
    case "watch":
      return "border-amber-500/25 bg-amber-500/[0.08]";
    case "risk":
      return "border-rose-500/25 bg-rose-500/[0.08]";
    default:
      return "border-border/70 bg-background/80";
  }
}

function sanitizeIntelligenceCopy(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /This is the lowest-stability batting split in the current intelligence sample\.?/gi,
      "This is the most vulnerable batting setup in the current sample."
    )
    .replace(/lowest-stability batting split/gi, "most vulnerable batting setup")
    .replace(/current intelligence sample/gi, "current sample")
    .replace(/in this split/gi, "in this setup")
    .replace(/this split/gi, "this setup")
    .replace(/ batting split/gi, " batting setup")
    .replace(/ bowling split/gi, " bowling setup")
    .replace(/ cleanest wicket-and-control split/gi, " cleanest wicket-and-control matchup")
    .replace(/\s+/g, " ")
    .trim();
}

function getPhaseLabel(key: string) {
  switch (key) {
    case "powerplay":
      return "Powerplay";
    case "middle":
      return "Middle";
    case "death":
      return "Death";
    default:
      return key;
  }
}

function formatOrdinal(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const rounded = Math.round(value);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${rounded}th`;
  }

  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}

function formatCountLabel(value: number | null | undefined, singular: string, plural?: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  const label = rounded === 1 ? singular : plural || `${singular}s`;
  return `${formatNumber(rounded)} ${label}`;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatStyleLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const normalized = value.trim().replace(/_/g, " ").replace(/\s+/g, " ");

  if (/^left left handed batter$/i.test(normalized) || /^left handed batter$/i.test(normalized)) {
    return "Left-Hand Batter";
  }

  if (/^right right handed batter$/i.test(normalized) || /^right handed batter$/i.test(normalized)) {
    return "Right-Hand Batter";
  }

  if (/^left arm off spin$/i.test(normalized)) {
    return "Left-Arm Off Spin";
  }

  if (/^right arm off spin$/i.test(normalized)) {
    return "Right-Arm Off Spin";
  }

  if (/^left arm pace$/i.test(normalized)) {
    return "Left-Arm Pace";
  }

  if (/^right arm pace$/i.test(normalized)) {
    return "Right-Arm Pace";
  }

  return toTitleCase(normalized);
}

function getRecommendationTone(label: string | null | undefined) {
  const normalized = label?.trim().toLowerCase() || "";

  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes("strong")
    || normalized.includes("priority")
    || normalized.includes("elite")
    || normalized.includes("high")
  ) {
    return "good";
  }

  if (
    normalized.includes("risk")
    || normalized.includes("avoid")
    || normalized.includes("low")
    || normalized.includes("weak")
  ) {
    return "risk";
  }

  return "watch";
}

function getThreatProfile(percentileRank: number | null | undefined) {
  if (percentileRank === null || percentileRank === undefined || !Number.isFinite(percentileRank)) {
    return {
      label: "Unknown",
      tone: undefined,
      note: "Threat level is not available in this sample yet.",
    };
  }

  if (percentileRank >= 85) {
    return {
      label: "Red",
      tone: "risk",
      note: "High opposition threat in the current live sample.",
    };
  }

  if (percentileRank >= 60) {
    return {
      label: "Amber",
      tone: "watch",
      note: "Manageable, but still a live planning concern.",
    };
  }

  return {
    label: "Green",
    tone: "good",
    note: "Lower threat in the current planning sample.",
  };
}

type IntelligencePhaseRows = {
  powerplay?: CricketPlayerIntelligenceMatchupRow | null;
  middle?: CricketPlayerIntelligenceMatchupRow | null;
  death?: CricketPlayerIntelligenceMatchupRow | null;
};

function pickBestPhase(rows: IntelligencePhaseRows | null | undefined, mode: "batting" | "bowling") {
  const candidates = (["powerplay", "middle", "death"] as const)
    .map((phaseKey) => ({
      phaseKey,
      row: rows?.[phaseKey] || null,
    }))
    .filter((item) => (item.row?.legalBalls || 0) > 0);

  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    const candidateScore = mode === "batting"
      ? candidate.row?.strikeRate ?? Number.NEGATIVE_INFINITY
      : (candidate.row?.economy ?? Number.POSITIVE_INFINITY) * -1;
    const bestScore = mode === "batting"
      ? best.row?.strikeRate ?? Number.NEGATIVE_INFINITY
      : (best.row?.economy ?? Number.POSITIVE_INFINITY) * -1;

    return candidateScore > bestScore ? candidate : best;
  }, null as { phaseKey: "powerplay" | "middle" | "death"; row: CricketPlayerIntelligenceMatchupRow | null } | null);
}

function buildImpactPhase(roleType: string | null | undefined, lens: CricketPlayerIntelligenceLens | null) {
  const battingBest = pickBestPhase(lens?.batting?.byPhase, "batting");
  const bowlingBest = pickBestPhase(lens?.bowling?.byPhase, "bowling");
  const normalizedRole = roleType?.toLowerCase() || "";

  const preferred = normalizedRole.includes("bowling")
    ? bowlingBest || battingBest
    : battingBest || bowlingBest;

  if (!preferred) {
    return {
      label: "-",
      note: "No phase-level sample is available yet.",
    };
  }

  const notes = [
    battingBest
      ? `Batting peak: ${getPhaseLabel(battingBest.phaseKey)}`
      : null,
    bowlingBest
      ? `Bowling control: ${getPhaseLabel(bowlingBest.phaseKey)}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    label: getPhaseLabel(preferred.phaseKey),
    note: notes.join(" • "),
  };
}

function parseSignalLabel(label: string | null | undefined) {
  const normalized = label?.trim() || "";
  if (!normalized) {
    return { context: "unknown", target: "" };
  }

  if (normalized.startsWith("Batting vs ")) {
    return { context: "batting", target: normalized.replace("Batting vs ", "") };
  }
  if (normalized.startsWith("Bowling vs ")) {
    return { context: "bowling", target: normalized.replace("Bowling vs ", "") };
  }
  if (normalized.startsWith("Dismissal pattern vs ")) {
    return { context: "dismissal", target: normalized.replace("Dismissal pattern vs ", "") };
  }
  if (normalized.startsWith("Batting pressure vs ")) {
    return { context: "batting-risk", target: normalized.replace("Batting pressure vs ", "") };
  }

  return { context: "unknown", target: normalized };
}

function buildThreatNarrative(signal: { label?: string; note?: string } | null | undefined) {
  const parsed = parseSignalLabel(signal?.label);

  if (parsed.context === "batting" && parsed.target) {
    return `The player is mainly a batting threat against ${parsed.target}.`;
  }

  if (parsed.context === "bowling" && parsed.target) {
    return `The player is mainly a bowling threat against ${parsed.target}.`;
  }

  if (parsed.target) {
    return `The player is mainly a threat in this area: ${parsed.target}.`;
  }

  return "No clear threat area is available yet in the live sample.";
}

function formatSignalTitle(label: string | null | undefined) {
  const parsed = parseSignalLabel(label);

  switch (parsed.context) {
    case "batting":
      return parsed.target ? `Batting vs ${parsed.target}` : "Batting threat";
    case "bowling":
      return parsed.target ? `Bowling vs ${parsed.target}` : "Bowling threat";
    case "dismissal":
      return parsed.target ? `Dismissals against ${parsed.target}` : "Dismissal pattern";
    case "batting-risk":
      return parsed.target ? `Batting pressure against ${parsed.target}` : "Batting pressure";
    default:
      return sanitizeIntelligenceCopy(label?.trim() || "Live signal");
  }
}

function buildWeaknessNarrative(
  signal: { label?: string; note?: string } | null | undefined,
  fallbackPlan?: string | null,
) {
  const parsed = parseSignalLabel(signal?.label);

  if ((parsed.context === "batting-risk" || parsed.context === "dismissal") && parsed.target) {
    return `The player is most vulnerable against ${parsed.target}.`;
  }

  if (fallbackPlan) {
    return sanitizeIntelligenceCopy(fallbackPlan);
  }

  if (parsed.target) {
    return `The player is most vulnerable in this area: ${parsed.target}.`;
  }

  return "No clear vulnerability is available yet in the live sample.";
}

function buildPressureNarrative(profile: CricketPlayerIntelligenceLens["pressureProfile"]) {
  if (!profile) {
    return "No pressure pattern is available yet in the live sample.";
  }

  if (profile.dismissalDotThreshold !== null && profile.dismissalDotThreshold !== undefined) {
    return `Dot-ball pressure is the main stress signal right now. Dismissals tend to come after about ${formatNumber(profile.dismissalDotThreshold)} dots in a row.`;
  }

  if (profile.battingHighLeverageStrikeRate !== null && profile.battingHighLeverageStrikeRate !== undefined) {
    return `The main pressure read is how this player bats in high-pressure moments.`;
  }

  if (profile.bowlingHighLeverageEconomy !== null && profile.bowlingHighLeverageEconomy !== undefined) {
    return `The main pressure read is how this player bowls in high-pressure moments.`;
  }

  return "No pressure pattern is available yet in the live sample.";
}

function summarizeMatchupSection(rows: CricketPlayerIntelligenceMatchupRow[] | undefined, mode: "batting" | "bowling") {
  if (!rows || rows.length === 0) {
    return mode === "batting"
      ? "No batting matchup sample is available yet."
      : "No bowling matchup sample is available yet.";
  }

  const top = rows[0];
  if (mode === "batting") {
    return `Best scoring so far has come against ${top.splitLabel}.`;
  }

  return `Best bowling control so far has come against ${top.splitLabel}.`;
}

function summarizeDismissalSection(rows: CricketPlayerIntelligenceDismissalRow[] | undefined) {
  if (!rows || rows.length === 0) {
    return "No dismissal pattern is available yet.";
  }

  const top = rows[0];
  return `Most dismissals so far have come against ${top.bowlerStyleLabel}.`;
}

function buildPhaseLensNarrative(lens: CricketPlayerIntelligenceLens | null) {
  const battingPeak = pickBestPhase(lens?.batting?.byPhase, "batting");
  const bowlingPeak = pickBestPhase(lens?.bowling?.byPhase, "bowling");

  if (battingPeak && bowlingPeak) {
    return `${getPhaseLabel(battingPeak.phaseKey)} is the strongest batting phase, while ${getPhaseLabel(bowlingPeak.phaseKey)} is the strongest bowling phase in this live sample.`;
  }

  if (battingPeak) {
    return `${getPhaseLabel(battingPeak.phaseKey)} is where the batting impact shows up most clearly right now.`;
  }

  if (bowlingPeak) {
    return `${getPhaseLabel(bowlingPeak.phaseKey)} is where the bowling control shows up most clearly right now.`;
  }

  return "No phase-level read is available yet.";
}

function buildEvidenceNarrative(
  title: string,
  items: CricketPlayerIntelligenceEvidenceItem[] | undefined,
) {
  if (!items || items.length === 0) {
    return `No ${title.toLowerCase()} is available yet from the live dataset.`;
  }

  switch (title) {
    case "Batting evidence":
      return "These commentary-backed moments show where the batting threat showed up in live matches.";
    case "Bowling evidence":
      return "These commentary-backed moments show where the bowling impact showed up in live matches.";
    case "Dismissal evidence":
      return "These commentary-backed moments show how wickets have clustered in the live sample.";
    default:
      return "These live match moments back up the current report read.";
  }
}

function SummaryField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function SectionMetric({
  label,
  value,
  note,
  tone,
  labelClassName,
  valueClassName,
  noteClassName,
}: {
  label: string;
  value: string;
  note?: string | null;
  tone?: string | null;
  labelClassName?: string;
  valueClassName?: string;
  noteClassName?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "risk"
        ? "text-rose-300"
        : tone === "watch"
          ? "text-amber-300"
          : "text-foreground";

  return (
    <div className="space-y-1">
      <p className={`text-[11px] uppercase tracking-[0.16em] text-muted-foreground ${labelClassName || ""}`}>{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${toneClass} ${valueClassName || ""}`}>{value}</p>
      {note ? <p className={`text-xs leading-5 text-muted-foreground ${noteClassName || ""}`}>{sanitizeIntelligenceCopy(note)}</p> : null}
    </div>
  );
}

function formatOversFromBalls(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const legalBalls = Math.max(Math.round(value), 0);
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

function SummaryStatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border/70 py-2 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function SummaryStatsCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-4 space-y-0">
        {rows.map((row) => (
          <SummaryStatRow key={`${title}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function SummarySignalSection({
  title,
  narrative,
  items,
  emptyState,
  metricPlacement = "stack",
}: {
  title: string;
  narrative: string;
  items?: Array<{
    label?: string;
    tone?: string;
    metricLabel?: string;
    metricValue?: number | null;
    note?: string;
  }>;
  emptyState: string;
  metricPlacement?: "stack" | "side";
}) {
  return (
    <section className="space-y-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <div className="rounded-2xl border border-border/80 bg-background/30 p-5">
        <p className="text-sm leading-7 text-foreground">{narrative}</p>
        <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {items && items.length > 0 ? (
            items.map((item) => (
              <div
                key={`${title}-${item.label}-${item.metricLabel}`}
                className={`flex h-full rounded-2xl border p-4 ${getToneSurfaceClasses(item.tone)} ${metricPlacement === "side" ? "items-start justify-between gap-4" : "flex-col justify-between"}`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{formatSignalTitle(item.label)}</p>
                  {item.note ? <p className="text-sm leading-6 text-muted-foreground">{sanitizeIntelligenceCopy(item.note)}</p> : null}
                </div>
                {item.metricLabel || item.metricValue !== null && item.metricValue !== undefined ? (
                  <div className={metricPlacement === "side" ? "min-w-[108px] shrink-0 text-right" : "pt-3"}>
                    {item.metricLabel ? <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{item.metricLabel}</p> : null}
                    <p className={`${metricPlacement === "side" ? "mt-2 text-4xl leading-none" : "mt-1 text-2xl"} font-semibold tabular-nums ${item.tone === "good" ? "text-emerald-300" : item.tone === "risk" ? "text-rose-300" : item.tone === "watch" ? "text-amber-300" : "text-foreground"}`}>
                      {formatNumber(item.metricValue)}
                    </p>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">{emptyState}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlanColumn({
  title,
  items,
  emptyState,
}: {
  title: string;
  items: string[];
  emptyState: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/40">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${title}-${item}`}
              className={`p-4 text-sm leading-7 text-foreground ${index > 0 ? "border-t border-border/70" : ""}`}
            >
              {sanitizeIntelligenceCopy(item)}
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-muted-foreground">{emptyState}</div>
        )}
      </div>
    </div>
  );
}

function InsightColumn({
  title,
  items,
  emptyState,
}: {
  title: string;
  items: Array<{ title?: string; detail?: string }>;
  emptyState: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/40">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${title}-${item.title}-${index}`}
              className={`space-y-2 p-4 ${index > 0 ? "border-t border-border/70" : ""}`}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {item.title || "Additional insight"}
              </p>
              <p className="text-sm leading-7 text-foreground">
                {sanitizeIntelligenceCopy(item.detail || "No additional insight is available yet.")}
              </p>
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-muted-foreground">{emptyState}</div>
        )}
      </div>
    </div>
  );
}

function MatchupTable({
  title,
  summary,
  rows,
  mode,
}: {
  title: string;
  summary: string;
  rows?: CricketPlayerIntelligenceMatchupRow[];
  mode: "batting" | "bowling";
}) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-7 text-muted-foreground">{summary}</p>
        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-background/60">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border/80 bg-background/80 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Setup</th>
                  <th className="px-4 py-3 text-right font-medium">Matches</th>
                  <th className="px-4 py-3 text-right font-medium">Balls</th>
                  {mode === "batting" ? (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Runs</th>
                      <th className="px-4 py-3 text-right font-medium">Strike Rate</th>
                      <th className="px-4 py-3 text-right font-medium">Average</th>
                      <th className="px-4 py-3 text-right font-medium">Dismissals</th>
                      <th className="px-4 py-3 text-right font-medium">Dot %</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Wickets</th>
                      <th className="px-4 py-3 text-right font-medium">Economy</th>
                      <th className="px-4 py-3 text-right font-medium">Dot %</th>
                      <th className="px-4 py-3 text-right font-medium">Control Error %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${title}-${row.splitLabel}-${row.phaseBucket}`} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.splitLabel || "Unknown setup"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(row.matchCount)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(row.legalBalls)}</td>
                    {mode === "batting" ? (
                      <>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.runsScored)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.strikeRate)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.battingAverage)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.dismissals)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.dotBallPct)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.wickets)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.economy)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.dotBallPct)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.controlErrorPct)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No matchup sample is available yet in this lens.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DismissalTable({
  rows,
  summary,
}: {
  rows?: CricketPlayerIntelligenceDismissalRow[];
  summary: string;
}) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">Dismissal pattern</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-7 text-muted-foreground">{summary}</p>
        {rows && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-background/60">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border/80 bg-background/80 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Bowler type</th>
                  <th className="px-4 py-3 font-medium">Dismissal</th>
                  <th className="px-4 py-3 text-right font-medium">Wickets</th>
                  <th className="px-4 py-3 text-right font-medium">Matches</th>
                  <th className="px-4 py-3 text-right font-medium">Avg runs at wicket</th>
                  <th className="px-4 py-3 text-right font-medium">Avg balls faced</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.bowlerStyleLabel}-${row.dismissalType}`} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.bowlerStyleLabel || "Unknown style"}</td>
                    <td className="px-4 py-3 text-foreground">{row.dismissalType || "Dismissal"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.dismissalCount)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(row.matchCount)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.averageRunsAtDismissal)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.averageBallsFacedAtDismissal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No dismissal concentration has been captured yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhaseLensTable({ lens }: { lens: CricketPlayerIntelligenceLens | null }) {
  const phaseKeys: Array<"powerplay" | "middle" | "death"> = ["powerplay", "middle", "death"];

  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">Phase lens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-7 text-muted-foreground">{buildPhaseLensNarrative(lens)}</p>
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-background/60">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border/80 bg-background/80 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Phase</th>
                <th className="px-4 py-3 text-right font-medium">Batting SR</th>
                <th className="px-4 py-3 text-right font-medium">Batting balls</th>
                <th className="px-4 py-3 text-right font-medium">Bowling economy</th>
                <th className="px-4 py-3 text-right font-medium">Bowling balls</th>
                <th className="px-4 py-3 text-right font-medium">Bowling dot %</th>
              </tr>
            </thead>
            <tbody>
              {phaseKeys.map((phaseKey) => {
                const battingRow = lens?.batting?.byPhase?.[phaseKey] || null;
                const bowlingRow = lens?.bowling?.byPhase?.[phaseKey] || null;

                return (
                  <tr key={`phase-${phaseKey}`} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-foreground">{getPhaseLabel(phaseKey)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(battingRow?.strikeRate)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(battingRow?.legalBalls)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(bowlingRow?.economy)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(bowlingRow?.legalBalls)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNumber(bowlingRow?.dotBallPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceTable({
  title,
  items,
}: {
  title: string;
  items?: CricketPlayerIntelligenceEvidenceItem[];
}) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-7 text-muted-foreground">{buildEvidenceNarrative(title, items)}</p>
        {items && items.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-background/60">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border/80 bg-background/80 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Match</th>
                  <th className="px-4 py-3 font-medium">Moment</th>
                  <th className="px-4 py-3 font-medium">Commentary</th>
                  <th className="px-4 py-3 font-medium">Links</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${title}-${item.matchId}-${item.ballLabel}-${item.headline}`} className="border-b border-border/60 align-top last:border-b-0">
                    <td className="px-4 py-3 text-muted-foreground">
                      {[item.matchDateLabel, item.matchTitle, item.phase].filter(Boolean).join(" • ")}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="space-y-1">
                        <p>{item.headline || "Live evidence"}</p>
                        {item.leverageScore !== null && item.leverageScore !== undefined ? (
                          <p className="text-xs text-muted-foreground">Leverage {formatNumber(item.leverageScore)}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{item.commentaryText || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {item.matchPageUrl ? (
                          <a
                            href={item.matchPageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                          >
                            Match page
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {item.scorecardUrl ? (
                          <a
                            href={item.scorecardUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                          >
                            Scorecard
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {item.ballByBallUrl ? (
                          <a
                            href={item.ballByBallUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                          >
                            Ball by ball
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {!item.matchPageUrl && !item.scorecardUrl && !item.ballByBallUrl ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No commentary-backed evidence is available yet in this bucket.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type IntelligenceStatus = "idle" | "loading" | "success" | "error";
type ViewerStatus = "loading" | "success" | "error";
type AccessRequestStatus = "idle" | "saving" | "success" | "error";

const AnalyticsIntelligenceReport = () => {
  const { session, user } = useAuth();
  const { playerId } = useParams<{ playerId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const routeState = (location.state ?? {}) as CricketPlayerReportRouteState;
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerSeries, setViewerSeries] = useState<Array<{ configKey?: string; seriesName?: string }>>([]);
  const [viewerUserId, setViewerUserId] = useState<string>("");
  const [viewerIsPlatformAdmin, setViewerIsPlatformAdmin] = useState(false);
  const [viewerReloadKey, setViewerReloadKey] = useState(0);
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceStatus>("idle");
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null);
  const [intelligenceReport, setIntelligenceReport] = useState<CricketPlayerIntelligenceResponse | null>(null);
  const [intelligenceReloadKey, setIntelligenceReloadKey] = useState(0);
  const [accessRequestStatus, setAccessRequestStatus] = useState<AccessRequestStatus>("idle");
  const [accessRequestMessage, setAccessRequestMessage] = useState<string | null>(null);

  const accessToken = session?.access_token || "";
  const numericPlayerId = Number.parseInt(playerId ?? "", 10);
  const divisionId = getDivisionId(searchParams.get("divisionId"));
  const currentSeriesKey = searchParams.get("series")?.trim() || routeState.seriesConfigKey?.trim() || "";
  const defaultSeriesKey = viewerSeries[0]?.configKey?.trim() || "";
  const effectiveSeriesKey = currentSeriesKey || defaultSeriesKey;
  const currentSearchQuery = searchParams.get("q")?.trim() || routeState.searchQuery?.trim() || "";
  const intelligenceRoute = `${location.pathname}${location.search}`;
  const backToSearchUrl = useMemo(
    () => getAnalyticsWorkspaceRoute(currentSearchQuery, effectiveSeriesKey || undefined),
    [currentSearchQuery, effectiveSeriesKey]
  );
  const executiveReportUrl = useMemo(() => {
    if (!Number.isFinite(numericPlayerId)) {
      return backToSearchUrl;
    }
    return getRootCricketPlayerReportRoute(
      {
        playerId: numericPlayerId,
        divisionId,
      },
      {
        searchQuery: currentSearchQuery,
        seriesConfigKey: effectiveSeriesKey || undefined,
      }
    );
  }, [backToSearchUrl, currentSearchQuery, divisionId, effectiveSeriesKey, numericPlayerId]);
  const hasViewerAccess = viewerSeries.some((series) => series.configKey?.trim() === effectiveSeriesKey);

  useEffect(() => {
    if (!accessToken) {
      setViewerSeries([]);
      setViewerUserId("");
      setViewerIsPlatformAdmin(false);
      setViewerStatus("error");
      setViewerError("A signed-in session is required before report access can be checked.");
      return;
    }

    const controller = new AbortController();
    setViewerStatus("loading");
    setViewerError(null);
    setViewerSeries([]);
    setViewerUserId("");
    setViewerIsPlatformAdmin(false);

    fetchCricketViewerSeries(accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        setViewerSeries(payload.series ?? []);
        setViewerUserId(payload.actor?.userId?.trim() || "");
        setViewerIsPlatformAdmin(payload.actor?.isPlatformAdmin === true);
        setViewerStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Viewer access could not be resolved right now.";
        setViewerSeries([]);
        setViewerUserId("");
        setViewerIsPlatformAdmin(false);
        setViewerStatus("error");
        setViewerError(message);
      });

    return () => controller.abort();
  }, [accessToken, viewerReloadKey]);

  useEffect(() => {
    setAccessRequestStatus("idle");
    setAccessRequestMessage(null);
  }, [effectiveSeriesKey, numericPlayerId]);

  useEffect(() => {
    if (viewerStatus !== "success" || !hasViewerAccess) {
      setIntelligenceReport(null);
      setIntelligenceError(null);
      setIntelligenceStatus("idle");
      return;
    }

    if (!Number.isFinite(numericPlayerId)) {
      setIntelligenceReport(null);
      setIntelligenceError(null);
      setIntelligenceStatus("idle");
      return;
    }

    const controller = new AbortController();
    setIntelligenceStatus("loading");
    setIntelligenceError(null);
    setIntelligenceReport(null);

    fetchCricketPlayerIntelligence(
      {
        playerId: numericPlayerId,
        divisionId,
      },
      {
        accessToken,
        seriesConfigKey: effectiveSeriesKey || undefined,
        signal: controller.signal,
      }
    )
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        setIntelligenceReport(payload);
        setIntelligenceStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Player intelligence is unavailable right now.";
        setIntelligenceReport(null);
        setIntelligenceError(message);
        setIntelligenceStatus("error");
      });

    return () => controller.abort();
  }, [accessToken, divisionId, effectiveSeriesKey, hasViewerAccess, intelligenceReloadKey, numericPlayerId, viewerStatus]);

  const handleRetryViewerAccess = () => setViewerReloadKey((value) => value + 1);
  const handleRetryIntelligence = () => setIntelligenceReloadKey((value) => value + 1);

  const handleRequestReportAccess = async () => {
    if (!accessToken || !effectiveSeriesKey) {
      return;
    }

    setAccessRequestStatus("saving");
    setAccessRequestMessage(null);

    try {
      const response = await createCricketSeriesAccessRequest(effectiveSeriesKey, accessToken, {
        accessRole: "viewer",
        requestNote: "Root player intelligence request from Game-Changrs front end.",
      });

      setAccessRequestStatus("success");
      setAccessRequestMessage(
        response.message || "Access request submitted. Recheck access after the series admin approves it."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Access request could not be submitted.";
      setAccessRequestStatus("error");
      setAccessRequestMessage(message);
    }
  };

  const title =
    intelligenceReport?.header?.playerName ||
    routeState.displayName ||
    (Number.isFinite(numericPlayerId) ? `Player ${numericPlayerId}` : "Player intelligence");
  const teamName = intelligenceReport?.header?.teamName || routeState.teamName || null;
  const roleLabel = intelligenceReport?.header?.roleLabel || routeState.roleLabel || null;
  const scopeLabel = intelligenceReport?.meta?.scope?.scopeLabel || "Series intelligence";
  const scopeFallbackReason = intelligenceReport?.meta?.scope?.fallbackReason || null;
  const focusedLens = intelligenceReport?.focusedLens || null;
  const recommendationLabel = intelligenceReport?.header?.recommendationLabel || null;
  const recommendationTone = getRecommendationTone(recommendationLabel);
  const threatProfile = getThreatProfile(intelligenceReport?.header?.percentileRank);
  const battingStyleLabel = formatStyleLabel(intelligenceReport?.header?.battingStyle);
  const bowlingStyleLabel = formatStyleLabel(intelligenceReport?.header?.bowlingStyle);
  const battingOverall = focusedLens?.batting?.overall || null;
  const bowlingOverall = focusedLens?.bowling?.overall || null;
  const impactPhase = buildImpactPhase(intelligenceReport?.header?.roleType, focusedLens);
  const battingSampleLabel = focusedLens?.sample?.battingLegalBalls
    ? `${formatNumber(focusedLens.sample.battingLegalBalls)} balls`
    : "-";
  const bowlingSampleLabel = focusedLens?.sample?.bowlingLegalBalls
    ? `${formatNumber(focusedLens.sample.bowlingLegalBalls)} balls`
    : "-";
  const leadingStrength = intelligenceReport?.tacticalSummary?.strengths?.[0] || null;
  const leadingWatchout = intelligenceReport?.tacticalSummary?.watchouts?.[0] || null;
  const pressureProfile = focusedLens?.pressureProfile || null;
  const battingPlanItems = intelligenceReport?.tacticalPlan?.battingPlan ?? [];
  const bowlingPlanItems = intelligenceReport?.tacticalPlan?.bowlingPlan ?? [];
  const pressureSignals = intelligenceReport?.tacticalSummary?.pressureSignals ?? [];
  const confidenceValue =
    intelligenceReport?.header?.confidenceScore !== null && intelligenceReport?.header?.confidenceScore !== undefined
      ? `${intelligenceReport.header.confidenceLabel || "Live"} · ${formatNumber(intelligenceReport.header.confidenceScore)}`
      : intelligenceReport?.header?.confidenceLabel || "-";
  const battingSampleNote = battingOverall?.matchCount
    ? `Across ${formatCountLabel(battingOverall.matchCount, "match")} in the current sample.`
    : "No batting sample yet.";
  const bowlingSampleNote = bowlingOverall?.matchCount
    ? `Across ${formatCountLabel(bowlingOverall.matchCount, "match")} in the current sample.`
    : "No bowling sample yet.";
  const threatNarrative = buildThreatNarrative(leadingStrength);
  const weaknessNarrative = buildWeaknessNarrative(leadingWatchout, battingPlanItems[0] || null);
  const pressureNarrative = buildPressureNarrative(pressureProfile);
  const summaryStats: CricketPlayerIntelligenceSummaryStats | null = intelligenceReport?.summaryStats || null;
  const battingStatRows = [
    { label: "Matches", value: formatNumber(summaryStats?.batting?.matches) },
    { label: "Runs", value: formatNumber(summaryStats?.batting?.runs) },
    { label: "Balls", value: formatNumber(summaryStats?.batting?.ballsFaced) },
    { label: "Strike Rate", value: formatNumber(summaryStats?.batting?.strikeRate) },
    { label: "Average", value: formatNumber(summaryStats?.batting?.average) },
    { label: "50s", value: formatNumber(summaryStats?.batting?.fifties) },
    { label: "100s", value: formatNumber(summaryStats?.batting?.hundreds) },
    { label: "4s", value: formatNumber(summaryStats?.batting?.fours) },
    { label: "6s", value: formatNumber(summaryStats?.batting?.sixes) },
    { label: "Not Outs", value: formatNumber(summaryStats?.batting?.notOuts) },
  ];
  const bowlingStatRows = [
    { label: "Matches", value: formatNumber(summaryStats?.bowling?.matches) },
    { label: "Overs", value: formatOversFromBalls(summaryStats?.bowling?.legalBalls) },
    { label: "Wickets", value: formatNumber(summaryStats?.bowling?.wickets) },
    { label: "Economy", value: formatNumber(summaryStats?.bowling?.economy) },
    { label: "4 Wicket Hauls", value: formatNumber(summaryStats?.bowling?.fourWicketHauls) },
    { label: "5 Wicket Hauls", value: formatNumber(summaryStats?.bowling?.fiveWicketHauls) },
    { label: "Wides", value: formatNumber(summaryStats?.bowling?.wides) },
    { label: "No Balls", value: formatNumber(summaryStats?.bowling?.noBalls) },
    { label: "4s Given", value: formatNumber(summaryStats?.bowling?.foursGiven) },
    { label: "6s Given", value: formatNumber(summaryStats?.bowling?.sixesGiven) },
  ];
  const fieldingStatRows = [
    { label: "Matches", value: formatNumber(summaryStats?.fielding?.matches) },
    { label: "Catches", value: formatNumber(summaryStats?.fielding?.catches) },
    { label: "Run Outs", value: formatNumber(summaryStats?.fielding?.runOuts) },
    { label: "Stumpings", value: formatNumber(summaryStats?.fielding?.stumpings) },
  ];
  const matchupAndUsageInsights = intelligenceReport?.additionalInsights?.matchupAndUsage ?? [];
  const pressureAndEvidenceInsights = intelligenceReport?.additionalInsights?.pressureAndEvidence ?? [];

  if (viewerStatus === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl space-y-6">
              <Skeleton className="h-16 w-48 rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-3xl" />
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (viewerStatus === "error") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Intelligence access could not be checked</CardTitle>
                  <CardDescription className="text-destructive/80">
                    {viewerError || "Viewer access is unavailable right now."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Access Check
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={backToSearchUrl}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Search
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (!hasViewerAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader className="space-y-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="font-display text-4xl text-foreground">
                      {viewerIsPlatformAdmin ? "This intelligence route needs a valid live series context" : "You do not have access to this intelligence report"}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-7">
                      {viewerIsPlatformAdmin
                        ? "Platform admins already have global analytics access. This route is failing because the series context could not be resolved from the current URL."
                        : "This intelligence route is limited to series viewers, analysts, and admins who were granted access in the cricket admin shell."}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                      {viewerIsPlatformAdmin ? "Platform-admin scope" : "Send this user id to your admin"}
                    </p>
                    <div className="mt-4 rounded-2xl border border-border/80 bg-background/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">User ID</p>
                      <p className="mt-2 break-all font-mono text-sm text-foreground">
                        {viewerUserId || user?.id || "Unavailable"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What to do</p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                      <p>1. Recheck access once to reload the live series catalog.</p>
                      <p>2. If this URL was opened without the right series key, go back to search and reopen from there.</p>
                      <p>3. If needed, submit a request so the series admin can approve viewer access.</p>
                    </div>
                    {accessRequestMessage ? (
                      <div
                        className={`mt-5 rounded-2xl border p-4 text-sm leading-7 ${
                          accessRequestStatus === "error"
                            ? "border-destructive/30 bg-destructive/5 text-destructive"
                            : "border-cyan-400/20 bg-cyan-400/5 text-cyan-100"
                        }`}
                      >
                        {accessRequestMessage}
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-3">
                      {!viewerIsPlatformAdmin ? (
                        <Button
                          type="button"
                          onClick={() => void handleRequestReportAccess()}
                          disabled={accessRequestStatus === "saving" || !effectiveSeriesKey}
                        >
                          {accessRequestStatus === "saving" ? "Submitting request..." : "Request access"}
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recheck Access
                      </Button>
                      <Button asChild variant="outline">
                        <Link to={backToSearchUrl}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back to Search
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (!Number.isFinite(numericPlayerId)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Invalid player intelligence route</CardTitle>
                  <CardDescription>
                    A valid player id is required to load the front-end intelligence report.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to={backToSearchUrl}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Search
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-7xl space-y-8">
            <div className="space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" asChild>
                    <Link to={backToSearchUrl}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Search
                    </Link>
                  </Button>
                  <AnalyticsReportModeSwitcher
                    activeMode="intelligence"
                    executiveHref={executiveReportUrl}
                    intelligenceHref={intelligenceRoute}
                    linkState={routeState}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {recommendationLabel ? (
                      <Badge className={`border px-4 py-1.5 text-sm ${getToneClasses(recommendationTone)}`}>
                        {recommendationLabel}
                      </Badge>
                    ) : null}
                    <Badge className={`border px-4 py-1.5 text-sm ${getToneClasses(threatProfile.tone)}`}>
                      Threat Level · {threatProfile.label}
                    </Badge>
                  </div>
                  <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
                  {scopeFallbackReason ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      {scopeFallbackReason}
                    </div>
                  ) : null}
                </div>
              </div>

              <Card className="border-border/80 bg-card shadow-card">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Player Summary</p>
                    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <SummaryField label="Team" value={teamName || "-"} />
                      <SummaryField label="Primary Role" value={roleLabel || "-"} />
                      <SummaryField label="Batting Profile" value={battingStyleLabel} />
                      <SummaryField label="Bowling Profile" value={bowlingStyleLabel} />
                      <SummaryField label="Report Scope" value={scopeLabel} />
                    </dl>
                  </div>
                </CardContent>
              </Card>
            </div>

            {intelligenceStatus === "loading" ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
              </div>
            ) : null}

            {intelligenceStatus === "error" ? (
              <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Player intelligence could not be loaded</CardTitle>
                  <CardDescription className="text-destructive/80">
                    {intelligenceError || "The live intelligence payload is unavailable right now."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={handleRetryIntelligence}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Intelligence
                  </Button>
                  <AnalyticsReportModeSwitcher
                    activeMode="intelligence"
                    executiveHref={executiveReportUrl}
                    intelligenceHref={intelligenceRoute}
                    linkState={routeState}
                  />
                </CardContent>
              </Card>
            ) : null}

            {intelligenceStatus === "success" && intelligenceReport ? (
              <>
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardHeader className="space-y-4 pb-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
                        <Crosshair className="h-3.5 w-3.5" />
                        Summary
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-6">
                    <section className="grid gap-4 xl:grid-cols-2">
                      <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-background/40 p-5">
                        <div className="grid h-full gap-3 md:grid-cols-3">
                          <div className="flex h-full flex-col rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">Main Threat</p>
                            <p className="mt-3 text-sm leading-6 text-foreground">{threatNarrative}</p>
                          </div>
                          <div className="flex h-full flex-col rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200">Main Weakness</p>
                            <p className="mt-3 text-sm leading-6 text-foreground">{weaknessNarrative}</p>
                          </div>
                          <div className="flex h-full flex-col rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200">Pressure Note</p>
                            <p className="mt-3 text-sm leading-6 text-foreground">{pressureNarrative}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-background/40 p-5">
                        <div className="grid h-full flex-1 gap-3 sm:grid-cols-2">
                          <div className="flex h-full rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] p-4">
                            <SectionMetric
                              label="Confidence"
                              value={confidenceValue}
                              tone={recommendationTone}
                              valueClassName="text-[2.1rem] leading-none"
                              noteClassName="pt-2"
                            />
                          </div>
                          <div className="flex h-full rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4">
                            <SectionMetric
                              label="Percentile"
                              value={formatOrdinal(intelligenceReport?.header?.percentileRank)}
                              tone="good"
                              valueClassName="text-[2.1rem] leading-none"
                            />
                          </div>
                          <div className="flex h-full rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4">
                            <SectionMetric
                              label="Composite Selector Score"
                              value={formatNumber(intelligenceReport?.header?.compositeScore)}
                              tone="good"
                              valueClassName="text-[2.1rem] leading-none"
                            />
                          </div>
                          <div className={`flex h-full rounded-2xl border p-4 ${getToneSurfaceClasses(threatProfile.tone)}`}>
                            <SectionMetric
                              label="Threat Level"
                              value={threatProfile.label}
                              tone={threatProfile.tone}
                              valueClassName="text-[2.1rem] leading-none"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-border/70 pt-6">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Tactical Plan</p>
                      <div className="grid gap-4 xl:grid-cols-2">
                        <PlanColumn
                          title="Batting"
                          items={battingPlanItems}
                          emptyState="No batting plan lines are available yet."
                        />
                        <PlanColumn
                          title="Bowling"
                          items={bowlingPlanItems}
                          emptyState="No bowling plan lines are available yet."
                        />
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-border/70 pt-6">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Series Stats</p>
                      <div className="grid gap-4 xl:grid-cols-3">
                        <SummaryStatsCard title="Batting Stats" rows={battingStatRows} />
                        <SummaryStatsCard title="Bowling Stats" rows={bowlingStatRows} />
                        <SummaryStatsCard title="Fielding / Wicketkeeping Stats" rows={fieldingStatRows} />
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-border/70 pt-6">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Snapshot</p>
                      <div className="grid gap-4 xl:grid-cols-3">
                        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] p-5">
                          <SectionMetric
                            label="Impact Phase"
                            value={impactPhase.label}
                            note={impactPhase.note}
                            tone="watch"
                            valueClassName="text-[2.35rem]"
                          />
                        </div>
                        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-5">
                          <SectionMetric
                            label="Batting Sample"
                            value={battingSampleLabel}
                            note={battingSampleNote}
                            tone="watch"
                            valueClassName="text-[2.35rem]"
                          />
                        </div>
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-5">
                          <SectionMetric
                            label="Bowling Sample"
                            value={bowlingSampleLabel}
                            note={bowlingSampleNote}
                            tone="good"
                            valueClassName="text-[2.35rem]"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="border-t border-border/70 pt-6">
                      <SummarySignalSection
                        title="Threat"
                        narrative={threatNarrative}
                        items={intelligenceReport?.tacticalSummary?.strengths}
                        emptyState="No clear threat signal is available yet in the live sample."
                        metricPlacement="side"
                      />
                    </section>

                    <section className="border-t border-border/70 pt-6">
                      <SummarySignalSection
                        title="Weakness"
                        narrative={weaknessNarrative}
                        items={intelligenceReport?.tacticalSummary?.watchouts}
                        emptyState="No clear weakness is available yet in the live sample."
                        metricPlacement="side"
                      />
                    </section>

                    <section className="border-t border-border/70 pt-6">
                      <SummarySignalSection
                        title="Pressure"
                        narrative={pressureNarrative}
                        items={pressureSignals}
                        emptyState="No pressure markers are available yet in the live sample."
                      />
                    </section>

                    <section className="space-y-4 border-t border-border/70 pt-6">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Additional Insights</p>
                      <div className="grid gap-4 xl:grid-cols-2">
                        <InsightColumn
                          title="Matchup & Usage"
                          items={matchupAndUsageInsights}
                          emptyState="No additional matchup or usage insights are available yet."
                        />
                        <InsightColumn
                          title="Pressure & Evidence"
                          items={pressureAndEvidenceInsights}
                          emptyState="No additional pressure or evidence insights are available yet."
                        />
                      </div>
                    </section>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardHeader className="space-y-4 pb-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
                        <BrainCircuit className="h-3.5 w-3.5" />
                        Details
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <MatchupTable
                      title="Batting vs bowler type"
                      summary={summarizeMatchupSection(focusedLens?.batting?.byBowlerType, "batting")}
                      rows={focusedLens?.batting?.byBowlerType}
                      mode="batting"
                    />

                    <MatchupTable
                      title="Bowling vs batter type"
                      summary={summarizeMatchupSection(focusedLens?.bowling?.byBatterHand, "bowling")}
                      rows={focusedLens?.bowling?.byBatterHand}
                      mode="bowling"
                    />

                    <PhaseLensTable lens={focusedLens} />

                    <DismissalTable rows={focusedLens?.dismissals} summary={summarizeDismissalSection(focusedLens?.dismissals)} />

                    <EvidenceTable title="Batting evidence" items={intelligenceReport.commentaryEvidence?.batting} />
                    <EvidenceTable title="Bowling evidence" items={intelligenceReport.commentaryEvidence?.bowling} />
                    <EvidenceTable title="Dismissal evidence" items={intelligenceReport.commentaryEvidence?.dismissals} />
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <PlayerReportChat
        report={null}
        mode="intelligence"
        playerName={title}
        playerId={numericPlayerId}
        seriesConfigKey={effectiveSeriesKey}
        seriesName={intelligenceReport?.meta?.series?.name || routeState.seriesName || null}
        divisionId={divisionId}
        divisionLabel={intelligenceReport?.meta?.scope?.scopeLabel || routeState.divisionLabel || null}
      />

      <Footer />
    </div>
  );
};

export default AnalyticsIntelligenceReport;
