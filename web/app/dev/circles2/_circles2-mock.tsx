'use client';

import { useState } from 'react';

// Reuses prod's @keyframes wordmark-rotate-pos-{a,b,c} from globals.css.
// Each visible circle gets a different keyframe so all three colors
// rotate clockwise around the triangle, same as prod on hover.
const ANIMATION_CSS = `
.play-color-1 { animation: wordmark-rotate-pos-b 2.7s linear infinite; }
.play-color-2 { animation: wordmark-rotate-pos-c 2.7s linear infinite; }
.play-color-3 { animation: wordmark-rotate-pos-a 2.7s linear infinite; }
`;

const CMY = [
  { id: 'cyan', cx: 245, cy: 220, fill: '#1A84C4' },
  { id: 'magenta', cx: 120, cy: 220, fill: '#FB5FB6' },
  { id: 'yellow', cx: 190, cy: 120, fill: '#FDEB44' },
] as const;

type CircleId = (typeof CMY)[number]['id'];

export function Circles2Mock() {
  // Filter knobs
  const [blur, setBlur] = useState(40);
  const [freqX1, setFreqX1] = useState(1.565);
  const [freqY1, setFreqY1] = useState(0.771);
  const [freqX2, setFreqX2] = useState(1.495);
  const [freqY2, setFreqY2] = useState(0.965);
  const [octaves, setOctaves] = useState(2);
  const [seed1, setSeed1] = useState(42);
  const [seed2, setSeed2] = useState(11);
  const [scale1, setScale1] = useState(15);
  const [scale2, setScale2] = useState(40);

  // Per-circle gradient softness: where the radial fade BEGINS, as a
  // percent of radius. Lower value = larger fade zone = more grain.
  // Higher = solid until close to the edge = less grain.
  const [softness, setSoftness] = useState<Record<CircleId, number>>({
    cyan: 67,
    magenta: 75,
    yellow: 88,
  });

  const [animate, setAnimate] = useState(true);

  const reset = () => {
    setBlur(40);
    setFreqX1(1.565);
    setFreqY1(0.771);
    setFreqX2(1.495);
    setFreqY2(0.965);
    setOctaves(2);
    setSeed1(42);
    setSeed2(11);
    setScale1(15);
    setScale2(40);
    setSoftness({ cyan: 67, magenta: 75, yellow: 88 });
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <style>{ANIMATION_CSS}</style>
      <div className="flex-1 flex items-center justify-center p-8">
        <span className="inline-flex items-center gap-[36px] font-display text-[180px] leading-none text-[var(--text)]">
          <svg
            viewBox="0 0 400 400"
            width="264"
            height="264"
            xmlns="http://www.w3.org/2000/svg"
            style={{ isolation: 'isolate', transform: 'translateY(12px)' }}
          >
            <defs>
              <filter
                id="riso-grain"
                x="-25%"
                y="-25%"
                width="150%"
                height="150%"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation={blur}
                  result="blur"
                />
                <feTurbulence
                  type="turbulence"
                  baseFrequency={`${freqX1} ${freqY1}`}
                  numOctaves={octaves}
                  seed={seed1}
                  result="waves1"
                />
                <feTurbulence
                  type="turbulence"
                  baseFrequency={`${freqX2} ${freqY2}`}
                  numOctaves={octaves}
                  seed={seed2}
                  result="waves2"
                />
                <feDisplacementMap
                  in="blur"
                  in2="waves1"
                  scale={scale1}
                  xChannelSelector="R"
                  yChannelSelector="B"
                  result="ripples1"
                />
                <feDisplacementMap
                  in="ripples1"
                  in2="waves2"
                  scale={scale2}
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

              {CMY.map((c) => (
                <radialGradient
                  key={c.id}
                  id={`fade-${c.id}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <stop offset="0%" stopColor="white" stopOpacity="1" />
                  <stop
                    offset={`${softness[c.id]}%`}
                    stopColor="white"
                    stopOpacity="1"
                  />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
              ))}

              <mask
                id="riso-mask"
                maskUnits="userSpaceOnUse"
                x="-100"
                y="-100"
                width="600"
                height="600"
              >
                <rect
                  x="-100"
                  y="-100"
                  width="600"
                  height="600"
                  fill="black"
                />
                <g filter="url(#riso-grain)">
                  {CMY.map((c) => (
                    <circle
                      key={c.id}
                      cx={c.cx}
                      cy={c.cy}
                      r={100}
                      fill={`url(#fade-${c.id})`}
                    />
                  ))}
                </g>
              </mask>
            </defs>

            <g mask="url(#riso-mask)">
              {CMY.map((c, i) => (
                <circle
                  key={c.id}
                  cx={c.cx}
                  cy={c.cy}
                  r={100}
                  fill={c.fill}
                  className={animate ? `play-color-${i + 1}` : undefined}
                  style={{ mixBlendMode: 'multiply' }}
                />
              ))}
            </g>
          </svg>
          simfonik
        </span>
      </div>

      <aside className="w-96 shrink-0 border-l border-[var(--border)] bg-[var(--bg)] overflow-y-auto p-6 max-h-screen sticky top-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[var(--text)]">
            Riso filter knobs
          </h2>
          <button
            type="button"
            onClick={reset}
            className="text-[10px] font-mono uppercase tracking-wider text-[var(--text)] opacity-60 hover:opacity-100 underline"
          >
            reset
          </button>
        </div>

        <Section title="Blur">
          <Slider
            label="stdDeviation"
            value={blur}
            min={0}
            max={40}
            step={0.5}
            onChange={setBlur}
          />
        </Section>

        <Section title="Turbulence A (waves1)">
          <Slider
            label="freq X"
            value={freqX1}
            min={0.05}
            max={2}
            step={0.005}
            onChange={setFreqX1}
          />
          <Slider
            label="freq Y"
            value={freqY1}
            min={0.05}
            max={2}
            step={0.005}
            onChange={setFreqY1}
          />
          <NumberInput label="seed" value={seed1} onChange={setSeed1} />
        </Section>

        <Section title="Turbulence B (waves2)">
          <Slider
            label="freq X"
            value={freqX2}
            min={0.05}
            max={2}
            step={0.005}
            onChange={setFreqX2}
          />
          <Slider
            label="freq Y"
            value={freqY2}
            min={0.05}
            max={2}
            step={0.005}
            onChange={setFreqY2}
          />
          <NumberInput label="seed" value={seed2} onChange={setSeed2} />
        </Section>

        <Section title="Octaves (shared)">
          <Slider
            label="numOctaves"
            value={octaves}
            min={1}
            max={4}
            step={1}
            onChange={setOctaves}
          />
        </Section>

        <Section title="Displacement scale">
          <Slider
            label="pass 1"
            value={scale1}
            min={0}
            max={120}
            step={1}
            onChange={setScale1}
          />
          <Slider
            label="pass 2"
            value={scale2}
            min={0}
            max={120}
            step={1}
            onChange={setScale2}
          />
        </Section>

        <Section title="Animation">
          <label className="flex items-center gap-2 text-[11px] font-mono text-[var(--text)]">
            <input
              type="checkbox"
              checked={animate}
              onChange={(e) => setAnimate(e.target.checked)}
            />
            <span>color rotation (always on)</span>
          </label>
        </Section>

        <Section title="Per-circle gradient softness">
          <p className="text-[10px] font-mono opacity-60 mb-2 leading-snug">
            % of radius where the soft fade begins. Lower = more grain on
            that circle. Higher = sharper, less grain.
          </p>
          {CMY.map((c) => (
            <Slider
              key={c.id}
              label={c.id}
              value={softness[c.id]}
              min={0}
              max={100}
              step={1}
              onChange={(v) => setSoftness((s) => ({ ...s, [c.id]: v }))}
            />
          ))}
        </Section>

        <details className="mt-6 text-[10px] font-mono opacity-60">
          <summary className="cursor-pointer">current values</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all">
            {JSON.stringify(
              {
                blur,
                turbulenceA: { freqX: freqX1, freqY: freqY1, seed: seed1 },
                turbulenceB: { freqX: freqX2, freqY: freqY2, seed: seed2 },
                octaves,
                displacement: { scale1, scale2 },
                softness,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 pb-4 border-b border-[var(--border)] last:border-0">
      <h3 className="text-[10px] font-mono uppercase tracking-wider opacity-60 mb-2 text-[var(--text)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block mb-2">
      <div className="flex justify-between text-[11px] font-mono text-[var(--text)]">
        <span>{label}</span>
        <span className="opacity-60 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 mb-2">
      <span className="text-[11px] font-mono text-[var(--text)] flex-1">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-20 bg-transparent border border-[var(--border)] px-2 py-1 text-[11px] font-mono text-[var(--text)] tabular-nums"
      />
    </label>
  );
}
