export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[640px] items-center justify-center">
      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[38px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,18,1),rgba(11,16,24,0.98)_46%,rgba(6,10,15,1))] shadow-[0_32px_100px_rgba(0,0,0,0.46)] sm:h-[420px] sm:w-[420px]">
        <img
          src="/home-hero-cricket.png"
          alt="Cricket stadium action"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,17,0.18),rgba(7,11,17,0.02)_32%,rgba(7,11,17,0.22)_72%,rgba(7,11,17,0.52))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.14),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(220,38,38,0.08),transparent_26%)]" />
        <div className="absolute inset-x-[8%] top-[11%] h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
        <div className="absolute inset-x-[12%] bottom-[11%] h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
      </div>
    </div>
  );
};
