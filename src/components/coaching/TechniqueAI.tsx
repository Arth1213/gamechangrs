import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Clipboard,
  Dumbbell,
  Eye,
  Info,
  Play,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PoseOverlay } from "@/components/coaching/PoseOverlay";
import { usePoseDetection, type Joint, type PoseFrame } from "@/hooks/usePoseDetection";

type Handedness = "right" | "left";
type CameraAngle = "side-on" | "front-on" | "three-quarter";
type BowlingType = "pace" | "spin" | "mixed";

type ShotType =
  | "straight-drive"
  | "cover-drive"
  | "on-drive"
  | "pull"
  | "hook"
  | "square-cut"
  | "late-cut"
  | "sweep"
  | "slog-sweep-ramp-scoop"
  | "forward-defensive"
  | "backward-defensive"
  | "glance-flick"
  | "back-foot-punch";

type Severity = "critical" | "major" | "minor";
type AnalysisStage = "idle" | "pose" | "scoring" | "complete";

interface ShotProfile {
  label: string;
  cues: string[];
  biases: string[];
}

interface IssueDefinition {
  title: string;
  category: PhaseKey;
  fix: string;
  drill: string;
  tip: string;
}

type PhaseKey =
  | "setup"
  | "backlift"
  | "trigger"
  | "downswing"
  | "contact"
  | "shot";

interface PhaseScore {
  key: PhaseKey;
  label: string;
  weight: number;
  score: number;
}

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  fix: string;
  drill: string;
  tip: string;
  category: PhaseKey;
}

interface Drill {
  title: string;
  focus: string;
  description: string;
}

interface SnapshotItem {
  title: string;
  tag: string;
  copy: string;
}

interface TrackerReport {
  score: number;
  band: string;
  heading: string;
  summary: string;
  phaseScores: PhaseScore[];
  findings: Finding[];
  drills: Drill[];
  snapshots: SnapshotItem[];
}

