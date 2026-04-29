function createUnsupportedAdapter(key, label) {
  return {
    key,
    label,
    supported: false,
    async probe({ url, label: seriesLabel }) {
      return {
        adapter: {
          key,
          label,
          supported: false,
          detectionMethod: "explicit-or-hostname",
          variantKey: "adapter-not-implemented",
        },
        sourceContext: {
          url,
        },
        capabilities: {
          scorecards: {
            status: "unknown",
            notes: [`${label} probing is not implemented yet.`],
          },
          ballByBall: {
            status: "unknown",
            notes: [`${label} probing is not implemented yet.`],
          },
          playerProfiles: {
            status: "unknown",
            notes: [`${label} probing is not implemented yet.`],
          },
          standings: {
            status: "unknown",
            notes: [`${label} probing is not implemented yet.`],
          },
          divisions: {
            status: "unknown",
            notes: [`${label} probing is not implemented yet.`],
          },
          executiveReport: {
            status: "blocked",
            notes: [`${label} onboarding is blocked until a source adapter is implemented.`],
          },
          intelligenceReport: {
            status: "blocked",
            notes: [`${label} onboarding is blocked until a source adapter is implemented.`],
          },
        },
        requiredOperatorInputs: [
          `Implement a ${label} source adapter before onboarding ${seriesLabel || "this series"}.`,
        ],
        warnings: [
          `${label} is recognized as a future source family, but this first local-ops slice only implements CricClubs probing.`,
        ],
        recommendedNextActions: [
          `Stop before extraction and add a dedicated ${label} adapter.`,
          "Document the source-specific URLs, pages, and fields needed for executive and intelligence reports.",
        ],
      };
    },
  };
}

module.exports = {
  createUnsupportedAdapter,
};
