export const HomeHeroOrbit = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center">
      <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[38px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,18,1),rgba(11,16,24,0.98)_46%,rgba(6,10,15,1))] shadow-[0_32px_100px_rgba(0,0,0,0.46)] sm:h-[420px] sm:w-[420px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_50%_90%,rgba(59,130,246,0.06),transparent_28%)]" />
        <div className="absolute left-[12%] top-[10%] h-[120px] w-[120px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),rgba(255,255,255,0.02)_58%,transparent_72%)] blur-2xl" />
        <div className="absolute right-[10%] top-[14%] h-[110px] w-[110px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.22),rgba(37,99,235,0.02)_54%,transparent_72%)] blur-2xl" />

        <svg
          viewBox="0 0 420 420"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="helmetShell" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(51,126,235,0.98)" />
              <stop offset="100%" stopColor="rgba(20,59,122,0.98)" />
            </linearGradient>
            <linearGradient id="helmetTrim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(212,226,255,0.88)" />
              <stop offset="100%" stopColor="rgba(106,142,214,0.2)" />
            </linearGradient>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(229,191,156,0.98)" />
              <stop offset="100%" stopColor="rgba(181,132,98,0.98)" />
            </linearGradient>
            <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(247,250,252,0.98)" />
              <stop offset="100%" stopColor="rgba(207,218,229,0.9)" />
            </linearGradient>
            <linearGradient id="glove" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(246,248,252,0.98)" />
              <stop offset="100%" stopColor="rgba(190,201,216,0.96)" />
            </linearGradient>
          </defs>

          <g className="animate-helmet-scene">
            <ellipse cx="210" cy="352" rx="118" ry="22" fill="rgba(0,0,0,0.28)" />

            <path
              d="M146 332C155 294 171 271 194 262C209 256 224 256 238 262C261 272 278 295 286 332H146Z"
              fill="url(#shirt)"
            />
            <path
              d="M184 258C191 242 201 231 214 226C226 222 239 223 249 229C261 236 270 246 276 258C257 266 239 270 221 271C207 272 194 268 184 258Z"
              fill="url(#shirt)"
            />

            <g className="animate-left-hand">
              <path
                d="M124 233C133 224 145 223 154 229L176 243C183 247 185 256 181 263C177 270 169 272 161 269L136 258C126 253 121 242 124 233Z"
                fill="url(#skin)"
              />
              <path
                d="M128 230C135 222 146 220 156 225L176 236C184 240 186 248 183 255C179 263 171 266 163 264L139 255C128 251 122 240 128 230Z"
                fill="url(#glove)"
              />
            </g>

            <g className="animate-right-hand">
              <path
                d="M296 233C287 224 275 223 266 229L244 243C237 247 235 256 239 263C243 270 251 272 259 269L284 258C294 253 299 242 296 233Z"
                fill="url(#skin)"
              />
              <path
                d="M292 230C285 222 274 220 264 225L244 236C236 240 234 248 237 255C241 263 249 266 257 264L281 255C292 251 298 240 292 230Z"
                fill="url(#glove)"
              />
            </g>

            <g className="animate-head-rise">
              <path
                d="M172 210C172 180 188 153 213 144C237 135 264 143 280 164C289 176 294 192 294 210V220C294 245 280 267 258 278L233 290C223 295 211 295 201 290L176 278C154 267 140 245 140 220V210C140 210 172 210 172 210Z"
                fill="url(#skin)"
              />
              <path
                d="M160 205C162 170 184 144 216 137C240 132 266 138 283 154C294 164 302 179 305 196C290 190 274 188 258 190C226 193 194 202 160 205Z"
                fill="rgba(18,24,36,0.98)"
              />
              <path d="M196 232C204 236 211 238 218 238C225 238 232 236 240 232" stroke="rgba(94,53,28,0.56)" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="193" cy="223" r="3.5" fill="rgba(25,27,32,0.88)" />
              <circle cx="243" cy="223" r="3.5" fill="rgba(25,27,32,0.88)" />
            </g>

            <g className="animate-helmet-drop">
              <path
                d="M149 116C162 89 190 72 221 72C252 72 280 89 293 116L303 137C306 145 300 154 291 154H151C142 154 136 145 139 137L149 116Z"
                fill="url(#helmetShell)"
              />
              <path
                d="M169 92C184 79 202 72 221 72C248 72 272 85 286 106C270 100 252 97 234 97C211 97 189 102 169 111V92Z"
                fill="rgba(255,255,255,0.14)"
              />
              <rect x="151" y="148" width="140" height="10" rx="5" fill="url(#helmetTrim)" />

              <g className="animate-visor-glint">
                <path d="M170 160L190 251" stroke="rgba(214,224,239,0.88)" strokeWidth="4" strokeLinecap="round" />
                <path d="M196 158L208 256" stroke="rgba(214,224,239,0.88)" strokeWidth="4" strokeLinecap="round" />
                <path d="M222 158V258" stroke="rgba(214,224,239,0.92)" strokeWidth="4" strokeLinecap="round" />
                <path d="M248 158L236 256" stroke="rgba(214,224,239,0.88)" strokeWidth="4" strokeLinecap="round" />
                <path d="M274 160L254 251" stroke="rgba(214,224,239,0.88)" strokeWidth="4" strokeLinecap="round" />
                <path d="M170 185H274" stroke="rgba(214,224,239,0.82)" strokeWidth="4" strokeLinecap="round" />
                <path d="M166 215H278" stroke="rgba(214,224,239,0.72)" strokeWidth="4" strokeLinecap="round" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
