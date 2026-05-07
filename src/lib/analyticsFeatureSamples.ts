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
  previewImageSrc: string;
  previewImageAlt: string;
  cardFrameClassName: string;
  cardImageClassName: string;
  pageContainerClassName: string;
  pageFrameClassName: string;
  pageImageClassName: string;
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
    previewImageSrc: "/analytics-samples/player-assessment-sample.png",
    previewImageAlt: "Blurred standalone Player Assessment sample preview.",
    cardFrameClassName: "aspect-[16/11]",
    cardImageClassName: "object-cover object-top",
    pageContainerClassName: "max-w-4xl",
    pageFrameClassName: "aspect-[1272/1800]",
    pageImageClassName: "object-contain bg-[#07131d]",
    previewMasks: [
      { left: 1.4, top: 5.4, width: 29.8, height: 5.4 },
      { left: 2.5, top: 50.1, width: 37.5, height: 9.4, className: "rounded-[28px]" },
    ],
    previewNote: "Public standalone preview. Player names are intentionally blurred in this sample.",
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
    previewImageSrc: "/analytics-samples/player-intelligence-sample.png",
    previewImageAlt: "Blurred standalone Player Intelligence sample preview.",
    cardFrameClassName: "aspect-[16/11]",
    cardImageClassName: "object-cover object-[50%_20%]",
    pageContainerClassName: "max-w-7xl",
    pageFrameClassName: "aspect-[16/10]",
    pageImageClassName: "object-contain bg-[#05080d]",
    previewMasks: [
      { left: 10.8, top: 10.2, width: 57.8, height: 4.4, className: "rounded-[22px]" },
      { left: 14.0, top: 31.0, width: 26.6, height: 5.1, className: "rounded-[28px]" },
      { left: 18.8, top: 64.1, width: 24.2, height: 4.9, className: "rounded-[28px]" },
    ],
    previewNote: "Public standalone preview. Player names are intentionally blurred in this sample.",
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
