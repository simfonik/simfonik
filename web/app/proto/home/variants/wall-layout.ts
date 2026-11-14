// Shared wall geometry: each year is a block four covers tall; blocks flow left to right and wrap like words.
import { chronological, type ProtoTape } from "../shared";

export const ROWS = 4;
export const CARD_W = 240;
export const IMG_H = 160;
export const CARD_H = 212;
export const GAP = 20;
export const LABEL_H = 230;
export const BLOCK_MIN_W = 440;
export const BLOCK_GAP = 110;
export const SHELF_GAP = 130;
export const MAX_W = 8000;

export function layoutWall(tapes: ProtoTape[]) {
  const sorted = chronological(tapes);
  const years = [...new Set(sorted.map((t) => t.released ?? ""))];
  const bands: { year: string; count: number; x: number; y: number; w: number }[] = [];
  const cards: { tape: ProtoTape; x: number; y: number }[] = [];
  const shelfH = LABEL_H + ROWS * CARD_H + (ROWS - 1) * GAP;
  let x = 0;
  let y = 0;
  let width = 0;
  for (const year of years) {
    const group = sorted.filter((t) => (t.released ?? "") === year);
    const cols = Math.ceil(group.length / ROWS);
    const w = Math.max(cols * (CARD_W + GAP) - GAP, BLOCK_MIN_W);
    if (x > 0 && x + w > MAX_W) {
      x = 0;
      y += shelfH + SHELF_GAP;
    }
    bands.push({ year, count: group.length, x, y, w });
    group.forEach((tape, i) => {
      cards.push({
        tape,
        x: x + Math.floor(i / ROWS) * (CARD_W + GAP),
        y: y + LABEL_H + (i % ROWS) * (CARD_H + GAP),
      });
    });
    width = Math.max(width, x + w);
    x += w + BLOCK_GAP;
  }
  return { bands, cards, width, height: y + shelfH, shelfH };
}
