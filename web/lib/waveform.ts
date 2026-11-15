// The shape of a side's sound, for the player's scrub bar. The levels come from data/waveforms, measured by
// scripts/measure-waveforms.mjs: 600 a side, each 0 to 255.

/** Fewer levels, each the mean of the ones it replaces: a scrub bar a few hundred pixels wide can't show 600. */
export function thin(levels: number[], count: number): number[] {
  if (levels.length <= count) return levels;
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * levels.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / count));
    let sum = 0;
    for (let k = from; k < to; k++) sum += levels[k];
    return Math.round(sum / (to - from));
  });
}

/**
 * The levels as a picture: an outline mirrored about its middle, given as a CSS mask. Whatever colour is
 * behind the mask shows in the shape of the sound. Silence keeps a hairline: it is still tape.
 */
export function outline(levels: number[]): string {
  const half = (v: number) => Math.max(0.1, Math.min(1, v / 255)) * 50;
  const top = levels.map((v, i) => `${i},${(50 - half(v)).toFixed(1)}`);
  const bottom = levels.map((v, i) => `${i},${(50 + half(v)).toFixed(1)}`).reverse();
  const picture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(1, levels.length - 1)} 100" preserveAspectRatio="none"><polygon points="${[...top, ...bottom].join(" ")}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(picture)}")`;
}
