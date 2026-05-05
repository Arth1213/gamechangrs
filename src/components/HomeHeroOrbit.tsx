import { useState } from "react";

export const HomeHeroOrbit = () => {
  const [videoSrc] = useState(() =>
    Math.random() < 0.5 ? "/home-hero-bat-swing.mp4" : "/home-hero-bat-swing-alt.mp4",
  );

  return (
    <div className="relative mx-auto flex w-full max-w-[700px] items-center justify-center">
      <div className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#040a10] shadow-[0_26px_80px_rgba(0,0,0,0.42)]">
        <div className="aspect-[784/470] w-full bg-[#040a10]">
          <video
            src={videoSrc}
            className="h-full w-full object-contain"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label="Animated cricket batting sequence"
          />
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/6" />
      </div>
    </div>
  );
};
