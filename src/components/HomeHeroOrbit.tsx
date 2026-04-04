export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute inset-[10%] rounded-full border border-primary/10" />

      <div className="relative h-[360px] w-[360px] sm:h-[420px] sm:w-[420px]">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-[13%] rounded-full border border-primary/15" />
        <div className="absolute inset-[27%] rounded-full border border-accent/10" />

        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/20 animate-orbit-spin" />

        <div className="absolute left-1/2 top-1/2 h-[212px] w-[212px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8 animate-orbit-reverse" />

        <div className="absolute left-1/2 top-1/2 h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent_45%),linear-gradient(145deg,rgba(18,25,34,0.95),rgba(7,11,16,0.9))] shadow-[0_0_80px_rgba(56,189,248,0.08)]" />

        <div className="absolute left-1/2 top-1/2 h-[190px] w-[72px] -translate-x-1/2 -translate-y-1/2 rotate-[18deg]">
          <div className="absolute left-1/2 top-0 h-[132px] w-[38px] -translate-x-1/2 rounded-[999px] border border-[rgba(255,232,198,0.28)] bg-[linear-gradient(180deg,rgba(214,187,147,0.98),rgba(150,103,54,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_18px_40px_rgba(0,0,0,0.35)]" />
          <div className="absolute bottom-0 left-1/2 h-[86px] w-[18px] -translate-x-1/2 rounded-b-[999px] rounded-t-[18px] bg-[linear-gradient(180deg,rgba(111,69,35,0.98),rgba(62,35,18,1))]" />
          <div className="absolute left-1/2 top-[18px] h-[26px] w-[46px] -translate-x-1/2 rounded-full border border-[rgba(255,244,220,0.25)] bg-[linear-gradient(180deg,rgba(229,207,170,0.95),rgba(183,136,82,0.95))] blur-[0.2px]" />
        </div>

        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 animate-orbit-spin">
          <div className="absolute left-1/2 top-0 h-[42px] w-[42px] -translate-x-1/2 rounded-full border border-[rgba(255,219,219,0.35)] bg-[radial-gradient(circle_at_32%_28%,rgba(255,235,235,0.9),rgba(210,54,54,0.95)_35%,rgba(112,13,13,1)_78%)] shadow-[0_0_30px_rgba(180,25,25,0.55)]">
            <div className="absolute inset-[6px] rounded-full border border-dashed border-[rgba(255,227,227,0.35)]" />
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 h-[212px] w-[212px] -translate-x-1/2 -translate-y-1/2 animate-orbit-reverse opacity-55">
          <div className="absolute left-1/2 top-0 h-[18px] w-[18px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.65),rgba(56,189,248,0.4)_45%,rgba(10,25,47,0.05)_78%)] blur-[1px]" />
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-background/45 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-white/55 backdrop-blur-md">
          Batting System
        </div>
      </div>
    </div>
  );
};
