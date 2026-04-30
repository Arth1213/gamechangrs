const lightBanks = [
  { x: 28, y: 40, width: 96, height: 34, innerX: 12, innerWidth: 72 },
  { x: 162, y: 26, width: 96, height: 34, innerX: 12, innerWidth: 72 },
  { x: 296, y: 40, width: 96, height: 34, innerX: 12, innerWidth: 72 },
];

const turfGuides = [286, 304, 324, 348, 374];

const lowerBodySegments = [
  { x1: 210, y1: 230, x2: 197, y2: 233 },
  { x1: 210, y1: 230, x2: 224, y2: 228 },
  { x1: 197, y1: 233, x2: 192, y2: 289 },
  { x1: 192, y1: 289, x2: 188, y2: 343 },
  { x1: 188, y1: 343, x2: 174, y2: 344 },
  { x1: 224, y1: 228, x2: 233, y2: 274 },
  { x1: 233, y1: 274, x2: 242, y2: 338 },
  { x1: 242, y1: 338, x2: 259, y2: 338 },
];

const lowerBodyNodes = [
  { cx: 210, cy: 230, r: 4.2 },
  { cx: 197, cy: 233, r: 4.2 },
  { cx: 224, cy: 228, r: 4.2 },
  { cx: 192, cy: 289, r: 4 },
  { cx: 233, cy: 274, r: 4 },
  { cx: 188, cy: 343, r: 4 },
  { cx: 242, cy: 338, r: 4 },
  { cx: 174, cy: 344, r: 3.4 },
  { cx: 259, cy: 338, r: 3.4 },
];

const upperBodySegments = [
  { x1: 210, y1: 230, x2: 214, y2: 175 },
  { x1: 214, y1: 175, x2: 214, y2: 145 },
  { x1: 214, y1: 145, x2: 199, y2: 156 },
  { x1: 214, y1: 145, x2: 228, y2: 152 },
];

const upperBodyNodes = [
  { cx: 214, cy: 175, r: 4.1 },
  { cx: 214, cy: 145, r: 4 },
  { cx: 199, cy: 156, r: 4 },
  { cx: 228, cy: 152, r: 4 },
];

const batRigSegments = [
  { x1: 199, y1: 156, x2: 196, y2: 183 },
  { x1: 196, y1: 183, x2: 184, y2: 170 },
  { x1: 228, y1: 152, x2: 223, y2: 180 },
  { x1: 223, y1: 180, x2: 189, y2: 192 },
  { x1: 184, y1: 170, x2: 189, y2: 192 },
];

const batRigNodes = [
  { cx: 196, cy: 183, r: 3.7 },
  { cx: 223, cy: 180, r: 3.7 },
  { cx: 184, cy: 170, r: 4.1 },
  { cx: 189, cy: 192, r: 4.1 },
];

const hudReadouts = [
  { label: "BAT SPEED", value: "115 KPH" },
  { label: "LAUNCH ANGLE", value: "42°" },
  { label: "PROJECTED DISTANCE", value: "98M" },
  { label: "AI ANALYSIS", value: "OPTIMAL SIX", emphasis: true },
];

