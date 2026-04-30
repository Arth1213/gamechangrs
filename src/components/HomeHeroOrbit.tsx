export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[640px] items-center justify-center">
      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[38px] border border-border/80 bg-card shadow-[0_26px_70px_rgba(0,0,0,0.34)] sm:h-[420px] sm:w-[420px]">
        <video
          src="/home-hero-bat-swing.mp4"
          poster="/home-hero-cricket.png"
          className="h-full w-full object-cover object-center"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label="Animated batting swing graphic"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,17,0.12),rgba(7,11,17,0.04)_34%,rgba(7,11,17,0.18)_72%,rgba(7,11,17,0.42))]" />
        <div className="absolute inset-x-[8%] top-[11%] h-px bg-white/14" />
        <div className="absolute inset-x-[12%] bottom-[11%] h-px bg-white/12" />
      </div>
    </div>
  );
};
