#!/usr/bin/env node
// Reads how long each side of each tape is, for the tape page's player (SIM-41): the page can then say a
// side's length before its audio has been fetched. Written to data/side-lengths.json as whole seconds, one
// list per tape in the order of its sides, null where a side has no audio or it can't be read.
//
//   node scripts/measure-side-lengths.mjs
//
// ffprobe (it comes with ffmpeg, which must be installed) reads only the start of each file, so this takes a
// couple of minutes for the whole archive. Run it after adding a tape.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tapes = JSON.parse(readFileSync(path.join(root, "data", "tapes.json"), "utf8"));
const list = Array.isArray(tapes) ? tapes : tapes.tapes;

async function lengthOf(url) {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url], { timeout: 60_000 });
    // Whole seconds, rounded down, as the player shows a time: a side of 30:31.99 reads 0:30:31.
    const seconds = Math.floor(Number(stdout.trim()));
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

const sides = list.flatMap((tape) => tape.sides.map((side, index) => ({ id: tape.id, index, url: side.audio_links?.[0]?.url ?? null })));
const lengths = Object.fromEntries(list.map((tape) => [tape.id, tape.sides.map(() => null)]));
const unread = [];
let done = 0;
const queue = [...sides];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const side = queue.shift();
      const seconds = side.url ? await lengthOf(side.url) : null;
      lengths[side.id][side.index] = seconds;
      if (side.url && seconds === null) unread.push(`${side.id} side ${side.index + 1}`);
      if (++done % 100 === 0 || done === sides.length) console.log(`${done}/${sides.length}`);
    }
  }),
);
writeFileSync(path.join(root, "data", "side-lengths.json"), JSON.stringify(lengths, null, 0).replace(/],"/g, '],\n"') + "\n");
if (unread.length) console.error(`\n${unread.length} could not be read:\n  ${unread.join("\n  ")}`);
