import { createRoot } from "react-dom/client";

import type { Database, Json } from "@/integrations/supabase/types";
import { renderElementPdf } from "@/lib/reportPdf";

export type StoredTechniqueAnalysis = Database["public"]["Tables"]["analysis_results"]["Row"];

type StoredFinding = {
  id: string;
  title: string;
  severity: string;
  fix: string;
  tip: string;
};

type StoredDrill = {
  title: string;
  focus: string;
  description: string;
};

type StoredSnapshot = {
  title: string;
  tag: string;
  copy: string;
};

type StoredPhaseScore = {
  key: string;
  label: string;
  score: number;
};

type StoredSheetModel = {
  overallScore: number;
  analyzedAtLabel: string;
  summary: string;
  heading: string;
  band: string;
  phaseScores: StoredPhaseScore[];
  strengths: string[];
  findings: StoredFinding[];
  drills: StoredDrill[];
  snapshots: StoredSnapshot[];
  metadataCards: Array<{ label: string; value: string }>;
  fileNameBase: string;
};

function isRecord(value: Json | null | undefined): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTitleCase(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatTechniqueTimestamp(value: string | null) {
  if (!value) {
    return "Saved analysis";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Saved analysis";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreLabel(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 75) return "good";
  if (score >= 65) return "needs improvement";
  return "poor";
}

function scoreBand(score: number) {
  if (score >= 85) return "Elite foundation";
  if (score >= 75) return "Strong foundation";
  if (score >= 65) return "Developing";
  return "Needs intervention";
}

function phaseTone(score: number) {
  if (score >= 85) return "bg-primary/15 text-primary border-primary/20";
  if (score >= 75) return "bg-accent/15 text-accent border-accent/20";
  if (score >= 65) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function severityTone(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "bg-destructive/10 text-destructive border-destructive/20";
  if (normalized === "major" || normalized === "high") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  return "bg-accent/10 text-accent border-accent/20";
}

function sanitizeFileNameSegment(value: string) {
  return value
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function toPhaseScores(scores: Json): StoredPhaseScore[] {
  if (!isRecord(scores)) {
    return [];
  }

  const phaseOrder = ["setup", "backlift", "trigger", "downswing", "contact", "contactZone", "shot"];

  return Object.entries(scores)
    .map(([key, value]) => {
      const numericScore =
        typeof value === "number"
          ? value
          : isRecord(value) && typeof value.score === "number"
            ? value.score
            : null;

      if (numericScore === null) {
        return null;
      }

      return {
        key,
        label: toTitleCase(key === "contactZone" ? "contact zone" : key),
        score: numericScore,
      };
    })
    .filter((value): value is StoredPhaseScore => Boolean(value))
    .sort((left, right) => {
      const leftIndex = phaseOrder.indexOf(left.key);
      const rightIndex = phaseOrder.indexOf(right.key);
      if (leftIndex === -1 && rightIndex === -1) return left.label.localeCompare(right.label);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
}

function toStringArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toFindings(value: Json | null | undefined): StoredFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const title = typeof item.title === "string" ? item.title : `Finding ${index + 1}`;
      const severity = typeof item.severity === "string" ? item.severity : "minor";
      const fix = typeof item.fix === "string" ? item.fix : "";
      const tip = typeof item.tip === "string" ? item.tip : "";

      return {
        id: typeof item.id === "string" ? item.id : `finding-${index + 1}`,
        title,
        severity,
        fix,
        tip,
      };
    })
    .filter((value): value is StoredFinding => Boolean(value));
}

function toDrills(value: Json | null | undefined): StoredDrill[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          title: `Drill ${index + 1}`,
          focus: "Skill",
          description: item,
        };
      }

      if (!isRecord(item)) {
        return null;
      }

      return {
        title: typeof item.title === "string" ? item.title : `Drill ${index + 1}`,
        focus: typeof item.focus === "string" ? item.focus : "Skill",
        description: typeof item.description === "string" ? item.description : "Continue refining the movement sequence.",
      };
    })
    .filter((value): value is StoredDrill => Boolean(value));
}

function toSnapshots(value: Json | null | undefined): StoredSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        title: typeof item.title === "string" ? item.title : `Snapshot ${index + 1}`,
        tag: typeof item.tag === "string" ? item.tag : "Note",
        copy: typeof item.copy === "string" ? item.copy : "",
      };
    })
    .filter((value): value is StoredSnapshot => Boolean(value) && Boolean(value.copy));
}

