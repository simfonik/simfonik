// CMY overlapping circles wrapped in a code-only riso-edge filter.
// Multiply blend produces secondary colors where circles overlap; the
// filter dissolves the perimeter into grain. Filter chain mirrors the
// values tuned in /dev/circles2 — see that page for live tweakability.
//
// How the mask works:
//   1. Each circle in the mask source has a radial fade (solid bulk
//      → transparent at the edge), with per-circle softness so each
//      circle gets the right amount of grain.
//   2. Heavy gaussian blur turns those fades into a smooth alpha
//      envelope.
//   3. Two displacement passes (with independent noise fields) push
//      the envelope around chaotically, breaking the smooth fade into
//      organic grain. Two passes guarantee grain coverage everywhere
//      around the perimeter, since each noise field's bland zones
//      land in different places.
//   4. A final composite multiplies noise back on top for grain
//      texture.
//
// IDs are scoped with a `wordmark-` prefix so multiple instances on
// the same page don't collide with other masks/filters.
interface WordmarkProps {
  size?: number;
  className?: string;
}

const CIRCLES = [
  { cx: 245, cy: 220, fill: '#1A84C4', soft: 67 }, // cyan
  { cx: 120, cy: 220, fill: '#FB5FB6', soft: 75 }, // magenta
  { cx: 190, cy: 120, fill: '#FDEB44', soft: 88 }, // yellow
] as const;

export function Wordmark({ size = 44, className = '' }: WordmarkProps) {
  return (
    <span
      aria-hidden
      className={`wordmark-mark ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id="wordmark-riso-grain"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="40"
              result="blur"
            />
            <feTurbulence
              type="turbulence"
              baseFrequency="1.565 0.771"
              numOctaves="2"
              seed="42"
              result="waves1"
            />
            <feTurbulence
              type="turbulence"
              baseFrequency="1.495 0.965"
              numOctaves="2"
              seed="11"
              result="waves2"
            />
            <feDisplacementMap
              in="blur"
              in2="waves1"
              scale="15"
              xChannelSelector="R"
              yChannelSelector="B"
              result="ripples1"
            />
            <feDisplacementMap
              in="ripples1"
              in2="waves2"
              scale="40"
              xChannelSelector="R"
              yChannelSelector="B"
              result="ripples"
            />
            <feComposite
              in="waves1"
              in2="ripples"
              operator="arithmetic"
              k1="1"
              k2="0"
              k3="1"
              k4="0"
            />
          </filter>

          {CIRCLES.map((c) => (
            <radialGradient
              key={c.fill}
              id={`wordmark-fade-${c.fill.slice(1)}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop
                offset={`${c.soft}%`}
                stopColor="white"
                stopOpacity="1"
              />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          ))}

          <mask
            id="wordmark-riso-mask"
            maskUnits="userSpaceOnUse"
            x="-100"
            y="-100"
            width="600"
            height="600"
          >
            <rect x="-100" y="-100" width="600" height="600" fill="black" />
            <g filter="url(#wordmark-riso-grain)">
              {CIRCLES.map((c) => (
                <circle
                  key={c.fill}
                  cx={c.cx}
                  cy={c.cy}
                  r={100}
                  fill={`url(#wordmark-fade-${c.fill.slice(1)})`}
                />
              ))}
            </g>
          </mask>
        </defs>

        <g mask="url(#wordmark-riso-mask)" className="wordmark-colors">
          {CIRCLES.map((c) => (
            <circle key={c.fill} cx={c.cx} cy={c.cy} r={100} fill={c.fill} />
          ))}
        </g>
      </svg>
    </span>
  );
}
