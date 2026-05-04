import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchCricketDashboardSummary } from "@/lib/cricketApi";
import {
  fetchPublicGearDonationCount,
  fetchPublicVideoAnalysisCount,
} from "@/lib/publicSiteMetrics";

type PublicSiteStats = {
  playerCount: number | null;
  seriesCount: number | null;
  computedMatchCount: number | null;
  gearDonationCount: number | null;
  videoAnalysisCount: number | null;
};

const DEFAULT_PUBLIC_SITE_STATS: PublicSiteStats = {
  playerCount: null,
  seriesCount: null,
  computedMatchCount: null,
  gearDonationCount: null,
  videoAnalysisCount: null,
};

export function usePublicSiteStats() {
  const [stats, setStats] = useState<PublicSiteStats>(DEFAULT_PUBLIC_SITE_STATS);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        const dashboardSummary = await fetchCricketDashboardSummary(controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        const seriesCards = dashboardSummary.seriesCards ?? [];
        const seriesCount = seriesCards.length;
        const playerCount = seriesCards.reduce((sum, card) => sum + (card.playerCount ?? 0), 0);
        const computedMatchCount = seriesCards.reduce((sum, card) => sum + (card.computedMatches ?? 0), 0);

        const [gearCountResult, videoCountResult] = await Promise.allSettled([
          fetchPublicGearDonationCount(),
          fetchPublicVideoAnalysisCount(controller.signal),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setStats({
          playerCount,
          seriesCount,
          computedMatchCount,
          gearDonationCount: gearCountResult.status === "fulfilled" ? gearCountResult.value : null,
          videoAnalysisCount: videoCountResult.status === "fulfilled" ? videoCountResult.value : null,
        });
      } catch (_) {
        if (controller.signal.aborted) {
          return;
        }
      }
    }

    void loadStats();

    const channel = supabase
      .channel("public-site-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "public_marketplace_listings" },
        () => {
          void loadStats();
        }
      )
      .subscribe();

    return () => {
      controller.abort();
      void supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
