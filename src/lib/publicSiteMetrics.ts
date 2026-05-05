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

export async function fetchPublicSiteMetricSnapshot(signal?: AbortSignal): Promise<PublicSiteMetricSnapshot> {
  if (signal?.aborted) {
    return {
      gearDonationCount: 0,
      videoAnalysisCount: 0,
    };
  }

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
