import { supabase } from "@/integrations/supabase/client";

type PublicSiteMetricSnapshot = {
  gearDonationCount: number;
  videoAnalysisCount: number;
};

async function countSavedTechniqueVideos(signal?: AbortSignal) {
  const { data: rootEntries, error: rootError } = await supabase.storage
    .from("analysis-videos")
    .list("", { limit: 1000, offset: 0 });

  if (rootError) {
    throw new Error(rootError.message);
  }

  if (signal?.aborted) {
    return 0;
  }

  let totalVideos = 0;

  for (const entry of rootEntries) {
    if (entry.id) {
      totalVideos += 1;
      continue;
    }

    const { data: nestedEntries, error: nestedError } = await supabase.storage
      .from("analysis-videos")
      .list(entry.name, { limit: 1000, offset: 0 });

    if (nestedError) {
      throw new Error(nestedError.message);
    }

    if (signal?.aborted) {
      return 0;
    }

    totalVideos += nestedEntries.filter((nestedEntry) => Boolean(nestedEntry.id)).length;
  }

  return totalVideos;
}

async function fetchLegacyPublicSiteMetricSnapshot(signal?: AbortSignal): Promise<PublicSiteMetricSnapshot> {
  const [{ count: gearDonationCount, error: gearError }, videoAnalysisCount] = await Promise.all([
    supabase
      .from("public_marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("listing_type", "donation"),
    countSavedTechniqueVideos(signal),
  ]);

  if (gearError) {
    throw new Error(gearError.message);
  }

  return {
    gearDonationCount: Number(gearDonationCount ?? 0),
    videoAnalysisCount,
  };
}

export async function fetchPublicSiteMetricSnapshot(signal?: AbortSignal): Promise<PublicSiteMetricSnapshot> {
  if (signal?.aborted) {
    return {
      gearDonationCount: 0,
      videoAnalysisCount: 0,
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_site_metric_snapshot");

    if (error) {
      throw new Error(error.message);
    }

    const snapshot = Array.isArray(data) ? data[0] : data;

    return {
      gearDonationCount: Number(snapshot?.gear_donation_count ?? 0),
      videoAnalysisCount: Number(snapshot?.video_analysis_count ?? 0),
    };
  } catch (_) {
    return fetchLegacyPublicSiteMetricSnapshot(signal);
  };
}
