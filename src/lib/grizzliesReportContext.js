const grizzlies2026NccaSeriesKey = "bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a";
const grizzlies2026MilcSeriesKey = "bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug";

export function getGrizzliesReportContext(seriesConfigKey, portalOrigin = null) {
  const key = String(seriesConfigKey || "").trim();
  if (key !== grizzlies2026NccaSeriesKey && !(key === grizzlies2026MilcSeriesKey && portalOrigin === "grizzlies-2026")) {
    return null;
  }

  return {
    backPath: "/analytics/grizzlies/2026",
    titlePrefix: "2026",
    titleAccent: "Grizzlies",
    titleSuffix: "Analytics",
  };
}