interface FrameFeature {
  headOffset: number;
  shoulderTilt: number;
  hipTilt: number;
  stanceRatio: number;
  visibilityScore: number;
  batControlVisibility: number;
  hasLowerBodyRead: boolean;
  trailWristLift: number;
  leadWristLift: number;
  wristSeparation: number;
  leadKneeAngle: number;
  trailKneeAngle: number;
  leadElbowAngle: number;
  trailElbowAngle: number;
  trailGripCompactness: number;
  leadGripCompactness: number;
  trailControlSlot: number;
  shoulderRotation: number;
  hipRotation: number;
  handMid: Point;
  leadWrist: Point;
  trailWrist: Point;
  shoulderSpan: number;
  hipsMid: Point;
  shouldersMid: Point;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

const PHASES: Array<{ key: PhaseKey; label: string; weight: number }> = [
  { key: "setup", label: "Setup", weight: 16 },
  { key: "backlift", label: "Backlift", weight: 20 },
  { key: "trigger", label: "Trigger", weight: 14 },
  { key: "downswing", label: "Downswing", weight: 28 },
  { key: "contact", label: "Contact Zone", weight: 12 },
  { key: "shot", label: "Shot Match", weight: 10 },
];

const SHOT_PROFILES: Record<ShotType, ShotProfile> = {
  "straight-drive": {
    label: "Straight Drive",
    cues: ["Head over the line", "Vertical bat path", "Full transfer into the ball"],
    biases: ["front-foot-late", "bat-path-across", "weight-transfer-holds"],
  },
  "cover-drive": {
    label: "Cover Drive",
    cues: ["Front shoulder stays closed", "Stride to the pitch", "Hands under the eyes"],
    biases: ["open-stance", "head-falling-away", "hard-hands"],
  },
  "on-drive": {
    label: "On Drive",
    cues: ["Balanced head line", "Controlled hip release", "Bat close to the pad"],
    biases: ["hip-open-early", "contact-too-early", "weight-transfer-holds"],
  },
  pull: {
    label: "Pull Shot",
    cues: ["Back-foot base stable", "Head stays level", "Hands stay above the ball"],
    biases: ["balance-finish", "head-falling-away", "contact-too-high"],
  },
  hook: {
    label: "Hook Shot",
    cues: ["Strong base", "Eyes level", "Controlled arc"],
    biases: ["head-falling-away", "balance-finish", "bat-path-across"],
  },
  "square-cut": {
    label: "Square Cut",
    cues: ["Back-foot access", "Shoulders stay level", "Contact late enough"],
    biases: ["backlift-low", "contact-too-late", "shoulder-misalignment"],
  },
  "late-cut": {
    label: "Late Cut",
    cues: ["Soft hands", "Delay contact", "Quiet head"],
    biases: ["hard-hands", "contact-too-early", "head-falling-away"],
  },
  sweep: {
    label: "Sweep Shot",
    cues: ["Stable knee base", "Head inside the ball", "Smooth swing arc"],
    biases: ["trigger-late", "balance-finish", "contact-too-high"],
  },
  "slog-sweep-ramp-scoop": {
    label: "Slog Sweep / Ramp / Scoop",
    cues: ["Strong base", "Clear intent early", "Controlled finish"],
    biases: ["trigger-late", "bat-path-across", "balance-finish"],
  },
  "forward-defensive": {
    label: "Forward Defensive",
    cues: ["Stride to line", "Soft hands", "Head in front of the pad"],
    biases: ["front-foot-late", "hard-hands", "contact-too-early"],
  },
  "backward-defensive": {
    label: "Backward Defensive",
    cues: ["Back-foot depth", "Compact backlift", "Body stays quiet"],
    biases: ["trigger-late", "backlift-low", "weight-transfer-holds"],
  },
  "glance-flick": {
    label: "Glance / Flick",
    cues: ["Bat close to body", "Wrist timing", "Late contact"],
    biases: ["contact-too-early", "hard-hands", "weight-transfer-holds"],
  },
  "back-foot-punch": {
    label: "Back-foot Punch",
    cues: ["Back-foot set early", "Head stays over base", "Controlled shoulder line"],
    biases: ["trigger-late", "shoulder-misalignment", "balance-finish"],
  },
};

const ISSUES: Record<string, IssueDefinition> = {
  "open-stance": {
    title: "Base opens too early",
    category: "setup",
    fix: "Square the front shoulder for longer so the base reads line and length before release.",
    drill: "Mirror setup holds with stump alignment and a 3-second pause before the trigger.",
    tip: "Keep the front toe slightly calmer rather than opening the stance immediately.",
  },
  "head-falling-away": {
    title: "Head falls away from the ball line",
    category: "downswing",
    fix: "Keep the nose travelling toward contact so the eyes stay level through the shot.",
    drill: "Drop-feed head-over-ball reps with a cone set just outside off stump.",
    tip: "Feel the chin finishing above the front knee instead of outside the frame.",
  },
  "hard-hands": {
    title: "Bottom hand takes over",
    category: "contact",
    fix: "Soften the lower hand so the bat face can stay straighter into contact.",
    drill: "Top-hand only feed drill, then progress to soft-hands check drives.",
    tip: "Keep grip pressure light until the ball arrives under the eyes.",
  },
  "front-foot-late": {
    title: "Front foot reaches line late",
    category: "downswing",
    fix: "Start the stride sooner so the front foot settles before the hands commit.",
    drill: "Stride-and-freeze reps against underarm feeds with a beat count.",
    tip: "Land the front foot first, then let the hands release.",
  },
  "backlift-low": {
    title: "Backlift stays low",
    category: "backlift",
    fix: "Create a cleaner pickup so the bat can launch from a stronger position.",
    drill: "Backlift checkpoints in the mirror, then slow-motion shadow swings.",
    tip: "Lift with the hands rather than yanking the bat up with the shoulder.",
  },
  "trigger-late": {
    title: "Trigger starts late",
    category: "trigger",
    fix: "Move earlier so the body is loaded before the release point is gone.",
    drill: "Trigger-call drill where a partner cues movement just before release.",
    tip: "The trigger prepares the body; it should not chase the ball.",
  },
  "weight-transfer-holds": {
    title: "Weight transfer stalls",
    category: "downswing",
    fix: "Finish with momentum through the shot instead of freezing on the back side.",
    drill: "Step-through drives focusing on the chest and belt buckle finishing forward.",
    tip: "Your finish should carry through target, not stop at contact.",
  },
  "hip-open-early": {
    title: "Hips open too early",
    category: "downswing",
    fix: "Delay the hip release slightly so the swing path stays connected to the ball line.",
    drill: "Split-step hip timing drill with a pause at launch and controlled release.",
    tip: "Feel the front hip open with the swing, not before it.",
  },
  "shoulder-misalignment": {
    title: "Shoulders tilt off line",
    category: "downswing",
    fix: "Hold a calmer shoulder line so the bat can travel on a straighter path.",
    drill: "Alignment-stick swings keeping the top shoulder from peeling away.",
    tip: "Stack the shoulders over the shot line instead of falling leg side.",
  },
  "bat-path-across": {
    title: "Bat path cuts across the line",
    category: "downswing",
    fix: "Return the swing to a straighter plane that enters and exits through the target.",
    drill: "Gate drill using two cones to force a vertical bat path through contact.",
    tip: "Imagine the bat head travelling to mid-off or mid-on rather than square leg.",
  },
  "contact-too-early": {
    title: "Contact happens too far in front",
    category: "contact",
    fix: "Let the ball come slightly deeper so the hands stay under the eyes.",
    drill: "Late-contact feed drill with a target marker just under the front shoulder.",
    tip: "Wait for the ball to arrive instead of reaching for it.",
  },
  "contact-too-late": {
    title: "Contact happens too late",
    category: "contact",
    fix: "Meet the ball earlier by getting the feet and bat path ready sooner.",
    drill: "Early-meet cue drill with throwdowns and a front-foot timing call.",
    tip: "If the body is late, start the trigger earlier instead of swinging faster.",
  },
  "contact-too-high": {
    title: "Contact height is unstable",
    category: "contact",
    fix: "Match the bounce sooner so the bat meets the ball in a more controllable zone.",
    drill: "Tennis-ball bounce reading drill with repeated contact-height checkpoints.",
    tip: "Track the bounce with the head level and let the hands adjust under it.",
  },
  "balance-finish": {
    title: "Finish loses balance",
    category: "downswing",
    fix: "Hold posture through the finish so the final frame still looks controlled.",
    drill: "Hit-and-hold finish drill with a 2-second balance freeze after every rep.",
    tip: "A stable finish usually means the earlier movement sequence was cleaner too.",
  },
};

const STAGE_INDEX: Record<AnalysisStage, number> = {
  idle: 0,
  pose: 35,
  scoring: 72,
  complete: 100,
};

function getJoint(joints: Joint[], name: string) {
  return joints.find((joint) => joint.name === name && joint.visibility > 0.45) ?? null;
}

function toPoint(joint: Joint): Point {
  return { x: joint.x, y: joint.y, z: joint.z ?? 0 };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function range(values: number[]) {
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function averagePoint(points: Point[]): Point {
  if (!points.length) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
    z: average(points.map((point) => point.z)),
  };
}

function pathDistance(points: Point[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function severityFromScore(score: number): Severity {
  if (score < 58) return "critical";
  if (score < 70) return "major";
  return "minor";
}

function getBand(score: number) {
  if (score >= 90) return "Elite base";
  if (score >= 80) return "Strong base";
  if (score >= 70) return "Match ready";
  if (score >= 60) return "Raw but workable";
  return "Major rebuild";
}

function scoreLabel(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 75) return "good";
  if (score >= 65) return "needs work";
  return "priority fix";
}

function buildFrameFeature(frame: PoseFrame, handedness: Handedness): FrameFeature | null {
  const leadPrefix = handedness === "right" ? "left" : "right";
  const trailPrefix = handedness === "right" ? "right" : "left";

  const nose = getJoint(frame.joints, "nose");
  const leftShoulder = getJoint(frame.joints, "left_shoulder");
  const rightShoulder = getJoint(frame.joints, "right_shoulder");
  const leftHip = getJoint(frame.joints, "left_hip");
  const rightHip = getJoint(frame.joints, "right_hip");
  const leftAnkle = getJoint(frame.joints, "left_ankle");
  const rightAnkle = getJoint(frame.joints, "right_ankle");
  const leadWrist = getJoint(frame.joints, `${leadPrefix}_wrist`);
  const trailWrist = getJoint(frame.joints, `${trailPrefix}_wrist`);
  const leadShoulder = getJoint(frame.joints, `${leadPrefix}_shoulder`);
  const trailShoulder = getJoint(frame.joints, `${trailPrefix}_shoulder`);
  const leadElbow = getJoint(frame.joints, `${leadPrefix}_elbow`);
  const trailElbow = getJoint(frame.joints, `${trailPrefix}_elbow`);
  const leadThumb = getJoint(frame.joints, `${leadPrefix}_thumb`);
  const trailThumb = getJoint(frame.joints, `${trailPrefix}_thumb`);
  const leadIndex = getJoint(frame.joints, `${leadPrefix}_index`);
  const trailIndex = getJoint(frame.joints, `${trailPrefix}_index`);
  const leadPinky = getJoint(frame.joints, `${leadPrefix}_pinky`);
  const trailPinky = getJoint(frame.joints, `${trailPrefix}_pinky`);

  if (
    !nose ||
    !leftShoulder ||
    !rightShoulder ||
    !leadWrist ||
    !trailWrist ||
    !leadShoulder ||
    !trailShoulder
  ) {
    return null;
  }

  const shouldersMid = midpoint(toPoint(leftShoulder), toPoint(rightShoulder));
  const hipsMid =
    leftHip && rightHip ? midpoint(toPoint(leftHip), toPoint(rightHip)) : shouldersMid;
  const shoulderSpan = distance(toPoint(leftShoulder), toPoint(rightShoulder));
  const hipSpan = leftHip && rightHip ? distance(toPoint(leftHip), toPoint(rightHip)) : shoulderSpan;
  const stanceWidth = leftAnkle && rightAnkle ? distance(toPoint(leftAnkle), toPoint(rightAnkle)) : shoulderSpan * 1.45;
  if (shoulderSpan < 0.01 || hipSpan < 0.01) {
    return null;
  }

  const getAngle = (name: string) => frame.angles.find((angle) => angle.name === name)?.value ?? 0;
  const leadHandJoints = [leadWrist, leadThumb, leadIndex, leadPinky].filter(Boolean) as Joint[];
  const trailHandJoints = [trailWrist, trailThumb, trailIndex, trailPinky].filter(Boolean) as Joint[];
  const leadHandCenter = averagePoint(leadHandJoints.map((joint) => toPoint(joint)));
  const trailHandCenter = averagePoint(trailHandJoints.map((joint) => toPoint(joint)));
  const gripCompactness = (joints: Joint[], center: Point) =>
    joints.length > 1 ? average(joints.map((joint) => distance(toPoint(joint), center))) / shoulderSpan : 0.055;
  const trailControlSlot =
    trailElbow ? distance(toPoint(trailElbow), trailHandCenter) / shoulderSpan : 0.34;

  return {
    headOffset: Math.abs(nose.x - hipsMid.x) / shoulderSpan,
    shoulderTilt: Math.abs(leftShoulder.y - rightShoulder.y) / shoulderSpan,
    hipTilt: leftHip && rightHip ? Math.abs(leftHip.y - rightHip.y) / hipSpan : 0,
    stanceRatio: stanceWidth / shoulderSpan,
    visibilityScore: average(
      [
        nose,
        leftShoulder,
        rightShoulder,
        leadWrist,
        trailWrist,
        leftHip,
        rightHip,
        leftAnkle,
        rightAnkle,
      ]
        .filter(Boolean)
        .map((joint) => (joint as Joint).visibility),
    ),
    batControlVisibility: average(
      [
        leadWrist,
        trailWrist,
        leadElbow,
        trailElbow,
        leadThumb,
        trailThumb,
        leadIndex,
        trailIndex,
      ]
        .filter(Boolean)
        .map((joint) => (joint as Joint).visibility),
    ),
    hasLowerBodyRead: Boolean(leftHip && rightHip && leftAnkle && rightAnkle),
    trailWristLift: (trailShoulder.y - trailWrist.y) / shoulderSpan,
    leadWristLift: (leadShoulder.y - leadWrist.y) / shoulderSpan,
    wristSeparation: distance(leadHandCenter, trailHandCenter) / shoulderSpan,
    leadKneeAngle: getAngle(`${leadPrefix}_knee`),
    trailKneeAngle: getAngle(`${trailPrefix}_knee`),
    leadElbowAngle: getAngle(`${leadPrefix}_elbow`),
    trailElbowAngle: getAngle(`${trailPrefix}_elbow`),
    trailGripCompactness: gripCompactness(trailHandJoints, trailHandCenter),
    leadGripCompactness: gripCompactness(leadHandJoints, leadHandCenter),
    trailControlSlot,
    shoulderRotation: Math.abs(leftShoulder.z - rightShoulder.z) / shoulderSpan,
    hipRotation: Math.abs(leftHip.z - rightHip.z) / hipSpan,
    handMid: midpoint(leadHandCenter, trailHandCenter),
    leadWrist: toPoint(leadWrist),
    trailWrist: toPoint(trailWrist),
    shoulderSpan,
    hipsMid,
    shouldersMid,
  };
}

function scoreShotFit(shotType: ShotType, metrics: Record<string, number>) {
  if (["straight-drive", "cover-drive", "on-drive", "forward-defensive"].includes(shotType)) {
    return average([
      metrics.frontFootIntentScore,
      metrics.headStabilityScore,
      metrics.contactScore,
      metrics.batControlScore,
    ]);
  }

  if (["pull", "hook", "square-cut", "late-cut", "backward-defensive", "back-foot-punch"].includes(shotType)) {
    return average([
      metrics.backFootIntentScore,
      metrics.rotationScore,
      metrics.contactScore,
      metrics.batControlScore,
    ]);
  }

  if (["sweep", "slog-sweep-ramp-scoop"].includes(shotType)) {
    return average([
      metrics.sweepIntentScore,
      metrics.swingPlaneScore,
      metrics.contactScore,
      metrics.batControlScore,
    ]);
  }

  return average([
    metrics.contactScore,
    metrics.swingPlaneScore,
    metrics.headStabilityScore,
    metrics.batControlScore,
  ]);
}

function buildReport(
  frames: PoseFrame[],
  context: {
    handedness: Handedness;
    cameraAngle: CameraAngle;
    bowlingType: BowlingType;
    shotType: ShotType;
    fileName: string;
    durationLabel: string;
    totalFrames: number;
  },
): TrackerReport {
  const shotProfile = SHOT_PROFILES[context.shotType];
  const features = frames.map((frame) => buildFrameFeature(frame, context.handedness)).filter(Boolean) as FrameFeature[];

  if (features.length < 2) {
    throw new Error("The clip did not keep the batter visible for long enough to produce a reliable batting read.");
  }

  const first = features[0];
  const middle = features[Math.floor(features.length / 2)];
  const last = features[features.length - 1];
  const headOffsets = features.map((feature) => feature.headOffset);
  const shoulderTilts = features.map((feature) => feature.shoulderTilt);
  const hipTilts = features.map((feature) => feature.hipTilt);
  const visibilityScores = features.map((feature) => feature.visibilityScore);
  const batControlVisibilityScores = features.map((feature) => feature.batControlVisibility);
  const lowerBodyCoverage = average(features.map((feature) => (feature.hasLowerBodyRead ? 1 : 0)));
  const upperBodyOnlyRead = lowerBodyCoverage < 0.45;
  const handPath = pathDistance(features.map((feature) => feature.handMid)) / first.shoulderSpan;
  const hipShift = Math.abs(last.hipsMid.x - first.hipsMid.x) / Math.max(first.stanceRatio, 0.001);
  const trailWristRange = range(features.map((feature) => feature.trailWristLift));
  const leadKneeRange = range(features.map((feature) => feature.leadKneeAngle));
  const shoulderRotationRange = range(features.map((feature) => feature.shoulderRotation));
  const averageGripCompactness = average(
    features.map((feature) => feature.trailGripCompactness + feature.leadGripCompactness),
  );
  const trailControlSlotAverage = average(features.map((feature) => feature.trailControlSlot));
  const trailControlSlotVariance = stdDev(features.map((feature) => feature.trailControlSlot));
  const coverageRatio = features.length / Math.max(context.totalFrames, features.length);
  const averageVisibility = average(visibilityScores);
  const motionReadScore = clamp(
    handPath * 34 + trailWristRange * 48 + leadKneeRange * 0.18 + shoulderRotationRange * 80 + 28,
    30,
    95,
  );

  const metrics = {
    headStabilityScore: clamp(100 - stdDev(headOffsets) * 210 - average(headOffsets) * 92, 30, 94),
    setupBaseScore: upperBodyOnlyRead
      ? clamp(90 - average(shoulderTilts) * 140 - stdDev(headOffsets) * 75, 30, 86)
      : clamp(100 - Math.abs(average(features.map((feature) => feature.stanceRatio)) - 1.45) * 55, 30, 92),
    batControlScore: clamp(
      average([
        clamp(average(batControlVisibilityScores) * 100, 35, 92),
        clamp((average(features.map((feature) => feature.trailWristLift)) + 0.26) * 110, 30, 92),
        clamp(100 - Math.abs(average(features.map((feature) => feature.trailElbowAngle)) - 132) * 0.24, 30, 92),
        clamp(96 - averageGripCompactness * 220, 30, 92),
        clamp(96 - Math.abs(trailControlSlotAverage - 0.34) * 90 - trailControlSlotVariance * 220, 30, 92),
      ]),
      30,
      92,
    ),
    backliftScore: clamp(
      average([
        (average(features.map((feature) => feature.trailWristLift)) + 0.28) * 105,
        100 - Math.abs(average(features.map((feature) => feature.trailElbowAngle)) - 132) * 0.24,
        96 - Math.abs(trailControlSlotAverage - 0.34) * 90,
      ]),
      30,
      92,
    ),
    triggerScore: upperBodyOnlyRead
      ? clamp(78 - stdDev(features.map((feature) => feature.trailWristLift)) * 140, 30, 82)
      : clamp(100 - Math.abs(first.leadKneeAngle - middle.leadKneeAngle) * 0.48, 30, 92),
    rotationScore: clamp((average(features.map((feature) => feature.shoulderRotation + feature.hipRotation)) * 150) + 38, 30, 92),
    swingPlaneScore: clamp(handPath * 30 + 36, 30, 92),
    contactScore: clamp(
      average([
        100 - Math.abs(middle.wristSeparation - 1.02) * 48 - Math.abs(middle.leadElbowAngle - 138) * 0.22,
        100 - Math.abs(middle.trailElbowAngle - 132) * 0.22,
        96 - (middle.trailGripCompactness + middle.leadGripCompactness) * 210,
      ]),
      30,
      92,
    ),
    finishBalanceScore: clamp(100 - (last.headOffset * 98 + average(shoulderTilts) * 95 + average(hipTilts) * 72), 30, 92),
    transferScore: upperBodyOnlyRead ? 58 : clamp(hipShift * 112 + 26, 30, 92),
    frontFootIntentScore: clamp(100 - Math.abs(first.leadKneeAngle - middle.leadKneeAngle) * 0.48 + hipShift * 20, 30, 92),
    backFootIntentScore: clamp(100 - Math.abs(first.trailKneeAngle - middle.trailKneeAngle) * 0.48 + (1 - Math.min(hipShift, 1)) * 20, 30, 92),
    sweepIntentScore: clamp(100 - Math.abs(average(features.map((feature) => (feature.leadKneeAngle + feature.trailKneeAngle) / 2)) - 128) * 0.45, 30, 92),
    clipReadScore: clamp(coverageRatio * 62 + averageVisibility * 38, 30, 95),
    motionReadScore,
  };

  const phaseScores: PhaseScore[] = upperBodyOnlyRead
    ? [
        { key: "setup", label: "Setup", weight: 24, score: Math.round(average([metrics.headStabilityScore, metrics.setupBaseScore])) },
        { key: "backlift", label: "Backlift", weight: 22, score: Math.round(average([metrics.backliftScore, metrics.batControlScore, metrics.headStabilityScore])) },
        { key: "downswing", label: "Downswing", weight: 28, score: Math.round(average([metrics.rotationScore, metrics.swingPlaneScore, metrics.batControlScore, metrics.headStabilityScore])) },
        { key: "contact", label: "Contact Zone", weight: 16, score: Math.round(average([metrics.contactScore, metrics.batControlScore, metrics.headStabilityScore])) },
        { key: "shot", label: "Shot Match", weight: 10, score: Math.round(scoreShotFit(context.shotType, metrics)) },
      ]
    : [
        { key: "setup", label: "Setup", weight: 16, score: Math.round(average([metrics.headStabilityScore, metrics.setupBaseScore])) },
        { key: "backlift", label: "Backlift", weight: 20, score: Math.round(average([metrics.backliftScore, metrics.batControlScore, metrics.headStabilityScore])) },
        { key: "trigger", label: "Trigger", weight: 14, score: Math.round(average([metrics.triggerScore, metrics.setupBaseScore])) },
        { key: "downswing", label: "Downswing", weight: 28, score: Math.round(average([metrics.rotationScore, metrics.swingPlaneScore, metrics.batControlScore, metrics.headStabilityScore])) },
        { key: "contact", label: "Contact Zone", weight: 12, score: Math.round(average([metrics.contactScore, metrics.batControlScore, metrics.headStabilityScore])) },
        { key: "shot", label: "Shot Match", weight: 10, score: Math.round(scoreShotFit(context.shotType, metrics)) },
      ];

  const baseWeightedScore = phaseScores.reduce((sum, phase) => sum + phase.score * (phase.weight / 100), 0);
  const reliabilityPenalty =
    (coverageRatio < 0.45 ? 12 : coverageRatio < 0.6 ? 7 : 0) +
    (averageVisibility < 0.62 ? 8 : averageVisibility < 0.72 ? 4 : 0) +
    (motionReadScore < 52 ? 10 : motionReadScore < 64 ? 5 : 0);
  const weightedScore = Math.round(clamp(baseWeightedScore - reliabilityPenalty, 42, 92));

  const frontFootShots = ["straight-drive", "cover-drive", "on-drive", "forward-defensive"];
  const backFootShots = ["pull", "hook", "square-cut", "late-cut", "backward-defensive", "back-foot-punch"];
  const sweepShots = ["sweep", "slog-sweep-ramp-scoop"];

  const issueIds = new Set<string>();
  if (metrics.headStabilityScore < 64) issueIds.add("head-falling-away");
  if (!upperBodyOnlyRead && metrics.setupBaseScore < 62) issueIds.add("open-stance");
  if (metrics.backliftScore < 61 && context.cameraAngle !== "front-on") issueIds.add("backlift-low");
  if (!upperBodyOnlyRead && metrics.triggerScore < 61) issueIds.add("trigger-late");
  if (metrics.rotationScore < 61 && context.cameraAngle !== "side-on") issueIds.add("shoulder-misalignment");
  if (metrics.swingPlaneScore < 61 && context.cameraAngle !== "front-on") issueIds.add("bat-path-across");
  if (metrics.contactScore < 60) issueIds.add("hard-hands");
  if (metrics.batControlScore < 60) {
    issueIds.add("hard-hands");
    if (context.cameraAngle !== "front-on") issueIds.add("bat-path-across");
  }
  if (!upperBodyOnlyRead && frontFootShots.includes(context.shotType) && metrics.frontFootIntentScore < 61) {
    issueIds.add("front-foot-late");
    if (metrics.rotationScore < 60) issueIds.add("hip-open-early");
  }

  if (!upperBodyOnlyRead && backFootShots.includes(context.shotType) && metrics.backFootIntentScore < 61) {
    issueIds.add("trigger-late");
  }

  if (!upperBodyOnlyRead && sweepShots.includes(context.shotType) && metrics.sweepIntentScore < 61) {
    issueIds.add("contact-too-high");
  }

  const findings = Array.from(issueIds)
    .map((id) => {
      const issue = ISSUES[id];
      if (!issue) return null;
      const categoryScore = phaseScores.find((phase) => phase.key === issue.category)?.score ?? weightedScore;
      return {
        id,
        ...issue,
        severity: severityFromScore(categoryScore),
      } as Finding;
    })
    .filter(Boolean) as Finding[];

  const sortedFindings = findings
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .slice(0, 5);

  const drills = sortedFindings
    .filter((finding) => finding.severity !== "minor")
    .slice(0, 3)
    .map((finding, index) => ({
    title: `${index + 1}. ${finding.drill}`,
    focus: PHASES.find((phase) => phase.key === finding.category)?.label ?? "Skill",
    description: `${finding.fix} Tip: ${finding.tip}`,
    }));

  const strengths = phaseScores
    .filter((phase) => phase.score >= 78)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    score: weightedScore,
    band: getBand(weightedScore),
    heading: `${shotProfile.label} batting review complete`,
    summary:
      coverageRatio < 0.55 || motionReadScore < 60
        ? `The tracker extracted ${features.length} reliable pose frames from ${context.fileName}, but the clip quality or shot sequence was only partially readable. The score is conservative, and only directly observed movement faults are included below.`
        : `The tracker extracted ${features.length} reliable pose frames from ${context.fileName}. Best current shape shows in ${strengths.length ? strengths[0].label.toLowerCase() : "setup"}, while the clearest observed gains come from ${sortedFindings.length ? sortedFindings.slice(0, 3).map((finding) => finding.title.toLowerCase()).join(", ") : "maintaining the current movement sequence"}.`,
    phaseScores,
    findings: sortedFindings,
    drills,
    snapshots: [
      {
        title: "Shot profile",
        tag: "Context",
        copy: `${shotProfile.label} | ${context.handedness}-handed batter | ${context.cameraAngle} | ${context.bowlingType}`,
      },
      {
        title: "Clip read",
        tag: "Pose",
        copy: `${features.length}/${context.totalFrames} frames were usable from a ${context.durationLabel} upload. Pose coverage ${Math.round(coverageRatio * 100)}% | landmark visibility ${Math.round(averageVisibility * 100)}%.`,
      },
      {
        title: "Top strengths",
        tag: "Strength",
        copy: strengths.length
          ? strengths.map((phase) => `${phase.label} ${phase.score}`).join(" | ")
          : "No phase stood out strongly yet.",
      },
      {
        title: "Model cues",
        tag: "Focus",
        copy: shotProfile.cues.join(" | "),
      },
      {
        title: "Bat-control read",
        tag: "Focus",
        copy: `The tracker prioritised wrists, elbows, and hand landmarks around the handle zone so the score stays anchored to the batter's control pattern instead of the whole frame.`,
      },
      {
        title: "Read quality",
        tag: "Guardrail",
        copy:
          upperBodyOnlyRead
            ? "This clip was read in upper-body mode, which lets streamed or cropped footage score without inventing lower-body advice. Hand and wrist control carried more of the scoring weight."
            : motionReadScore < 60
            ? "The clip showed limited full-shot movement, so the model held the score down and avoided speculative drills."
            : "The clip showed enough movement to support a fuller batting read, with extra weight placed on the batter's hand and bat-control zone.",
      },
    ],
  };
}

function severityWeight(severity: Severity) {
  if (severity === "critical") return 3;
  if (severity === "major") return 2;
  return 1;
}

function phaseTone(score: number) {
  if (score >= 85) return "bg-primary/15 text-primary border-primary/20";
  if (score >= 75) return "bg-accent/15 text-accent border-accent/20";
  if (score >= 65) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function severityTone(severity: Severity) {
  if (severity === "critical") return "bg-destructive/10 text-destructive border-destructive/20";
  if (severity === "major") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  return "bg-accent/10 text-accent border-accent/20";
}

export function TechniqueAI() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TrackerReport | null>(null);
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>("side-on");
  const [shotType, setShotType] = useState<ShotType>("straight-drive");
  const [bowlingType, setBowlingType] = useState<BowlingType>("pace");
  const [videoDimensions, setVideoDimensions] = useState({ width: 960, height: 540 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCacheRef = useRef(new Map<string, TrackerReport>());
  const containerRef = useRef<HTMLDivElement>(null);
  const { isProcessing, progress, currentFrame, processVideo, reset, error } = usePoseDetection();

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file.");
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setVideoUrl(nextUrl);
    setAnalysis(null);
    setStage("idle");
    reset();
  };

  const handleVideoLoad = () => {
    if (!videoRef.current || !containerRef.current) return;
    const video = videoRef.current;
    const width = containerRef.current.offsetWidth;
    const aspectRatio = video.videoWidth / video.videoHeight || 16 / 9;
    setVideoDimensions({
      width,
      height: width / aspectRatio,
    });
  };

  const clearVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setSelectedFile(null);
    setVideoUrl(null);
    setAnalysis(null);
    setStage("idle");
    reset();
  };

  const runAnalysis = async () => {
    if (!selectedFile) {
      toast.error("Upload a batting video first.");
      return;
    }

    try {
      const analysisCacheKey = [
        selectedFile.name,
        selectedFile.size,
        selectedFile.lastModified,
        selectedFile.type,
        handedness,
        cameraAngle,
        bowlingType,
        shotType,
      ].join(":");

      const cachedAnalysis = analysisCacheRef.current.get(analysisCacheKey);
      if (cachedAnalysis) {
        setAnalysis(cachedAnalysis);
        setStage("complete");
        toast.success("Batting analysis loaded from the saved clip read.");
        return;
      }

      setStage("pose");
      setAnalysis(null);
      const frames = await processVideo(selectedFile);
      setStage("scoring");

      const validFrames = frames.filter((frame) => frame.joints.length > 0);
      if (validFrames.length < 4) {
        throw new Error("The clip did not show the batter clearly enough across enough frames to score the shot reliably.");
      }

      const durationLabel =
        videoRef.current && Number.isFinite(videoRef.current.duration)
          ? `${videoRef.current.duration.toFixed(1)}s`
          : "short clip";

      const nextReport = buildReport(validFrames, {
        handedness,
        cameraAngle,
        bowlingType,
        shotType,
        fileName: selectedFile.name,
        durationLabel,
        totalFrames: frames.length,
      });

      analysisCacheRef.current.set(analysisCacheKey, nextReport);
      setAnalysis(nextReport);
      setStage("complete");
      toast.success("Batting analysis complete.");
    } catch (analysisError) {
      console.error(analysisError);
      setStage("idle");
      toast.error(
        analysisError instanceof Error ? analysisError.message : "The video could not be analyzed.",
      );
    }
  };

  const copySummary = async () => {
    if (!analysis) return;
    const text = [
      `Game Changrs batting analysis`,
      `Overall score: ${analysis.score} (${analysis.band})`,
      `Top findings: ${analysis.findings.slice(0, 3).map((finding) => finding.title).join(", ")}`,
      `Drills: ${analysis.drills.map((drill) => drill.title).join(" | ")}`,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    toast.success("Analysis summary copied.");
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.05fr,1fr]">
        <section className="rounded-3xl border border-border bg-gradient-card p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                game changrs module
              </p>
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                AI batting analysis tracker
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Replace the old analysis flow with a cleaner batting tracker that reads uploaded
                cricket video, extracts pose landmarks, scores technique, and returns drills.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-primary/80">overall</p>
              <p className="font-display text-3xl font-bold text-foreground">
                {analysis ? analysis.score : "--"}
              </p>
              <p className="text-xs text-muted-foreground">{analysis ? analysis.band : "Awaiting analysis"}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Handedness</span>
              <select
                value={handedness}
                onChange={(event) => setHandedness(event.target.value as Handedness)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground"
              >
                <option value="right">Right-handed batter</option>
                <option value="left">Left-handed batter</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Camera angle</span>
              <select
                value={cameraAngle}
                onChange={(event) => setCameraAngle(event.target.value as CameraAngle)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground"
              >
                <option value="side-on">Side-on</option>
                <option value="front-on">Front-on</option>
                <option value="three-quarter">Three-quarter</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Shot type</span>
              <select
                value={shotType}
                onChange={(event) => setShotType(event.target.value as ShotType)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground"
              >
                {Object.entries(SHOT_PROFILES).map(([value, profile]) => (
                  <option key={value} value={value}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Bowling type</span>
              <select
                value={bowlingType}
                onChange={(event) => setBowlingType(event.target.value as BowlingType)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground"
              >
                <option value="pace">Pace</option>
                <option value="spin">Spin</option>
                <option value="mixed">Mixed / unknown</option>
              </select>
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-primary/10 p-2">
                  <Info className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Best results</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Record the batting clip front-on when possible and keep it around 15-20 seconds
                    so the model has enough movement to process. Once the video is uploaded, you can
                    re-run the analysis without uploading it again unless you want to switch clips.
                    Direct clips of the batter work best; videos filmed off another screen are much
                    harder for pose tracking.
                  </p>
                </div>
              </div>
            </div>

            {!selectedFile ? (
              <label className="relative block cursor-pointer rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/10">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  Upload batting video
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  MP4, MOV, AVI. Front-on clips around 15-20 seconds give the cleanest batting read.
                </p>
              </label>
            ) : (
              <div ref={containerRef} className="space-y-4">
                <div className="relative overflow-hidden rounded-3xl border border-border bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl ?? undefined}
                    onLoadedMetadata={handleVideoLoad}
                    controls={!isProcessing}
                    className="w-full"
                    style={{ maxHeight: "520px" }}
                  />
                  {currentFrame?.joints?.length ? (
                    <PoseOverlay
                      joints={currentFrame.joints}
                      width={videoDimensions.width}
                      height={videoDimensions.height}
                    />
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-3 py-1">{selectedFile.name}</span>
                  <span className="rounded-full border border-border px-3 py-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">
                    {SHOT_PROFILES[shotType].label}
                  </span>
                  <span className="rounded-full border border-border px-3 py-1">{cameraAngle}</span>
                  <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                    Uploaded once - reuse for new analysis runs
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={runAnalysis} disabled={isProcessing} variant="hero">
                    {isProcessing ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {isProcessing ? "Reading pose..." : "Analyze batting clip"}
                  </Button>
                  <Button onClick={copySummary} disabled={!analysis} variant="outline">
                    <Clipboard className="h-4 w-4" />
                    Copy summary
                  </Button>
                  <Button onClick={clearVideo} variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    Remove video
                  </Button>
                </div>

                {(isProcessing || stage === "scoring") && (
                  <div className="space-y-3 rounded-2xl border border-border bg-background/40 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {stage === "pose" ? "Pose extraction in progress" : "Scoring and feedback in progress"}
                      </span>
                      <span className="font-medium text-foreground">
                        {Math.round(stage === "scoring" ? Math.max(progress, 78) : progress)}%
                      </span>
                    </div>
                    <Progress value={stage === "scoring" ? Math.max(progress, 78) : progress} className="h-2" />
                  </div>
                )}

                {error ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-border bg-gradient-card p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                analysis output
              </p>
              <h3 className="font-display text-2xl font-bold text-foreground">
                Score, feedback, drills
              </h3>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-5">
            <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
              {stage === "idle"
                ? "Waiting for upload"
                : stage === "pose"
                  ? "Reading pose landmarks"
                  : stage === "scoring"
                    ? "Scoring technique"
                    : "Analysis complete"}
            </p>
            <h4 className="mt-2 font-display text-xl font-semibold text-foreground">
              {analysis?.heading ?? "Upload a batting video to generate the report."}
            </h4>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {analysis?.summary ??
                "This tracker replaces the old AI video analyzer with a focused batting module: upload, score, feedback, drills, and remove-video support."}
            </p>
            <div className="mt-4">
              <Progress value={STAGE_INDEX[stage]} className="h-2" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Phase scores</h4>
              </div>
              <div className="space-y-3">
                {analysis ? (
                  analysis.phaseScores.map((phase) => (
                    <div key={phase.key} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{phase.label}</span>
                        <span className="text-muted-foreground">
                          {phase.score} · {scoreLabel(phase.score)}
                        </span>
                      </div>
                      <Progress value={phase.score} className="h-2" />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Phase scores will appear here after the clip is analyzed.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Snapshot</h4>
              </div>
              <div className="space-y-3">
                {analysis ? (
                  analysis.snapshots.map((item) => (
                    <div key={item.title} className="space-y-1 rounded-xl border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-foreground">{item.title}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{item.copy}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Clip context and model cues will appear here after analysis.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-foreground">Technical feedback</h4>
            </div>
            <div className="space-y-3">
              {analysis ? (
                analysis.findings.map((finding) => (
                  <div key={finding.id} className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h5 className="font-medium text-foreground">{finding.title}</h5>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${severityTone(finding.severity)}`}>
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{finding.fix}</p>
                    <p className="mt-2 text-sm text-primary">Tip: {finding.tip}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your highest-impact batting faults will appear here after analysis.
                </p>
              )}
              {analysis && analysis.findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No direct technical fault crossed the threshold strongly enough to justify a correction call.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-foreground">Recommended drills</h4>
            </div>
            <div className="space-y-3">
              {analysis ? (
                analysis.drills.map((drill) => (
                  <div key={drill.title} className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h5 className="font-medium text-foreground">{drill.title}</h5>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${phaseTone(80)}`}>
                        {drill.focus}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{drill.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Practice drills and coaching tips will appear here after the tracker scores the clip.
                </p>
              )}
              {analysis && analysis.drills.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No corrective drill is being suggested because the observed issues were not strong enough to justify one.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
