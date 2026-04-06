export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center">
      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[38px] border border-white/8 bg-[linear-gradient(180deg,rgba(7,11,17,0.98),rgba(10,15,23,0.98)_45%,rgba(5,10,15,1))] shadow-[0_32px_100px_rgba(0,0,0,0.45)] sm:h-[420px] sm:w-[420px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.12),transparent_32%)]" />
        <div className="absolute inset-x-[8%] top-[16%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="absolute left-[7%] top-[14%] h-[76px] w-[76px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),rgba(255,255,255,0.03)_48%,transparent_70%)] blur-xl animate-stadium-light-pulse" />
        <div className="absolute right-[8%] top-[12%] h-[88px] w-[88px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.24),rgba(255,255,255,0.03)_46%,transparent_72%)] blur-xl animate-stadium-light-pulse [animation-delay:0.8s]" />

        <svg
          viewBox="0 0 420 420"
          className="h-full w-full animate-cricket-scene-float"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(151,111,63,0.94)" />
              <stop offset="100%" stopColor="rgba(88,58,30,0.98)" />
            </linearGradient>
            <linearGradient id="crease" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.92)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <linearGradient id="batBlade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(238,216,184,0.98)" />
              <stop offset="100%" stopColor="rgba(159,108,57,0.96)" />
            </linearGradient>
            <linearGradient id="batHandle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(121,77,42,1)" />
              <stop offset="100%" stopColor="rgba(61,36,18,1)" />
            </linearGradient>
            <radialGradient id="ball" cx="0.32" cy="0.28" r="0.72">
              <stop offset="0%" stopColor="rgba(255,241,241,0.96)" />
              <stop offset="32%" stopColor="rgba(214,60,60,0.98)" />
              <stop offset="80%" stopColor="rgba(116,13,13,1)" />
            </radialGradient>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="rgba(255,255,255,0.12)" />
            </filter>
          </defs>

          <ellipse cx="210" cy="352" rx="156" ry="20" fill="rgba(0,0,0,0.32)" />

          <path
            d="M90 344C128 295 165 204 210 114C255 204 292 295 330 344H90Z"
            fill="url(#pitch)"
            opacity="0.96"
          />
          <path d="M128 286H292" stroke="url(#crease)" strokeWidth="3" opacity="0.9" />
          <path d="M154 224H266" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" opacity="0.55" />
          <path d="M176 176H244" stroke="rgba(255,255,255,0.18)" strokeWidth="1" opacity="0.5" />

          <g opacity="0.42">
            <path d="M46 144C84 124 125 116 170 120" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <path d="M250 120C295 116 336 124 374 144" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <path d="M34 168C78 148 125 140 176 144" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
            <path d="M244 144C295 140 342 148 386 168" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
          </g>

          <g className="animate-stumps-glint">
            <rect x="202" y="136" width="5" height="34" rx="2.5" fill="rgba(244,226,199,0.95)" />
            <rect x="210" y="136" width="5" height="34" rx="2.5" fill="rgba(244,226,199,0.98)" />
            <rect x="218" y="136" width="5" height="34" rx="2.5" fill="rgba(244,226,199,0.95)" />
            <rect x="201" y="131" width="12" height="3.5" rx="1.75" fill="rgba(255,239,214,0.92)" />
            <rect x="212" y="131" width="12" height="3.5" rx="1.75" fill="rgba(255,239,214,0.92)" />
          </g>

          <g className="animate-bat-swing" transform="rotate(26 118 294)">
            <rect x="114" y="214" width="14" height="112" rx="7" fill="url(#batBlade)" />
            <rect x="117" y="186" width="8" height="38" rx="4" fill="url(#batHandle)" />
            <rect x="116" y="230" width="10" height="54" rx="5" fill="rgba(255,255,255,0.12)" />
          </g>

          <g filter="url(#glow)">
            <path
              className="animate-cover-trail-wide"
              d="M126 278C168 266 210 250 254 226C298 201 337 173 370 144"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              className="animate-cover-trail-mid"
              d="M128 276C170 264 212 248 256 224C298 201 336 174 366 147"
              stroke="rgba(255,255,255,0.26)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              className="animate-cover-trail-core"
              d="M130 275C172 263 214 247 258 223C300 200 337 175 364 150"
              stroke="rgba(255,255,255,0.56)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="2 8"
            />
          </g>

          <g className="animate-cover-ball">
            <circle cx="132" cy="275" r="11" fill="url(#ball)" />
            <path d="M126 268C130 271 134 273 138 276" stroke="rgba(255,228,228,0.72)" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M126 282C130 279 134 277 138 274" stroke="rgba(255,228,228,0.72)" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
};
