import { usePublicSiteStats } from "@/hooks/usePublicSiteStats";
import { grizzliesPartnership } from "@/lib/grizzliesPartnership";
import { visibleHomepageStats } from "@/lib/publicHomepageStats";

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US").format(value);
}

export const StatsSection = () => {
  const { playerCount, computedMatchCount, gearDonationCount, videoAnalysisCount } = usePublicSiteStats();
  const stats = visibleHomepageStats({ playerCount, computedMatchCount, gearDonationCount, videoAnalysisCount });

  return (
    <section className="border-y border-border bg-card py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 lg:gap-16">
          {stats.map((stat, index) => (
            <div key={stat.label} className="animate-slide-up text-center" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="mb-2 font-display text-4xl font-bold text-gradient-primary md:text-5xl">{formatCount(stat.value)}</div>
              <div className="text-sm text-muted-foreground md:text-base">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center justify-center gap-5 border-t border-border pt-10 text-center sm:flex-row sm:text-left">
          <a href={grizzliesPartnership.websiteUrl} target="_blank" rel="noreferrer" className="shrink-0 transition-transform hover:scale-105" aria-label="Visit Grizzlies website">
            <img src={grizzliesPartnership.logoSrc} alt="San Ramon Grizzlies" className="h-20 w-20 object-contain md:h-24 md:w-24" />
          </a>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {grizzliesPartnership.prefix}{" "}<span className="text-[#ef233c]">{grizzliesPartnership.teamName}</span>
          </p>
        </div>
      </div>
    </section>
  );
};
