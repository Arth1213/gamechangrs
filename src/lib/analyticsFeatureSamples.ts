export type AnalyticsFeatureSampleId = "player-assessment" | "player-intelligence";

export type AnalyticsSampleMask = {
  left: number;
  top: number;
  width: number;
  height: number;
  className?: string;
};

export type AnalyticsFeatureSample = {
  id: AnalyticsFeatureSampleId;
  title: string;
  badgeLabel: string;
  description: string;
  audience: string;
  path: string;
  previewContentType: "image" | "html";
  previewSrc: string;
  previewAlt: string;
  sampleHtmlSrc: string;
  cardFrameClassName: string;
  cardContentClassName: string;
  pageContainerClassName: string;
  pageFrameClassName: string;
  pageContentClassName: string;
  pageMinHeightPx: number;
  previewMasks: AnalyticsSampleMask[];
  previewNote: string;
  standaloneContext: string;
};

export const ANALYTICS_FEATURE_SAMPLES: AnalyticsFeatureSample[] = [
  {
    id: "player-assessment",
    title: "Player Assessment",
    badgeLabel: "Live Feature",
    description:
      "Gives coaches and selectors a decision-ready player assessment to support development planning and selection calls.",
    audience:
      "Built for coaches and selectors who need one clear assessment view instead of stitching together raw scorecards and disconnected stats.",
    path: "/analytics/samples/player-assessment",
    previewContentType: "html",
    previewSrc: "/analytics-samples/player-assessment-standalone.html",
    previewAlt: "Player Assessment sample preview.",
    sampleHtmlSrc: "/analytics-samples/player-assessment-standalone.html",
    cardFrameClassName: "aspect-[16/11]",
    cardContentClassName: "",
    pageContainerClassName: "max-w-4xl",
    pageFrameClassName: "aspect-[16/11]",
    pageContentClassName: "bg-[#07131d]",
    pageMinHeightPx: 2500,
    previewMasks: [],
    previewNote: "Public standalone preview. Sample player labels are anonymized.",
    standaloneContext: "Standalone assessment sample sourced from the USA U15 Hub report flow.",
  },
  {
    id: "player-intelligence",
    title: "Player Intelligence",
    badgeLabel: "Live Feature",
    description:
      "Gives teams actionable intelligence they can use against opposition players or to shape match strategy before and during a series.",
    audience:
      "Built for analysts, coaches, and team decision-makers who need matchup clues, pressure signals, and tactical reads from the same report shell.",
    path: "/analytics/samples/player-intelligence",
    previewContentType: "html",
    previewSrc: "/analytics-samples/player-intelligence-standalone.html",
    previewAlt: "Player Intelligence sample preview.",
    sampleHtmlSrc: "/analytics-samples/player-intelligence-standalone.html",
    cardFrameClassName: "aspect-[16/11]",
    cardContentClassName: "",
    pageContainerClassName: "max-w-7xl",
    pageFrameClassName: "aspect-[16/11]",
    pageContentClassName: "bg-[#05080d]",
    pageMinHeightPx: 2700,
    previewMasks: [],
    previewNote: "Public standalone preview. Sample player labels are anonymized.",
    standaloneContext: "Standalone intelligence sample sourced from the MiLC report flow.",
  },
];

export const ANALYTICS_UPCOMING_FEATURES = [
  "Match Intelligence",
  "Team Intelligence",
  "More to come",
];

export function getAnalyticsFeatureSample(sampleId?: string | null) {
  return ANALYTICS_FEATURE_SAMPLES.find((sample) => sample.id === sampleId) ?? null;
}
