export const StatsSection = () => {
  const stats = [
    { value: "10K+", label: "Athletes Analyzed" },
    { value: "500+", label: "Youth Teams" },
    { value: "98%", label: "Accuracy Rate" },
    { value: "5K+", label: "Gear Donated" },
  ];

  return (
    <section className="py-20 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="font-display text-4xl md:text-5xl font-bold text-gradient-primary mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground text-sm md:text-base">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
