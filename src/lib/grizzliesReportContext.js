const grizzlies2026NccaSeriesKey = "bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a";

export function getGrizzliesReportContext(seriesConfigKey) {
  if (String(seriesConfigKey || "").trim() !== grizzlies2026NccaSeriesKey) {
    return null;
  }

  return {
    backPath: "/analytics/grizzlies/2026",
    titlePrefix: "2026",
    titleAccent: "Grizzlies",
    titleSuffix: "Analytics",
  };
}
