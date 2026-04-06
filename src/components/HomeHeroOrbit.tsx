export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[540px] items-center justify-center">
      <div className="absolute inset-x-[9%] top-[12%] h-[72%] rounded-[40px] bg-[radial-gradient(circle_at_50%_22%,rgba(220,38,38,0.16),transparent_28%),radial-gradient(circle_at_50%_72%,rgba(56,189,248,0.08),transparent_42%)] blur-3xl" />

      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,18,26,0.92),rgba(9,13,19,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.4)] sm:h-[420px] sm:w-[420px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_34%)]" />
        <div className="absolute inset-x-[10%] top-[11%] h-[1px] bg-gradient-to-r from-transparent via-white/12 to-transparent" />

        <div className="absolute inset-x-[12%] bottom-[19%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-[14%] bottom-[18.4%] h-[120px] rounded-full bg-[radial-gradient(circle_at_50%_100%,rgba(20,83,45,0.22),transparent_62%)] blur-2xl" />

        <div className="absolute left-[17%] top-[28%] h-[6px] w-[160px] -rotate-[14deg] rounded-full bg-gradient-to-r from-transparent via-primary/80 to-primary/10 blur-[1px] animate-ball-trail sm:w-[190px]" />
        <div className="absolute left-[20%] top-[30%] h-[3px] w-[110px] -rotate-[14deg] rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent blur-[0.5px] animate-ball-trail-soft sm:w-[132px]" />

        <div className="absolute inset-x-0 bottom-[18%] flex justify-center">
          <div className="relative h-[176px] w-[182px]">
            <div className="absolute bottom-0 left-0 h-[130px] w-[18px] rounded-full bg-[linear-gradient(180deg,rgba(250,232,196,0.96),rgba(170,125,72,0.94))] shadow-[0_0_24px_rgba(0,0,0,0.22)]" />
            <div className="absolute bottom-0 left-1/2 h-[144px] w-[18px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(252,236,204,0.98),rgba(176,127,72,0.94))] shadow-[0_0_28px_rgba(0,0,0,0.24)] animate-middle-stump-hit origin-bottom" />
            <div className="absolute bottom-0 right-0 h-[130px] w-[18px] rounded-full bg-[linear-gradient(180deg,rgba(250,232,196,0.96),rgba(170,125,72,0.94))] shadow-[0_0_24px_rgba(0,0,0,0.22)]" />

            <div className="absolute left-[3px] top-[32px] h-[8px] w-[46px] rounded-full bg-[linear-gradient(180deg,rgba(244,227,196,0.95),rgba(177,140,91,0.9))]" />
            <div className="absolute right-[3px] top-[32px] h-[8px] w-[46px] rounded-full bg-[linear-gradient(180deg,rgba(244,227,196,0.95),rgba(177,140,91,0.9))]" />

            <div className="absolute left-[22px] top-[26px] h-[10px] w-[54px] rounded-full bg-[linear-gradient(180deg,rgba(255,239,214,1),rgba(184,146,94,0.92))] shadow-[0_6px_16px_rgba(0,0,0,0.2)] animate-bail-left" />
            <div className="absolute right-[22px] top-[26px] h-[10px] w-[54px] rounded-full bg-[linear-gradient(180deg,rgba(255,239,214,1),rgba(184,146,94,0.92))] shadow-[0_6px_16px_rgba(0,0,0,0.2)] animate-bail-right" />

            <div className="absolute inset-x-0 bottom-[-2px] mx-auto h-[16px] w-[138px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_55%,transparent_72%)] blur-[1px]" />
          </div>
        </div>

        <div className="absolute left-[13%] top-[19%] h-[34px] w-[34px] rounded-full border border-[rgba(255,219,219,0.34)] bg-[radial-gradient(circle_at_32%_28%,rgba(255,235,235,0.94),rgba(210,54,54,0.98)_34%,rgba(112,13,13,1)_78%)] shadow-[0_0_34px_rgba(180,25,25,0.52)] animate-cricket-strike">
          <div className="absolute inset-[5px] rounded-full border border-dashed border-[rgba(255,227,227,0.34)]" />
        </div>

        <div className="absolute right-[10%] top-[12%] rounded-full border border-white/10 bg-background/35 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/55 backdrop-blur-md">
          Match Impact
        </div>
      </div>
    </div>
  );
};