function buildStoredSheetModel(report: StoredTechniqueAnalysis, playerName: string): StoredSheetModel {
  const feedback = isRecord(report.feedback) ? report.feedback : {};
  const phaseScores = toPhaseScores(report.scores);
  const findings = toFindings(feedback.findings);
  const drills = toDrills(report.drills);
  const snapshots = toSnapshots(feedback.snapshots);
  const strengthsFromFeedback = toStringArray(feedback.strengths);
  const strengthsFromScores = phaseScores
    .filter((phase) => phase.score >= 78)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((phase) => `${phase.label}: ${phase.score}/100`);
  const strengths = strengthsFromFeedback.length > 0 ? strengthsFromFeedback : strengthsFromScores;
  const analyzedAtLabel = formatTechniqueTimestamp(report.created_at);
  const summary =
    typeof feedback.summary === "string"
      ? feedback.summary
      : `Saved ${report.mode} analysis for ${playerName}. Overall score: ${report.overall_score}/100.`;
  const heading =
    typeof feedback.heading === "string"
      ? feedback.heading
      : `${toTitleCase(report.mode)} technique report`;
  const band =
    typeof feedback.band === "string"
      ? feedback.band
      : scoreBand(report.overall_score);

  return {
    overallScore: report.overall_score,
    analyzedAtLabel,
    summary,
    heading,
    band,
    phaseScores,
    strengths,
    findings,
    drills,
    snapshots,
    metadataCards: [
      { label: "Mode", value: toTitleCase(report.mode) },
      { label: "Saved on", value: analyzedAtLabel },
      { label: "Duration", value: report.video_duration ?? "Duration unavailable" },
      { label: "Clip status", value: report.video_url ? "Video saved" : "No source video stored" },
      { label: "Report id", value: report.id.slice(0, 8).toUpperCase() },
      { label: "Export source", value: "Saved Technique AI report" },
    ],
    fileNameBase: `${sanitizeFileNameSegment(playerName || "athlete")}-${sanitizeFileNameSegment(report.mode || "analysis")}-${report.id.slice(0, 8)}-technique-report`,
  };
}

async function captureVideoFrameFromUrl(videoUrl: string | null) {
  if (!videoUrl) {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const timeoutId = window.setTimeout(() => finalize(null), 5000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleFailure);
      video.removeAttribute("src");
      video.load();
    };

    const finalize = (value: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleFailure = () => finalize(null);

    const handleLoadedData = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) {
          finalize(null);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          finalize(null);
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finalize(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        finalize(null);
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleFailure);
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = videoUrl;
    video.load();
  });
}

