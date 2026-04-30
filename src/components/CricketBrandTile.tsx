import { cn } from "@/lib/utils";

export function CricketBrandTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-[#214b16]",
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 96 96"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
      >
        <defs>
          <linearGradient id="brandGrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ca63a" />
            <stop offset="45%" stopColor="#3c7f1d" />
            <stop offset="100%" stopColor="#214b16" />
          </linearGradient>
          <radialGradient id="brandBall" cx="38%" cy="32%" r="60%">
            <stop offset="0%" stopColor="#f3795e" />
            <stop offset="52%" stopColor="#b11313" />
            <stop offset="100%" stopColor="#680909" />
          </radialGradient>
          <linearGradient id="brandWood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f2ddb6" />
            <stop offset="50%" stopColor="#d5b17a" />
            <stop offset="100%" stopColor="#b98751" />
          </linearGradient>
        </defs>

        <rect width="96" height="96" fill="url(#brandGrass)" />

        <g opacity="0.28" stroke="#8ccc5b" strokeWidth="1.2" strokeLinecap="round">
          <path d="M8 96 18 64" />
          <path d="M16 96 23 58" />
          <path d="M24 96 28 62" />
          <path d="M32 96 35 54" />
          <path d="M40 96 42 60" />
          <path d="M48 96 49 55" />
          <path d="M56 96 58 61" />
          <path d="M64 96 70 53" />
          <path d="M74 96 79 58" />
          <path d="M84 96 87 63" />
        </g>

        <g transform="rotate(-25 34 66)">
          <rect x="7" y="58" width="46" height="10" rx="5" fill="url(#brandWood)" />
          <rect x="46" y="60" width="15" height="6" rx="3" fill="#c79d69" opacity="0.9" />
        </g>

        <g transform="rotate(35 63 69)">
          <rect x="52" y="63" width="27" height="9" rx="4.5" fill="url(#brandWood)" />
          <rect x="50" y="64.5" width="7" height="6" rx="3" fill="#c79d69" opacity="0.9" />
        </g>

        <ellipse cx="44" cy="38" rx="22" ry="21" fill="url(#brandBall)" />
        <ellipse cx="38" cy="31" rx="8" ry="6" fill="#ffb59f" opacity="0.35" />
        <g transform="rotate(14 44 38)" stroke="#f3d4bd" strokeWidth="1.8" opacity="0.9">
          <path d="M34 18c5 9 8 20 9 40" />
          <path d="M39 16c5 9 8 21 9 42" />
          <path d="M44 16c5 9 8 21 9 42" />
          <path d="M49 17c5 9 8 20 9 40" />
        </g>

        <ellipse cx="42" cy="71" rx="30" ry="10" fill="#12260d" opacity="0.28" />
      </svg>
    </div>
  );
}
