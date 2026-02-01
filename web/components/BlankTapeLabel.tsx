"use client";

import { generateTapePattern, getPatternMeta } from "../lib/tape-patterns";

type BlankTapeLabelProps = {
  artistName: string;
  tapeTitle: string;
  year?: string;
  uniqueId: string;
  className?: string;
};

/**
 * Shared component for rendering procedurally-generated blank tape labels
 * 
 * Renders an SVG tape with a deterministic pattern based on artist/title/year.
 * Patterns are cached server-side for performance.
 */
export function BlankTapeLabel({
  artistName,
  tapeTitle,
  year,
  uniqueId,
  className,
}: BlankTapeLabelProps) {
  const pattern = generateTapePattern(artistName, tapeTitle, year);
  
  // Debug mode: show pattern info overlay
  const debugMode = process.env.NEXT_PUBLIC_TAPE_PATTERN_DEBUG === '1';
  const debugInfo = debugMode ? getPatternMeta(artistName, tapeTitle, year) : null;
  
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 373 233"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || "object-contain"}
    >
      <defs>
        {/* Clip path for label area (18px margins, avoiding reel holes) */}
        <clipPath id={`label-clip-${uniqueId}`}>
          <path
            d="M339 14C347.837 14 355 21.1634 355 30V159C355 167.837 347.837 175 339 175H34C25.1634 175 18 167.837 18 159V30C18 21.1634 25.1634 14 34 14H339ZM105 81C94.0132 81 85 90.0132 85 101V113C85 123.987 94.0132 133 105 133H274C284.987 133 294 123.987 294 113V101C294 90.0132 284.987 81 274 81H105Z"
            fillRule="evenodd"
          />
        </clipPath>
        
        {/* Pattern gradients */}
        {pattern.gradients.map((grad) => (
          <linearGradient
            key={grad.id}
            id={grad.id}
            x1={grad.x1}
            y1={grad.y1}
            x2={grad.x2}
            y2={grad.y2}
          >
            {grad.stops.map((stop, idx) => (
              <stop
                key={idx}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            ))}
          </linearGradient>
        ))}
      </defs>
    
      {/* Base blank tape shape */}
      <path
        d="M370.507 152.092V9.9323C370.507 4.44728 366.043 0 360.538 0H12.4608C6.95557 0 2.49188 4.44728 2.49188 9.9323V152.092L0 154.575V213.756L2.49188 215.839V223.068C2.49188 228.553 6.95557 233 12.4608 233H360.538C366.043 233 370.507 228.553 370.507 223.068V215.839L372.999 213.756L373 154.575L370.507 152.092ZM285.066 114.219C283.282 118.976 279.69 123.008 274.849 125.261L273.75 121.747L268.595 123.349L269.694 126.865C264.426 127.754 259.17 126.47 254.987 123.567L257.548 120.8L253.635 117.091L251.014 119.923C249.413 117.992 248.15 115.73 247.356 113.192C246.561 110.654 246.308 108.077 246.524 105.582L250.472 106.467L251.731 101.233L247.715 100.334C249.499 95.5763 253.091 91.5442 257.931 89.291L259.186 93.2962L264.341 91.6943L263.086 87.6891C268.354 86.8002 273.61 88.0825 277.792 90.9855L275.002 93.9999L279.024 97.593L281.766 94.6283C283.367 96.5591 284.629 98.8215 285.424 101.359C286.218 103.898 286.472 106.474 286.257 108.970L282.483 108.124L281.381 113.392L285.066 114.219ZM125.887 120.738C122.401 124.444 117.528 126.788 112.19 127.011L112.533 123.344L107.157 122.846L106.815 126.512C101.607 125.31 97.2541 122.11 94.5144 117.828L97.9483 116.256L95.7691 111.333L92.2555 112.942C91.5251 110.547 91.234 107.974 91.4806 105.326C91.7286 102.678 92.49 100.204 93.6531 97.9829L96.9549 100.314L100.138 95.9662L96.7784 93.5964C100.265 89.8905 105.137 87.5459 110.475 87.3245L110.084 91.5016L115.46 91.9998L115.851 87.8227C121.057 89.0231 125.411 92.2228 128.149 96.5062L124.408 98.2181L126.732 103.076L130.408 101.392C131.14 103.788 131.431 106.36 131.183 109.008C130.935 111.656 130.175 114.131 129.01 116.352L125.856 114.125L122.803 118.563L125.887 120.738ZM100.506 228.125C95.3445 228.125 91.1599 223.956 91.1599 218.813C91.1599 213.671 95.3445 209.501 100.506 209.501C105.668 209.501 109.852 213.671 109.852 218.813C109.852 223.956 105.668 228.125 100.506 228.125ZM137.608 221.917C133.224 221.917 129.67 218.377 129.67 214.009C129.67 209.641 133.224 206.1 137.608 206.1C141.992 206.100 145.546 209.641 145.546 214.009C145.545 218.377 141.991 221.917 137.608 221.917ZM242.111 221.917C237.727 221.917 234.173 218.377 234.173 214.009C234.173 209.641 237.727 206.100 242.111 206.100C246.495 206.100 250.048 209.641 250.048 214.009C250.048 218.377 246.496 221.917 242.111 221.917ZM278.671 228.125C273.509 228.125 269.325 223.956 269.325 218.813C269.325 213.671 273.508 209.501 278.671 209.501C283.832 209.501 288.017 213.671 288.017 218.813C288.017 223.956 283.832 228.125 278.671 228.125Z"
        fill="#101010"
      />
    
      {/* Pattern layer - clipped to label area */}
      <g clipPath={`url(#label-clip-${uniqueId})`}>
        <rect
          x="18"
          y="14"
          width="337"
          height="161"
          fill={pattern.backgroundColor}
        />
        <g transform="translate(18, 14)">
          {pattern.elements.map((el, i) => (
            <path
              key={i}
              d={el.d}
              stroke={el.stroke}
              strokeWidth={el.strokeWidth}
              fill={el.fill}
              opacity={el.opacity}
            />
          ))}
        </g>
      </g>
      
      {/* Debug overlay */}
      {debugMode && debugInfo && (
        <text
          x="20"
          y="185"
          fontSize="10"
          fill="#ffffff"
          fillOpacity="0.8"
          fontFamily="monospace"
        >
          {debugInfo.name} • {debugInfo.elementCount} elements
        </text>
      )}
    </svg>
  );
}