function TechniqueStoredPdfSheet({
  model,
  playerName,
  videoFrameDataUrl,
}: {
  model: StoredSheetModel;
  playerName: string;
  videoFrameDataUrl: string | null;
}) {
  const whatItChecked = [
    "Setup balance",
    "Backlift shape",
    "Trigger timing",
    "Downswing path",
    "Contact quality",
    "Shot match",
  ];
  const snapshotCards = model.snapshots.slice(0, 4);
  const clipStatus = model.metadataCards.find((item) => item.label === "Clip status")?.value ?? "Saved report";
  const durationLabel = model.metadataCards.find((item) => item.label === "Duration")?.value ?? "Duration unavailable";

  return (
    <div className="w-[960px] bg-[#090f1a] p-8 text-slate-100">
      <div className="space-y-6 rounded-[28px] border border-slate-800 bg-[#0b1220] p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              Game Changrs Technique AI
            </p>
            <h2 className="mt-3 text-[34px] font-semibold leading-tight text-white">
              Batting Analysis Results
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Analyzed on {model.analyzedAtLabel} • Duration: {durationLabel}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {model.summary}
            </p>
          </div>
          <div className="min-w-[220px] rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
              Overall Score
            </p>
            <p className="mt-3 text-5xl font-semibold text-white">{model.overallScore}</p>
            <p className="mt-2 text-sm font-medium text-emerald-200">{model.band}</p>
            <p className="mt-1 text-xs text-slate-400">Prepared for {playerName}</p>
          </div>
        </div>

        <section className="rounded-[24px] border border-slate-800 bg-[#111827] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <span className="text-emerald-300">◌</span>
            <span>Analyzed Video</span>
          </div>
          <div className="mt-4 grid gap-5 [grid-template-columns:340px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0b1220]">
              {videoFrameDataUrl ? (
                <img
                  src={videoFrameDataUrl}
                  alt="Captured batting frame used for the saved Technique AI report"
                  className="h-[320px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center px-8 text-center text-sm leading-6 text-slate-400">
                  {clipStatus}. The saved report below still preserves the latest executive PDF format.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {model.metadataCards.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-700 bg-[#0b1220] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-4">
                <p className="text-sm font-medium text-white">What the tracker checked</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {whatItChecked.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-emerald-400/20 bg-[#0b1220] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {model.snapshots.find((item) => item.title === "Model cues")?.copy
                    ?? "The report scored setup, backlift, trigger, downswing, contact, and shot-match signals from the saved clip."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-800 bg-[#111827] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <span className="text-emerald-300">◌</span>
            <span>Batting Technique Analysis</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-700 bg-[#0b1220] p-5 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-slate-700 bg-[#111827]">
                <div>
                  <p className="text-4xl font-semibold text-rose-400">{model.overallScore}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">out of 100</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-[#0b1220] p-5">
              <p className="text-2xl font-semibold text-white">{model.heading}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your batting technique analysis for {playerName}. Overall score: {model.overallScore}/100.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <span className="text-emerald-300">◌</span>
            <span>Technical Breakdown</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {model.phaseScores.map((phase) => (
              <div key={phase.key} className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{phase.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${phaseTone(phase.score)}`}>
                    {scoreLabel(phase.score)}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold text-white">{phase.score}</p>
                  <p className="text-xs text-slate-500">/100</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300"
                    style={{ width: `${phase.score}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {phase.score >= 75
                    ? `Your ${phase.label.toLowerCase()} shows good fundamentals.`
                    : `Your ${phase.label.toLowerCase()} shows good fundamentals but still needs tightening.`}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5">
            <p className="text-sm font-medium text-white">Strengths</p>
            <div className="mt-4 space-y-3">
              {model.strengths.length ? model.strengths.map((strength, index) => (
                <div key={`${strength}-${index}`} className="rounded-xl border border-emerald-400/10 bg-[#0b1220] p-3">
                  <p className="text-sm leading-6 text-slate-300">{strength}</p>
                </div>
              )) : (
                <p className="text-sm leading-6 text-slate-300">
                  No single phase separated strongly enough to be called out as a major current strength.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-rose-500/20 bg-rose-500/6 p-5">
            <p className="text-sm font-medium text-white">Areas for Improvement</p>
            <div className="mt-4 space-y-3">
              {model.findings.length ? model.findings.map((finding) => (
                <div key={finding.id} className="rounded-xl border border-rose-400/10 bg-[#0b1220] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-100">{finding.title}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${severityTone(finding.severity)}`}>
                      {finding.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{finding.fix}</p>
                  {finding.tip ? <p className="mt-2 text-sm text-amber-200">Tip: {finding.tip}</p> : null}
                </div>
              )) : (
                <p className="text-sm leading-6 text-slate-300">
                  No issue crossed the intervention threshold strongly enough to justify a correction call on this saved report.
                </p>
              )}
            </div>
          </section>
        </div>

        {snapshotCards.length ? (
          <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <span className="text-emerald-300">◌</span>
              <span>Joint Angle Analysis</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {snapshotCards.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-700 bg-[#0b1220] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-100">{item.title}</span>
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.copy}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
          <p className="text-sm font-medium text-white">Comparison to Elite Players</p>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {model.snapshots.find((item) => item.title === "Read quality")?.copy ?? model.summary}
          </p>
        </section>

        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-5">
          <p className="text-sm font-medium text-white">Recommended Next Steps</p>
          <div className="mt-4 space-y-3">
            {model.drills.length ? model.drills.map((drill, index) => (
              <div key={`${drill.title}-${index}`} className="rounded-xl border border-amber-300/10 bg-[#0b1220] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-100">{drill.title}</span>
                  <span className="rounded-full border border-amber-200/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                    {drill.focus}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{drill.description}</p>
              </div>
            )) : (
              <p className="text-sm leading-6 text-slate-300">
                No drill was stored with this report, so no extra corrective step is being shown in the export.
              </p>
            )}
          </div>
        </section>

        <footer className="border-t border-slate-800 pt-5 text-xs leading-6 text-slate-400">
          <div>Copyright © 2026 game-changrs.com and Arth Arun.</div>
          <div>Concept, design direction, analytics framework, and associated code/materials are proprietary.</div>
          <div>All rights reserved.</div>
        </footer>
      </div>
    </div>
  );
}

export async function exportStoredTechniqueReportPdf(
  report: StoredTechniqueAnalysis,
  playerName: string,
) {
  const model = buildStoredSheetModel(report, playerName);
  const videoFrameDataUrl = await captureVideoFrameFromUrl(report.video_url);
  const container = document.createElement("div");
  container.className = "pointer-events-none fixed left-[-20000px] top-0 z-[-1]";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(
      <TechniqueStoredPdfSheet
        model={model}
        playerName={playerName}
        videoFrameDataUrl={videoFrameDataUrl}
      />,
    );

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    const exportTarget = container.firstElementChild;
    if (!(exportTarget instanceof HTMLElement)) {
      throw new Error("The saved report export layout is not ready yet.");
    }

    const pdf = await renderElementPdf(exportTarget, model.fileNameBase);
    return pdf;
  } finally {
    root.unmount();
    container.remove();
  }
}
