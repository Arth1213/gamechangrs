import { useState } from "react";

const HOME_HERO_VIDEOS = [
  "/home-hero-bat-swing.mp4",
  "/home-hero-bat-swing-alt.mp4",
  "/home-hero-bat-swing-alt-2.mp4",
  "/home-hero-bat-swing-alt-3.mp4",
];

const HOME_HERO_VIDEO_INDEX_KEY = "gamechangrs-home-hero-video-index";

export const HomeHeroOrbit = () => {
  const [videoSrc] = useState(() => {
    if (typeof window === "undefined") {
      return HOME_HERO_VIDEOS[0];
    }

    const storedIndex = Number.parseInt(
      window.localStorage.getItem(HOME_HERO_VIDEO_INDEX_KEY) ?? "",
      10,
    );
    const nextIndex =
      Number.isInteger(storedIndex) && storedIndex >= 0
        ? (storedIndex + 1) % HOME_HERO_VIDEOS.length
        : 0;

    window.localStorage.setItem(HOME_HERO_VIDEO_INDEX_KEY, String(nextIndex));
    return HOME_HERO_VIDEOS[nextIndex];
  });

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
