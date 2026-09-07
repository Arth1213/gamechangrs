export function visibleHomepageStats({ playerCount, computedMatchCount, videoAnalysisCount, gearDonationCount }) {
  const stats = [
    { value: playerCount, label: "Athletes Analyzed" },
    { value: computedMatchCount, label: "Matches Analyzed" },
  ];

  if (videoAnalysisCount !== 1) stats.push({ value: videoAnalysisCount, label: "Videos Analyzed" });
  if (gearDonationCount !== 1) stats.push({ value: gearDonationCount, label: "Gears Donated" });

  return stats;
}
