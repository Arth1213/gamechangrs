export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center">
      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,21,0.98),rgba(13,18,26,0.96)_48%,rgba(8,12,18,1))] shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:h-[420px] sm:w-[420px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_72%_24%,rgba(34,197,94,0.06),transparent_30%)]" />
        <div className="absolute inset-x-[10%] top-[12%] h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
        <div className="absolute inset-x-[12%] bottom-[18%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-[14%] bottom-[13%] h-[92px] rounded-full bg-[radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.15),transparent_65%)] blur-2xl" />

        <svg
          viewBox="0 0 420 420"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="pad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(248,250,252,0.98)" />
              <stop offset="100%" stopColor="rgba(211,219,228,0.92)" />
            </linearGradient>
            <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(248,250,252,0.98)" />
              <stop offset="100%" stopColor="rgba(220,228,236,0.88)" />
            </linearGradient>
            <linearGradient id="bat" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(232,208,173,0.98)" />
              <stop offset="100%" stopColor="rgba(167,118,65,0.96)" />
            </linearGradient>
            <linearGradient id="glove" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(33,150,243,0.95)" />
              <stop offset="100%" stopColor="rgba(21,91,164,0.95)" />
            </linearGradient>
            <linearGradient id="helmet" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(31,122,224,0.96)" />
              <stop offset="100%" stopColor="rgba(18,65,129,0.96)" />
            </linearGradient>
            <radialGradient id="ball" cx="0.32" cy="0.28" r="0.72">
              <stop offset="0%" stopColor="rgba(255,241,241,0.96)" />
              <stop offset="34%" stopColor="rgba(210,54,54,0.98)" />
              <stop offset="78%" stopColor="rgba(112,13,13,1)" />
            </radialGradient>
            <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="rgba(0,0,0,0.32)" />
            </filter>
          </defs>

          <g className="animate-cover-drive-body" filter="url(#softShadow)">
            <ellipse cx="228" cy="338" rx="84" ry="16" fill="rgba(0,0,0,0.22)" />

            <path
              d="M192 308C205 287 214 263 222 236C228 214 246 198 268 193C282 190 295 193 304 201C294 217 287 235 283 252C278 272 266 289 247 301L226 314L192 308Z"
              fill="url(#shirt)"
            />
            <path
              d="M244 194C251 178 266 168 284 168C301 168 315 176 321 189C309 191 299 196 291 204C280 213 270 226 262 241L244 194Z"
              fill="url(#shirt)"
            />
            <path
              d="M253 165C256 145 273 130 294 130C307 130 319 136 328 147L320 165C308 158 295 157 283 160L253 165Z"
              fill="url(#helmet)"
            />
            <path
              d="M279 145C291 141 303 143 312 151L307 165C297 162 288 162 278 165L279 145Z"
              fill="rgba(255,255,255,0.18)"
            />
            <circle cx="286" cy="170" r="17" fill="rgba(228,193,160,0.96)" />
            <path d="M271 170H302L299 183H273L271 170Z" fill="rgba(255,255,255,0.26)" />

            <path
              d="M230 219C240 210 252 205 264 204C272 203 280 206 286 212C276 223 269 236 264 251L230 219Z"
              fill="url(#shirt)"
            />
            <path
              d="M220 228C213 249 204 274 191 300L174 299C179 278 184 256 192 235C198 219 207 205 218 195L233 210C227 214 223 220 220 228Z"
              fill="rgba(228,193,160,0.96)"
            />
            <path
              d="M265 224C283 215 301 216 318 227L308 243C296 236 284 235 271 241L265 224Z"
              fill="rgba(228,193,160,0.96)"
            />

            <path d="M188 299L219 302L214 381H184L188 299Z" fill="url(#pad)" />
            <path d="M226 312L254 301L292 381H260L226 312Z" fill="url(#pad)" />
            <path d="M182 381H220V393H176L182 381Z" fill="rgba(245,245,245,0.92)" />
            <path d="M259 381H295L300 393H265L259 381Z" fill="rgba(245,245,245,0.92)" />

            <path d="M262 221L281 213L291 229L272 237L262 221Z" fill="url(#glove)" />
            <path d="M218 215L234 204L246 221L228 231L218 215Z" fill="url(#glove)" />

            <g className="animate-cover-drive-shimmer" transform="rotate(-30 297 171)">
              <rect x="287" y="120" width="22" height="146" rx="10" fill="url(#bat)" />
              <rect x="292" y="106" width="12" height="30" rx="6" fill="rgba(106,67,33,0.98)" />
              <rect x="292" y="144" width="12" height="64" rx="6" fill="rgba(255,255,255,0.1)" />
            </g>
          </g>

          <g className="animate-cover-drive-ball">
            <path
              d="M298 226C322 213 344 201 365 189C381 180 394 172 404 166"
              stroke="rgba(255,255,255,0.52)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="2 10"
              opacity="0.48"
            />
            <circle cx="304" cy="223" r="10" fill="url(#ball)" />
            <path d="M299 216C302 218 306 220 309 223" stroke="rgba(255,230,230,0.72)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M299 229C302 226 306 224 309 221" stroke="rgba(255,230,230,0.72)" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
};
