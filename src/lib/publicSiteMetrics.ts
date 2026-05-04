import { createClient } from "@supabase/supabase-js";

const requestHeaders = {
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export async function fetchPublicVideoAnalysisCount(signal?: AbortSignal) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-site-metrics`,
      {
        method: "GET",
        headers: requestHeaders,
        signal,
      }
    );

    if (response.ok) {
      const payload = (await response.json()) as { videoAnalysisCount?: number | null };
      return typeof payload.videoAnalysisCount === "number" ? payload.videoAnalysisCount : null;
    }
  } catch (_) {
    // Fall through to storage-based fallback.
  }

  const { data, error } = await supabase.storage
    .from("analysis-videos")
    .list("", { limit: 1000, offset: 0 });

  if (error) {
    throw new Error(error.message);
  }

  return data.length;
}

export async function fetchPublicGearDonationCount() {
  const { count, error } = await supabase
    .from("public_marketplace_listings")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("listing_type", "donation");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
