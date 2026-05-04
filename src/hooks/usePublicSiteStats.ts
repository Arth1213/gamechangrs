import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchCricketDashboardSummary } from "@/lib/cricketApi";
import {
  fetchPublicGearDonationCount,
  fetchPublicVideoAnalysisCount,
} from "@/lib/publicSiteMetrics";

type PublicSiteStats = {
  playerCount: number | null;
  computedMatchCount: number | null;
  gearDonationCount: number | null;
  videoAnalysisCount: number | null;
};

const DEFAULT_PUBLIC_SITE_STATS: PublicSiteStats = {
  playerCount: null,
  computedMatchCount: null,
  gearDonationCount: null,
  videoAnalysisCount: null,
};

const PUBLIC_SITE_STATS_REFRESH_INTERVAL_MS = 60_000;

export function usePublicSiteStats() {
  const [stats, setStats] = useState<PublicSiteStats>(DEFAULT_PUBLIC_SITE_STATS);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    let refreshId = 0;

    function updateStats(partial: Partial<PublicSiteStats>, requestId: number) {
      if (!isActive || requestId !== refreshId) {
        return;
      }

      setStats((current) => ({
        ...current,
        ...partial,
      }));
    }

    async function loadCricketStats(requestId: number) {
      try {
        const dashboardSummary = await fetchCricketDashboardSummary(controller.signal);
        if (controller.signal.aborted || !isActive || requestId !== refreshId) {
          return;
        }

        const seriesCards = dashboardSummary.seriesCards ?? [];
        const playerCount = seriesCards.reduce((sum, card) => sum + (card.playerCount ?? 0), 0);
        const computedMatchCount = seriesCards.reduce((sum, card) => sum + (card.computedMatches ?? 0), 0);

        updateStats({
          playerCount,
          computedMatchCount,
        }, requestId);
      } catch (_) {
        if (controller.signal.aborted) {
          return;
        }
      }
    }

    async function loadGearDonationCount(requestId: number) {
      try {
        const gearDonationCount = await fetchPublicGearDonationCount();
        updateStats({ gearDonationCount }, requestId);
      } catch (_) {
        // Preserve the last successful value if the refresh fails.
      }
    }

    async function loadVideoAnalysisCount(requestId: number) {
      try {
        const videoAnalysisCount = await fetchPublicVideoAnalysisCount(controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        updateStats({ videoAnalysisCount }, requestId);
      } catch (_) {
        if (controller.signal.aborted) {
          return;
        }
      }
    }

    function refreshStats() {
      refreshId += 1;
      const requestId = refreshId;

      void loadCricketStats(requestId);
      void loadGearDonationCount(requestId);
      void loadVideoAnalysisCount(requestId);
    }

    refreshStats();

    const refreshTimer = window.setInterval(refreshStats, PUBLIC_SITE_STATS_REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel("public-site-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketplace_listings" },
        () => {
          refreshStats();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      controller.abort();
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
