CREATE OR REPLACE FUNCTION public.get_public_site_metric_snapshot()
RETURNS TABLE (
  gear_donation_count bigint,
  video_analysis_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      SELECT COUNT(*)::bigint
      FROM public.public_marketplace_listings
      WHERE listing_type = 'donation'
    ) AS gear_donation_count,
    (
      SELECT COUNT(*)::bigint
      FROM public.analysis_results
    ) AS video_analysis_count;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_metric_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_metric_snapshot() TO anon, authenticated;
