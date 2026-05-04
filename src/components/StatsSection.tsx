import { useEffect, useState } from "react";

import { fetchCricketDashboardSummary } from "@/lib/cricketApi";
import {
  fetchPublicGearDonationCount,
  fetchPublicVideoAnalysisCount,
} from "@/lib/publicSiteMetrics";

type StatItem = {
  label: string;
  value: string;
};

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export const StatsSection = () => {
  const [stats, setStats] = useState<StatItem[]>([
    { value: "--", label: "Athletes Analyzed" },
    { value: "--", label: "Series Analyzed" },
    { value: "--", label: "Matches Analyzed" },
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        const [dashboardSummary, gearDonationCount, videoCount] = await Promise.all([
          fetchCricketDashboardSummary(controller.signal),
          fetchPublicGearDonationCount(),
          fetchPublicVideoAnalysisCount(controller.signal),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        const seriesCards = dashboardSummary.seriesCards ?? [];
        const seriesCount = seriesCards.length;
        const playerCount = seriesCards.reduce((sum, card) => sum + (card.playerCount ?? 0), 0);
        const computedMatchCount = seriesCards.reduce((sum, card) => sum + (card.computedMatches ?? 0), 0);

        const nextStats: StatItem[] = [
          { value: formatCount(playerCount), label: "Athletes Analyzed" },
          { value: formatCount(seriesCount), label: "Series Analyzed" },
          { value: formatCount(computedMatchCount), label: "Matches Analyzed" },
        ];

        if (gearDonationCount > 0) {
          nextStats.push({
            value: formatCount(gearDonationCount),
            label: "Gears Donated",
          });
        }

        if ((videoCount ?? 0) > 0) {
          nextStats.push({
            value: formatCount(videoCount),
            label: "Videos Analyzed",
          });
        }

        setStats(nextStats);
      } catch (_) {
        if (controller.signal.aborted) {
          return;
        }
      }
    }

    loadStats();

    return () => {
      controller.abort();
    };
  }, []);

  const gridClassName =
    stats.length >= 5
      ? "grid grid-cols-2 gap-8 lg:grid-cols-5"
      : stats.length === 4
        ? "grid grid-cols-2 gap-8 lg:grid-cols-4"
        : "grid grid-cols-1 gap-8 sm:grid-cols-3";

  return (
    <section className="border-y border-border bg-card py-20">
      <div className="container mx-auto px-4">
        <div className={gridClassName}>
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="animate-slide-up text-center"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-2 font-display text-4xl font-bold text-gradient-primary md:text-5xl">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground md:text-base">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
