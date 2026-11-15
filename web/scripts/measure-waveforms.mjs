#!/usr/bin/env node
// Measures how loud each side of each tape is along its length, for the tape page's waveform scrubber
// (SIM-41). One small file per tape in data/waveforms: for each side, 600 levels, 0 to 255.
//
//   node scripts/measure-waveforms.mjs             every tape that has no file yet
//   node scripts/measure-waveforms.mjs <tape-id>…  those tapes, measured again
//
// It keeps no audio. ffmpeg (which must be installed) reads each side from where the site serves it, about
// 100 MB a side, and only the levels are written. A tape is written only if every side of it was measured.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "data", "waveforms");
const LEVELS = 600;
const RATE = 4000; // samples a second: plenty for loudness
const BLOCK = RATE / 4; // a quarter of a second

/** The mean square of each quarter-second of one side, read as the audio streams past. */
function energies(url) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-v", "error", "-i", url, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], { stdio: ["ignore", "pipe", "pipe"] });
    const blocks = [];
    let sum = 0;
    let count = 0;
    let odd = null; // half a sample left over at the end of a chunk
    let complaint = "";
    ffmpeg.stdout.on("data", (chunk) => {
      const bytes = odd ? Buffer.concat([odd, chunk]) : chunk;
      const whole = bytes.length - (bytes.length % 2);
      for (let i = 0; i < whole; i += 2) {
        const v = bytes.readInt16LE(i);
        sum += v * v;
        if (++count === BLOCK) {
          blocks.push(sum / BLOCK);
          sum = 0;
          count = 0;
        }
      }
      odd = whole < bytes.length ? bytes.subarray(whole) : null;
    });
    ffmpeg.stderr.on("data", (text) => (complaint += text));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => (code === 0 && blocks.length > 0 ? resolve(blocks) : reject(new Error(complaint.trim().split("\n")[0] || `ffmpeg exited with ${code}`))));
  });
}

/** A side's quarter-seconds as 600 levels: loudness along its length, against its own loudest passages. */
function levels(blocks) {
  const loud = Array.from({ length: LEVELS }, (_, i) => {
    const from = Math.floor((i * blocks.length) / LEVELS);
    const to = Math.max(from + 1, Math.floor(((i + 1) * blocks.length) / LEVELS));
    let sum = 0;
    for (let b = from; b < to; b++) sum += blocks[b];
    return Math.sqrt(sum / (to - from));
  });
  // Against the 99th percentile, not the single loudest moment: one click on the tape shouldn't flatten the rest.
  const top = [...loud].sort((a, b) => a - b)[Math.floor(LEVELS * 0.99)] || 1;
  return loud.map((v) => Math.min(255, Math.round((v / top) * 255)));
}

const tapes = JSON.parse(readFileSync(path.join(root, "data", "tapes.json"), "utf8"));
const asked = process.argv.slice(2);
const todo = (Array.isArray(tapes) ? tapes : tapes.tapes).filter((t) => (asked.length ? asked.includes(t.id) : !existsSync(path.join(out, `${t.id}.json`))));
mkdirSync(out, { recursive: true });
console.log(`${todo.length} tape(s) to measure`);

let done = 0;
const failed = [];
async function measure(tape) {
  try {
    const sides = [];
    for (const side of tape.sides) {
      const url = side.audio_links?.[0]?.url;
      sides.push(url ? levels(await energies(url)) : null);
    }
    writeFileSync(path.join(out, `${tape.id}.json`), JSON.stringify(sides));
  } catch (error) {
    failed.push(`${tape.id}: ${error.message}`);
  }
  if (++done % 10 === 0 || done === todo.length) console.log(`${done}/${todo.length}`);
}
// Three tapes at a time: each side is a 100 MB read, and the connection has other uses.
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await measure(queue.shift()); }));
if (failed.length) {
  console.error(`\n${failed.length} not measured:\n  ${failed.join("\n  ")}`);
  process.exitCode = 1;
}
