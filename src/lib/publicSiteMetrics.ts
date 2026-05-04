import { supabase } from "@/integrations/supabase/client";

export async function fetchPublicVideoAnalysisCount(signal?: AbortSignal) {
  if (signal?.aborted) {
    return 0;
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
