// The shape of a side's sound, for the overview strip.

/**
 * A side's loudness along its length (0–255 a step, from data/waveforms) as a picture: an outline mirrored
 * about its middle, given as a CSS mask. Whatever is drawn in the strip's lane is cut to it, so the lane
 * reads as audio and still shows which stretches are ID'd. Silence keeps a hairline: it is still tape.
 */
export function outline(levels: number[]): string {
  const half = (v: number) => Math.max(0.12, Math.min(1, v / 255)) * 50;
  const top = levels.map((v, i) => `${i},${(50 - half(v)).toFixed(1)}`);
  const bottom = levels.map((v, i) => `${i},${(50 + half(v)).toFixed(1)}`).reverse();
  const picture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(1, levels.length - 1)} 100" preserveAspectRatio="none"><polygon points="${[...top, ...bottom].join(" ")}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(picture)}")`;
}
