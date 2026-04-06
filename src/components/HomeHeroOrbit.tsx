export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[540px] items-center justify-center">
      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,18,26,0.92),rgba(9,13,19,0.98))] shadow-[0_30px_90px_rgba(0,0,0,0.4)] sm:h-[420px] sm:w-[420px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_34%)]" />
        <div className="absolute inset-x-[10%] top-[11%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="absolute inset-x-[12%] bottom-[19%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-[14%] bottom-[18.4%] h-[100px] rounded-full bg-[radial-gradient(circle_at_50%_100%,rgba(20,83,45,0.16),transparent_62%)] blur-2xl" />

        <div className="absolute left-[8%] top-[26%] h-[12px] w-[200px] -rotate-[14deg] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.08)_26%,rgba(190,32,32,0.36)_62%,rgba(125,16,16,0.04))] blur-[2px] animate-ball-rush sm:w-[248px]" />
        <div className="absolute left-[11%] top-[28%] h-[5px] w-[156px] -rotate-[14deg] rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent blur-[0.8px] animate-ball-trail sm:w-[186px]" />
        <div className="absolute left-[14%] top-[29.5%] h-[2px] w-[108px] -rotate-[14deg] rounded-full bg-gradient-to-r from-transparent via-white/32 to-transparent blur-[0.4px] animate-ball-trail-soft sm:w-[126px]" />

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

        <div className="absolute left-[10%] top-[18%] h-[36px] w-[36px] rounded-full border border-[rgba(255,226,226,0.16)] bg-[radial-gradient(circle_at_30%_28%,rgba(255,240,240,0.92),rgba(197,33,33,0.98)_34%,rgba(104,12,12,1)_76%)] shadow-[0_14px_28px_rgba(0,0,0,0.28)] animate-cricket-strike">
          <div className="absolute inset-[4px] rounded-full border border-dashed border-[rgba(255,233,233,0.24)]" />
          <div className="absolute left-[7px] top-[6px] h-[22px] w-[3px] rotate-[14deg] rounded-full bg-[rgba(255,225,225,0.82)]" />
          <div className="absolute right-[7px] top-[6px] h-[22px] w-[3px] -rotate-[14deg] rounded-full bg-[rgba(255,225,225,0.82)]" />
        </div>

        <div className="absolute right-[10%] top-[12%] rounded-full border border-white/10 bg-background/25 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/55 backdrop-blur-md">
          Match Impact
        </div>
      </div>
    </div>
  );
};
