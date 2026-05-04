import { usePublicSiteStats } from "@/hooks/usePublicSiteStats";

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
  const { playerCount, computedMatchCount, gearDonationCount, videoAnalysisCount } = usePublicSiteStats();

  const stats: StatItem[] = [
    { value: formatCount(playerCount), label: "Athletes Analyzed" },
    { value: formatCount(computedMatchCount), label: "Matches Analyzed" },
    { value: formatCount(videoAnalysisCount), label: "Videos Analyzed" },
    { value: formatCount(gearDonationCount), label: "Gears Donated" },
  ];

  return (
    <section className="border-y border-border bg-card py-20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
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