export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[680px] items-center justify-center">
      <div
        className="home-hero-loop relative aspect-square w-full overflow-hidden rounded-[38px] border border-white/10 bg-[#050c13] shadow-[0_28px_90px_rgba(0,0,0,0.48)]"
        role="img"
        aria-label="Animated cricket biomechanics scene showing a digital mannequin batter, swing path analysis, and AI follow-through readouts"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_50%_82%,rgba(23,255,194,0.11),transparent_34%),linear-gradient(180deg,rgba(11,19,28,0.2),rgba(5,10,14,0.82))]" />

        <svg viewBox="0 0 420 420" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="heroBiomechSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0e1823" />
              <stop offset="52%" stopColor="#0a131d" />
              <stop offset="100%" stopColor="#070d14" />
            </linearGradient>
            <linearGradient id="heroBiomechPitch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(60, 90, 88, 0.78)" />
              <stop offset="100%" stopColor="rgba(17, 29, 31, 0.88)" />
            </linearGradient>
            <linearGradient id="heroBiomechTurf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(46, 63, 67, 0.92)" />
              <stop offset="100%" stopColor="rgba(10, 19, 22, 1)" />
            </linearGradient>
            <radialGradient id="heroBiomechHipGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(98, 176, 255, 0.95)" />
              <stop offset="46%" stopColor="rgba(68, 152, 255, 0.42)" />
              <stop offset="100%" stopColor="rgba(68, 152, 255, 0)" />
            </radialGradient>
            <radialGradient id="heroBiomechImpact" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(173, 255, 222, 1)" />
              <stop offset="58%" stopColor="rgba(88, 255, 172, 0.68)" />
              <stop offset="100%" stopColor="rgba(88, 255, 172, 0)" />
            </radialGradient>
            <linearGradient id="heroBiomechCalc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(152, 255, 203, 1)" />
              <stop offset="100%" stopColor="rgba(92, 255, 174, 0.4)" />
            </linearGradient>
            <filter id="heroBiomechBlurLarge" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
            <filter id="heroBiomechBlurSmall" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <filter id="heroBiomechWireGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="420" height="420" fill="url(#heroBiomechSky)" />

          <g opacity="0.54" filter="url(#heroBiomechBlurLarge)">
            {lightBanks.map((light) => (
              <g key={`${light.x}-${light.y}`}>
                <rect
                  x={light.x}
                  y={light.y}
                  width={light.width}
                  height={light.height}
                  rx="10"
                  fill="rgba(255,255,255,0.48)"
                />
                <rect
                  x={light.x + light.innerX}
                  y={light.y + 6}
                  width={light.innerWidth}
                  height={light.height - 12}
                  rx="8"
                  fill="rgba(255,255,255,0.2)"
                />
              </g>
            ))}
          </g>

          <g opacity="0.3">
            <circle cx="92" cy="118" r="44" fill="rgba(255,255,255,0.04)" />
            <circle cx="330" cy="122" r="58" fill="rgba(255,255,255,0.04)" />
            <circle cx="212" cy="106" r="74" fill="rgba(255,255,255,0.05)" />
          </g>

          <path d="M0 266C54 246 128 236 210 238C294 240 364 248 420 266V420H0Z" fill="url(#heroBiomechTurf)" />
          <path d="M160 246L260 246L292 420H128Z" fill="url(#heroBiomechPitch)" />

          <g stroke="rgba(156, 255, 214, 0.09)" strokeWidth="1">
            {turfGuides.map((y) => (
              <path key={y} d={`M14 ${y}C120 ${y - 16} 300 ${y - 16} 406 ${y}`} fill="none" />
            ))}
            <path d="M136 266L120 420" fill="none" />
            <path d="M284 266L300 420" fill="none" />
          </g>

          <g stroke="rgba(255,255,255,0.16)" strokeWidth="1.4">
            <path d="M160 246L128 420" fill="none" />
            <path d="M260 246L292 420" fill="none" />
            <path d="M138 348L280 348" fill="none" />
          </g>

          <g className="home-hero-figure-opacity">
            <g className="home-hero-figure-motion">
              <circle className="home-hero-back-hip-glow" cx="197" cy="233" r="30" fill="url(#heroBiomechHipGlow)" />

              <g filter="url(#heroBiomechWireGlow)">
                <g className="home-hero-lower-body">
                  {lowerBodySegments.map((segment, index) => (
                    <line key={`lower-${index}`} className="home-hero-wire" {...segment} />
                  ))}
                  {lowerBodyNodes.map((node, index) => (
                    <circle key={`lower-node-${index}`} className="home-hero-node" {...node} />
                  ))}
                </g>

                <g className="home-hero-upper-body">
                  {upperBodySegments.map((segment, index) => (
                    <line key={`upper-${index}`} className="home-hero-wire" {...segment} />
                  ))}

                  <circle className="home-hero-head" cx="216" cy="116" r="18" />
                  <circle className="home-hero-head-core" cx="216" cy="116" r="9" />

                  {upperBodyNodes.map((node, index) => (
                    <circle key={`upper-node-${index}`} className="home-hero-node" {...node} />
                  ))}

                  <g className="home-hero-bat-rig">
                    {batRigSegments.map((segment, index) => (
                      <line key={`bat-segment-${index}`} className="home-hero-wire" {...segment} />
                    ))}

                    {batRigNodes.map((node, index) => (
                      <circle key={`bat-node-${index}`} className="home-hero-node" {...node} />
                    ))}

                    <path
                      className="home-hero-bat"
                      d="M177 161L147 87L162 80L192 154L186 198L178 198L181 164Z"
                    />
                    <line className="home-hero-bat-edge" x1="156" y1="84" x2="186" y2="158" />
                  </g>
                </g>
              </g>
            </g>
          </g>

          <g fill="none">
            <path
              className="home-hero-trace home-hero-trace-primary"
              d="M154 100C170 122 192 150 216 178C228 192 241 206 254 222"
              pathLength="1"
            />
            <path
              className="home-hero-trace home-hero-trace-secondary"
              d="M164 110C183 134 208 164 233 194C246 210 258 223 270 234"
              pathLength="1"
            />
          </g>

          <g>
            <circle className="home-hero-impact-core" cx="240" cy="208" r="7" fill="url(#heroBiomechImpact)" />

            <g className="home-hero-reticle" stroke="rgba(120,255,174,0.98)" fill="none">
              <circle cx="240" cy="208" r="16" strokeWidth="1.8" />
              <path d="M240 186V196" strokeWidth="1.8" />
              <path d="M240 220V230" strokeWidth="1.8" />
              <path d="M218 208H228" strokeWidth="1.8" />
              <path d="M252 208H262" strokeWidth="1.8" />
              <path d="M233 201L247 215" strokeWidth="1.2" opacity="0.6" />
              <path d="M247 201L233 215" strokeWidth="1.2" opacity="0.6" />
            </g>

            <circle
              className="home-hero-calc-ring"
              cx="240"
              cy="208"
              r="26"
              stroke="url(#heroBiomechCalc)"
              strokeWidth="1.6"
              fill="none"
            />
          </g>
        </svg>

        <div className="absolute inset-x-[7%] top-[11%] h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
        <div className="absolute inset-x-[11%] bottom-[11%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="home-hero-hud pointer-events-none absolute right-[7%] top-[15%] w-[43%] rounded-[1.4rem] border border-white/10 bg-[rgba(4,11,18,0.64)] px-4 py-4 backdrop-blur-[12px]">
          <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
          <div className="space-y-3">
            {hudReadouts.map((row) => (
              <div key={row.label} className="flex items-end justify-between gap-3">
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.28em] text-slate-300/78">
                  {row.label}
                </span>
                <span
                  className={`font-mono text-[0.72rem] uppercase tracking-[0.18em] ${
                    row.emphasis ? "text-[#9dffc8]" : "text-slate-50"
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="home-hero-transition-scrim absolute inset-0" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
          <div className="home-hero-cta min-w-[256px] max-w-[300px] rounded-[22px] border border-[#8bffd4]/45 bg-[linear-gradient(180deg,rgba(11,20,29,0.98),rgba(5,12,18,0.96))] px-6 py-4 text-center shadow-[0_0_0_1px_rgba(140,255,212,0.14),0_22px_48px_rgba(0,0,0,0.46),0_0_44px_rgba(74,255,175,0.24)] backdrop-blur-[18px]">
            <span className="block font-mono text-[0.68rem] uppercase tracking-[0.32em] text-slate-50">
              Level Up Your Game
            </span>
            <span className="mt-2 block font-mono text-[0.78rem] uppercase tracking-[0.28em] text-[#b6ffd7]">
              [Sign Up]
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
