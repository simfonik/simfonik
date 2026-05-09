interface MockPlayerProps {
  seed: number;
  duration?: string;
  bars?: number;
}

function generateHeights(seed: number, count: number): number[] {
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / Math.max(1, count - 1);
    const wave =
      Math.abs(Math.sin(seed + i * 0.41)) * 0.45 +
      Math.abs(Math.sin(seed * 1.7 + i * 0.13)) * 0.3 +
      Math.abs(Math.sin(seed * 3.3 + i * 0.97)) * 0.25;
    const envelope =
      0.45 +
      0.4 * Math.sin(u * Math.PI * 2.3 + seed * 0.5) +
      0.15 * Math.sin(u * Math.PI * 5.1);
    heights.push(Math.max(0.08, Math.min(1, wave * envelope)));
  }
  return heights;
}

export function MockPlayer({
  seed,
  duration = "47:18",
  bars = 90,
}: MockPlayerProps) {
  const heights = generateHeights(seed, bars);
  const viewWidth = 100;
  const barWidth = viewWidth / bars;

  return (
    <button
      type="button"
      aria-label={`Play · ${duration}`}
      className="flex items-center gap-4 w-full text-left text-[var(--mock-text)] hover:text-[var(--mock-accent-text)] transition-colors cursor-pointer"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4 flex-shrink-0"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      <div className="flex-1 min-w-0">
        <svg
          viewBox={`0 0 ${viewWidth} 24`}
          className="w-full h-6 block"
          preserveAspectRatio="none"
          aria-hidden
        >
          {heights.map((h, i) => {
            const half = h * 11;
            return (
              <rect
                key={i}
                x={i * barWidth}
                y={12 - half}
                width={barWidth * 0.55}
                height={Math.max(half * 2, 0.4)}
                fill="currentColor"
              />
            );
          })}
        </svg>
      </div>
      <span className="mock-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mock-muted)] flex-shrink-0">
        {duration}
      </span>
    </button>
  );
}
